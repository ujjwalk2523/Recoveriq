import { prisma } from '@/lib/db/prisma';
import { WebhookDeliveryStatus, WebhookEndpointStatus } from '@prisma/client';
import { WebhookSignatureService } from './signature';
import { WebhookRetryPolicy, MAX_WEBHOOK_DELIVERY_ATTEMPTS } from './retry-policy';
import { WebhookEndpointService } from './endpoint-service';
import { AuditService } from '@/lib/services/audit.service';

export interface WebhookDeliveryRecord {
  id: string;
  merchantId: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: any;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  responseStatus?: number | null;
  responseBody?: string | null;
  latencyMs?: number | null;
  nextRetryAt?: Date | null;
  deliveredAt?: Date | null;
  lastAttemptAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory deliveries store for testing & resilient offline execution
export const IN_MEMORY_DELIVERIES: WebhookDeliveryRecord[] = [];

// Pluggable dispatcher for unit/synthetic testing
export type HttpDispatcherFn = (
  url: string,
  headers: Record<string, string>,
  body: string
) => Promise<{ status: number; body?: string }>;

let customDispatcher: HttpDispatcherFn | null = null;

export class WebhookDeliveryService {
  /**
   * Sets a custom HTTP dispatcher for testing mock endpoints.
   */
  static setCustomDispatcher(fn: HttpDispatcherFn | null): void {
    customDispatcher = fn;
  }

  /**
   * Dispatches a webhook delivery asynchronously with HMAC signature and retry handling.
   */
  static async executeDelivery(deliveryId: string, merchantId: string): Promise<WebhookDeliveryRecord> {
    const delivery = await this.getDelivery(deliveryId, merchantId);
    if (!delivery) {
      throw new Error(`Delivery '${deliveryId}' not found.`);
    }

    const endpoint = await WebhookEndpointService.getEndpoint(delivery.endpointId, merchantId);
    if (!endpoint || endpoint.status === WebhookEndpointStatus.DISABLED) {
      delivery.status = WebhookDeliveryStatus.CANCELLED;
      delivery.responseBody = 'Endpoint disabled or deleted.';
      delivery.updatedAt = new Date();
      await this.saveDelivery(delivery);
      return delivery;
    }

    const secretHash = await WebhookEndpointService.getSecretHash(endpoint.id, merchantId);
    // Use secretHash or fallback mock secret for signing
    const signingSecret = secretHash || 'whsec_fallback_signing_secret';

    const timestampSec = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(delivery.payload);
    const signature = WebhookSignatureService.computeSignature(signingSecret, timestampSec, rawBody);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RecoverIQ-Webhook-Delivery/1.0',
      'X-RecoverIQ-Signature': signature,
      'X-RecoverIQ-Event-ID': delivery.eventId,
      'X-RecoverIQ-Timestamp': String(timestampSec),
      'X-RecoverIQ-Version': '1',
    };

    delivery.status = WebhookDeliveryStatus.DELIVERING;
    delivery.lastAttemptAt = new Date();
    delivery.attemptCount += 1;

    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;

    try {
      if (customDispatcher) {
        const res = await customDispatcher(endpoint.url, headers, rawBody);
        responseStatus = res.status;
        responseBody = res.body || '';
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: rawBody,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        responseStatus = response.status;
        responseBody = await response.text().catch(() => '');
      }
    } catch (err: any) {
      responseStatus = null;
      responseBody = err.name === 'AbortError' ? 'Timeout: Request exceeded 5000ms' : err.message || 'Network connection failure';
    }

    const latencyMs = Date.now() - startTime;
    delivery.responseStatus = responseStatus;
    delivery.responseBody = responseBody?.slice(0, 1000) || null; // Bound response size
    delivery.latencyMs = latencyMs;
    delivery.updatedAt = new Date();

    // Evaluate Retry Policy
    const newStatus = WebhookRetryPolicy.resolveStatus(responseStatus, delivery.attemptCount);
    delivery.status = newStatus;

    if (newStatus === WebhookDeliveryStatus.DELIVERED) {
      delivery.deliveredAt = new Date();
      delivery.nextRetryAt = null;
    } else if (newStatus === WebhookDeliveryStatus.RETRYING) {
      const delaySec = WebhookRetryPolicy.getNextRetryDelaySeconds(delivery.attemptCount) || 30;
      delivery.nextRetryAt = new Date(Date.now() + delaySec * 1000);
    } else {
      delivery.nextRetryAt = null; // FAILED or DEAD_LETTER
    }

    await this.saveDelivery(delivery);
    return delivery;
  }

  /**
   * Replays a dead-lettered or failed delivery safely without mutating original event.
   */
  static async replayDelivery(deliveryId: string, merchantId: string, actor = 'SYSTEM'): Promise<WebhookDeliveryRecord> {
    const delivery = await this.getDelivery(deliveryId, merchantId);
    if (!delivery) {
      throw new Error(`Delivery '${deliveryId}' not found for authenticated merchant.`);
    }

    // Preserve original event ID and payload, reset attempts
    delivery.status = WebhookDeliveryStatus.PENDING;
    delivery.attemptCount = 0;
    delivery.responseStatus = null;
    delivery.responseBody = `Replay initiated by ${actor}`;
    delivery.nextRetryAt = null;
    delivery.updatedAt = new Date();

    await this.saveDelivery(delivery);

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_DELIVERY_REPLAYED',
        entityType: 'WEBHOOK_DELIVERY',
        entityId: deliveryId,
        details: `Replayed webhook delivery for event ${delivery.eventId} (Endpoint: ${delivery.endpointId}).`,
      });
    } catch {
      // non-blocking
    }

    // Re-execute synchronously or enqueue
    return await this.executeDelivery(deliveryId, merchantId);
  }

  /**
   * Retrieves single delivery strictly scoped to merchant.
   */
  static async getDelivery(id: string, merchantId: string): Promise<WebhookDeliveryRecord | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.webhookEventDelivery.findFirst({
          where: { id, merchantId },
        });
        if (db) {
          return {
            id: db.id,
            merchantId: db.merchantId,
            endpointId: db.endpointId,
            eventId: db.eventId,
            eventType: db.eventType,
            payload: db.payload,
            status: db.status,
            attemptCount: db.attemptCount,
            responseStatus: db.responseStatus,
            responseBody: db.responseBody,
            latencyMs: db.latencyMs,
            nextRetryAt: db.nextRetryAt,
            deliveredAt: db.deliveredAt,
            lastAttemptAt: db.lastAttemptAt,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_DELIVERIES.find((d) => d.id === id && d.merchantId === merchantId) || null;
  }

  /**
   * Lists chronological delivery records with optional filters.
   */
  static async listDeliveries(
    merchantId: string,
    options: { endpointId?: string; status?: WebhookDeliveryStatus; limit?: number } = {}
  ): Promise<WebhookDeliveryRecord[]> {
    const { endpointId, status, limit = 50 } = options;

    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbList = await prisma.webhookEventDelivery.findMany({
          where: {
            merchantId,
            ...(endpointId ? { endpointId } : {}),
            ...(status ? { status } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (dbList.length > 0) {
          return dbList.map((db) => ({
            id: db.id,
            merchantId: db.merchantId,
            endpointId: db.endpointId,
            eventId: db.eventId,
            eventType: db.eventType,
            payload: db.payload,
            status: db.status,
            attemptCount: db.attemptCount,
            responseStatus: db.responseStatus,
            responseBody: db.responseBody,
            latencyMs: db.latencyMs,
            nextRetryAt: db.nextRetryAt,
            deliveredAt: db.deliveredAt,
            lastAttemptAt: db.lastAttemptAt,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_DELIVERIES.filter(
      (d) =>
        d.merchantId === merchantId &&
        (!endpointId || d.endpointId === endpointId) &&
        (!status || d.status === status)
    ).slice(0, limit);
  }

  /**
   * Lists Dead-Letter deliveries for a merchant.
   */
  static async listDeadLetter(merchantId: string, limit = 50): Promise<WebhookDeliveryRecord[]> {
    return this.listDeliveries(merchantId, { status: WebhookDeliveryStatus.DEAD_LETTER, limit });
  }

  /**
   * Persists delivery record in both in-memory store and database.
   */
  static async saveDelivery(record: WebhookDeliveryRecord): Promise<void> {
    const idx = IN_MEMORY_DELIVERIES.findIndex((d) => d.id === record.id);
    if (idx !== -1) {
      IN_MEMORY_DELIVERIES[idx] = { ...record };
    } else {
      IN_MEMORY_DELIVERIES.unshift({ ...record });
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEventDelivery.upsert({
          where: {
            merchantId_endpointId_eventId: {
              merchantId: record.merchantId,
              endpointId: record.endpointId,
              eventId: record.eventId,
            },
          },
          create: {
            id: record.id,
            merchantId: record.merchantId,
            endpointId: record.endpointId,
            eventId: record.eventId,
            eventType: record.eventType,
            payload: record.payload,
            status: record.status,
            attemptCount: record.attemptCount,
            responseStatus: record.responseStatus,
            responseBody: record.responseBody,
            latencyMs: record.latencyMs,
            nextRetryAt: record.nextRetryAt,
            deliveredAt: record.deliveredAt,
            lastAttemptAt: record.lastAttemptAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
          update: {
            status: record.status,
            attemptCount: record.attemptCount,
            responseStatus: record.responseStatus,
            responseBody: record.responseBody,
            latencyMs: record.latencyMs,
            nextRetryAt: record.nextRetryAt,
            deliveredAt: record.deliveredAt,
            lastAttemptAt: record.lastAttemptAt,
            updatedAt: record.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }
  }

  static clearCache(): void {
    IN_MEMORY_DELIVERIES.length = 0;
    customDispatcher = null;
  }
}

import { prisma } from '@/lib/db/prisma';
import { WebhookEndpointStatus } from '@prisma/client';
import { WebhookSignatureService } from './signature';
import { ALL_RECOVERIQ_EVENT_TYPES, isValidEventType, RecoverIQEventType } from './event-types';
import { AuditService } from '@/lib/services/audit.service';
import { assertSafeUrl } from '@/lib/security/input-security';

export interface CreateEndpointParams {
  merchantId: string;
  url: string;
  description?: string;
  subscribedEvents: string[];
  createdBy?: string;
}

export interface WebhookEndpointSanitized {
  id: string;
  merchantId: string;
  url: string;
  description?: string | null;
  subscribedEvents: string[];
  status: WebhookEndpointStatus;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date | null;
}

export const IN_MEMORY_WEBHOOK_ENDPOINTS: Array<
  WebhookEndpointSanitized & { secretHash: string; rawSecret?: string }
> = [];

export class WebhookEndpointService {
  /**
   * Validates target URL structure, protocol, and SSRF security boundaries.
   * Requires HTTPS and strictly rejects loopback, private networks, and cloud metadata.
   */
  static validateUrl(url: string): void {
    assertSafeUrl(url);
  }

  /**
   * Validates subscribed event types against the central catalog.
   */
  static validateSubscribedEvents(events: string[]): RecoverIQEventType[] {
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new Error('At least one subscribed event type must be specified.');
    }

    for (const evt of events) {
      if (!isValidEventType(evt)) {
        throw new Error(`Unknown or invalid event type: '${evt}'.`);
      }
    }

    return events as RecoverIQEventType[];
  }

  /**
   * Creates a new WebhookEndpoint and returns the raw secret exactly once.
   */
  static async createEndpoint(params: CreateEndpointParams): Promise<{
    endpoint: WebhookEndpointSanitized;
    rawSecret: string;
  }> {
    const { merchantId, url, description, subscribedEvents, createdBy } = params;

    this.validateUrl(url);
    const validEvents = this.validateSubscribedEvents(subscribedEvents);

    const rawSecret = WebhookSignatureService.generateSecret();
    const secretHash = WebhookSignatureService.hashSecret(rawSecret);
    const endpointId = `we_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const record: WebhookEndpointSanitized & { secretHash: string; rawSecret?: string } = {
      id: endpointId,
      merchantId,
      url: url.trim(),
      description: description?.trim() || null,
      subscribedEvents: validEvents,
      status: WebhookEndpointStatus.ACTIVE,
      createdBy: createdBy || 'SYSTEM',
      createdAt: now,
      updatedAt: now,
      lastDeliveryAt: null,
      secretHash,
    };

    IN_MEMORY_WEBHOOK_ENDPOINTS.unshift(record);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.create({
          data: {
            id: record.id,
            merchantId,
            url: record.url,
            description: record.description,
            secretHash,
            subscribedEvents: validEvents as any,
            status: WebhookEndpointStatus.ACTIVE,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: createdBy || 'SYSTEM',
        action: 'WEBHOOK_ENDPOINT_CREATED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: record.id,
        details: `Created Webhook Endpoint '${url}' subscribed to [${validEvents.join(', ')}].`,
      });
    } catch {
      // non-blocking
    }

    const { secretHash: _, rawSecret: __, ...sanitized } = record;
    return {
      endpoint: sanitized,
      rawSecret,
    };
  }

  /**
   * Retrieves an endpoint by ID, strictly scoped to merchant.
   */
  static async getEndpoint(id: string, merchantId: string): Promise<WebhookEndpointSanitized | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.webhookEndpoint.findFirst({
          where: { id, merchantId },
        });

        if (db) {
          return {
            id: db.id,
            merchantId: db.merchantId,
            url: db.url,
            description: db.description,
            subscribedEvents: db.subscribedEvents as string[],
            status: db.status,
            createdBy: db.createdBy,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
            lastDeliveryAt: db.lastDeliveryAt,
          };
        }
      } catch {
        // fallback
      }
    }

    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    if (!mem) return null;

    const { secretHash: _, rawSecret: __, ...sanitized } = mem;
    return sanitized;
  }

  /**
   * Retrieves secret hash for an endpoint strictly by merchant and ID.
   */
  static async getSecretHash(id: string, merchantId: string): Promise<string | null> {
    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    if (mem) return mem.secretHash;

    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.webhookEndpoint.findFirst({
          where: { id, merchantId },
          select: { secretHash: true },
        });
        if (db) return db.secretHash;
      } catch {
        // fallback
      }
    }

    return null;
  }

  /**
   * Lists all webhook endpoints for a merchant (sanitized, zero secrets).
   */
  static async listEndpoints(merchantId: string): Promise<WebhookEndpointSanitized[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbList = await prisma.webhookEndpoint.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
        });

        if (dbList.length > 0) {
          return dbList.map((db) => ({
            id: db.id,
            merchantId: db.merchantId,
            url: db.url,
            description: db.description,
            subscribedEvents: db.subscribedEvents as string[],
            status: db.status,
            createdBy: db.createdBy,
            createdAt: db.createdAt,
            updatedAt: db.updatedAt,
            lastDeliveryAt: db.lastDeliveryAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_WEBHOOK_ENDPOINTS.filter((e) => e.merchantId === merchantId).map(
      ({ secretHash: _, rawSecret: __, ...sanitized }) => sanitized
    );
  }

  /**
   * Updates an existing webhook endpoint (url, description, events).
   */
  static async updateEndpoint(
    id: string,
    merchantId: string,
    updates: {
      url?: string;
      description?: string;
      subscribedEvents?: string[];
    },
    actor = 'SYSTEM'
  ): Promise<WebhookEndpointSanitized> {
    const target = await this.getEndpoint(id, merchantId);
    if (!target) {
      throw new Error(`Webhook endpoint '${id}' not found for authenticated merchant.`);
    }

    if (updates.url) this.validateUrl(updates.url);
    if (updates.subscribedEvents) this.validateSubscribedEvents(updates.subscribedEvents);

    const now = new Date();
    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    if (mem) {
      if (updates.url) mem.url = updates.url.trim();
      if (updates.description !== undefined) mem.description = updates.description?.trim() || null;
      if (updates.subscribedEvents) mem.subscribedEvents = updates.subscribedEvents;
      mem.updatedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.updateMany({
          where: { id, merchantId },
          data: {
            ...(updates.url ? { url: updates.url.trim() } : {}),
            ...(updates.description !== undefined ? { description: updates.description?.trim() || null } : {}),
            ...(updates.subscribedEvents ? { subscribedEvents: updates.subscribedEvents as any } : {}),
            updatedAt: now,
          },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_ENDPOINT_UPDATED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: id,
        details: `Updated Webhook Endpoint '${id}' settings.`,
      });
    } catch {
      // non-blocking
    }

    return (await this.getEndpoint(id, merchantId))!;
  }

  /**
   * Rotates an endpoint's secret and returns the new raw secret once.
   */
  static async rotateSecret(
    id: string,
    merchantId: string,
    actor = 'SYSTEM'
  ): Promise<{ endpoint: WebhookEndpointSanitized; newRawSecret: string }> {
    const target = await this.getEndpoint(id, merchantId);
    if (!target) {
      throw new Error(`Webhook endpoint '${id}' not found for authenticated merchant.`);
    }

    const newRawSecret = WebhookSignatureService.generateSecret();
    const newSecretHash = WebhookSignatureService.hashSecret(newRawSecret);
    const now = new Date();

    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    if (mem) {
      mem.secretHash = newSecretHash;
      mem.updatedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.updateMany({
          where: { id, merchantId },
          data: {
            secretHash: newSecretHash,
            updatedAt: now,
          },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_SECRET_ROTATED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: id,
        details: `Rotated secret for Webhook Endpoint '${id}'.`,
      });
    } catch {
      // non-blocking
    }

    return {
      endpoint: target,
      newRawSecret,
    };
  }

  /**
   * Enables an endpoint.
   */
  static async enableEndpoint(id: string, merchantId: string, actor = 'SYSTEM'): Promise<WebhookEndpointSanitized> {
    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    const now = new Date();
    if (mem) {
      mem.status = WebhookEndpointStatus.ACTIVE;
      mem.updatedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.updateMany({
          where: { id, merchantId },
          data: { status: WebhookEndpointStatus.ACTIVE, updatedAt: now },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_ENDPOINT_ENABLED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: id,
        details: `Enabled Webhook Endpoint '${id}'.`,
      });
    } catch {
      // non-blocking
    }

    return (await this.getEndpoint(id, merchantId))!;
  }

  /**
   * Disables an endpoint.
   */
  static async disableEndpoint(id: string, merchantId: string, actor = 'SYSTEM'): Promise<WebhookEndpointSanitized> {
    const mem = IN_MEMORY_WEBHOOK_ENDPOINTS.find((e) => e.id === id && e.merchantId === merchantId);
    const now = new Date();
    if (mem) {
      mem.status = WebhookEndpointStatus.DISABLED;
      mem.updatedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.updateMany({
          where: { id, merchantId },
          data: { status: WebhookEndpointStatus.DISABLED, updatedAt: now },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_ENDPOINT_DISABLED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: id,
        details: `Disabled Webhook Endpoint '${id}'.`,
      });
    } catch {
      // non-blocking
    }

    return (await this.getEndpoint(id, merchantId))!;
  }

  /**
   * Permanently deletes a webhook endpoint.
   */
  static async deleteEndpoint(id: string, merchantId: string, actor = 'SYSTEM'): Promise<boolean> {
    const idx = IN_MEMORY_WEBHOOK_ENDPOINTS.findIndex((e) => e.id === id && e.merchantId === merchantId);
    if (idx !== -1) {
      IN_MEMORY_WEBHOOK_ENDPOINTS.splice(idx, 1);
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.webhookEndpoint.deleteMany({
          where: { id, merchantId },
        });
      } catch {
        // resilient
      }
    }

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_ADMIN',
        actorName: actor,
        action: 'WEBHOOK_ENDPOINT_DELETED',
        entityType: 'WEBHOOK_ENDPOINT',
        entityId: id,
        details: `Deleted Webhook Endpoint '${id}'.`,
      });
    } catch {
      // non-blocking
    }

    return true;
  }

  static clearCache(): void {
    IN_MEMORY_WEBHOOK_ENDPOINTS.length = 0;
  }
}

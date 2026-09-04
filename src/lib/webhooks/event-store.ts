import { prisma } from '@/lib/db/prisma';
import { RecoverIQEventType, DomainEventEnvelope, isValidEventType } from './event-types';
import { WebhookEndpointService } from './endpoint-service';
import { WebhookDeliveryService } from './delivery-service';
import { WebhookDeliveryStatus, WebhookEndpointStatus } from '@prisma/client';

export interface EmitEventParams {
  merchantId: string;
  type: RecoverIQEventType;
  aggregateType: 'payment' | 'recovery' | 'approval' | 'intelligence' | 'system';
  aggregateId: string;
  payload: Record<string, any>;
  test?: boolean;
}

export const IN_MEMORY_EVENTS: DomainEventEnvelope[] = [];

export class RecoverIQEventStore {
  /**
   * Persists an immutable internal domain event and dispatches matching webhook deliveries outbox-style.
   * Execution is non-blocking to protect the calling transaction's availability.
   */
  static async emitEvent(params: EmitEventParams): Promise<{
    event: DomainEventEnvelope;
    deliveryIds: string[];
  }> {
    const { merchantId, type, aggregateType, aggregateId, payload, test = false } = params;

    if (!isValidEventType(type)) {
      throw new Error(`Invalid event type: ${type}`);
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const envelope: DomainEventEnvelope = {
      id: eventId,
      merchantId,
      type,
      version: 1,
      aggregateType,
      aggregateId,
      createdAt: nowIso,
      payload: { ...payload },
      test,
    };

    // 1. Immutable Event Store (Append-Only)
    IN_MEMORY_EVENTS.unshift(envelope);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.recoverIQEvent.create({
          data: {
            id: envelope.id,
            merchantId,
            type,
            version: 1,
            aggregateType,
            aggregateId,
            payload: envelope.payload,
            createdAt: new Date(envelope.createdAt),
          },
        });
      } catch {
        // resilient
      }
    }

    // 2. Match active subscribed endpoints
    const endpoints = await WebhookEndpointService.listEndpoints(merchantId);
    const activeSubscribers = endpoints.filter(
      (e) => e.status === WebhookEndpointStatus.ACTIVE && e.subscribedEvents.includes(type)
    );

    const deliveryIds: string[] = [];

    // 3. Create delivery records
    for (const endpoint of activeSubscribers) {
      const deliveryId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      deliveryIds.push(deliveryId);

      const deliveryRecord = {
        id: deliveryId,
        merchantId,
        endpointId: endpoint.id,
        eventId: envelope.id,
        eventType: type,
        payload: envelope,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await WebhookDeliveryService.saveDelivery(deliveryRecord);

      // 4. Asynchronous Outbox Dispatch (Non-blocking)
      setTimeout(() => {
        WebhookDeliveryService.executeDelivery(deliveryId, merchantId).catch(() => {});
      }, 0);
    }

    return {
      event: envelope,
      deliveryIds,
    };
  }

  /**
   * Retrieves an event by ID strictly scoped to merchant.
   */
  static async getEvent(eventId: string, merchantId: string): Promise<DomainEventEnvelope | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const db = await prisma.recoverIQEvent.findFirst({
          where: { id: eventId, merchantId },
        });
        if (db) {
          return {
            id: db.id,
            merchantId: db.merchantId,
            type: db.type as RecoverIQEventType,
            version: db.version,
            aggregateType: db.aggregateType as any,
            aggregateId: db.aggregateId,
            createdAt: db.createdAt.toISOString(),
            payload: db.payload as any,
          };
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_EVENTS.find((e) => e.id === eventId && e.merchantId === merchantId) || null;
  }

  /**
   * Lists chronological events for a merchant.
   */
  static async listEvents(merchantId: string, limit = 50): Promise<DomainEventEnvelope[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbList = await prisma.recoverIQEvent.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (dbList.length > 0) {
          return dbList.map((db) => ({
            id: db.id,
            merchantId: db.merchantId,
            type: db.type as RecoverIQEventType,
            version: db.version,
            aggregateType: db.aggregateType as any,
            aggregateId: db.aggregateId,
            createdAt: db.createdAt.toISOString(),
            payload: db.payload as any,
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_EVENTS.filter((e) => e.merchantId === merchantId).slice(0, limit);
  }

  static clearCache(): void {
    IN_MEMORY_EVENTS.length = 0;
  }
}

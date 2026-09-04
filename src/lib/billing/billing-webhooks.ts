import { getBillingProvider } from './billing-provider';
import { BillingEventType, SubscriptionStatusType } from './billing-types';
import { SubscriptionService } from './subscription-service';
import { InvoiceService } from './invoice-service';
import { RecoverIQEventStore, RecoverIQEventType } from '@/lib/webhooks';
import { AuditService } from '@/lib/services/audit.service';

export const PROCESSED_BILLING_EVENT_IDS = new Set<string>();

export interface BillingWebhookResult {
  success: boolean;
  status: 'PROCESSED' | 'DUPLICATE_IGNORED' | 'ERROR';
  eventId: string;
  eventType: string;
  merchantId?: string;
  message?: string;
}

export class BillingWebhookProcessor {
  /**
   * Authoritatively processes dedicated SaaS billing webhooks from payment provider.
   * Completely decoupled from merchant end-customer payment recovery.
   */
  static async processWebhook(
    rawBody: string,
    signatureHeader: string,
    headers: Record<string, string>
  ): Promise<BillingWebhookResult> {
    const provider = getBillingProvider();

    // 1. Cryptographic Signature Verification
    const isValidSignature = provider.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValidSignature) {
      throw new Error('Invalid billing webhook signature');
    }

    // 2. Parse provider event into normalized internal contract
    const event = provider.parseWebhookEvent(rawBody, headers);

    // 3. Deterministic Idempotency: Protect against duplicate provider webhooks
    if (PROCESSED_BILLING_EVENT_IDS.has(event.id)) {
      return {
        success: true,
        status: 'DUPLICATE_IGNORED',
        eventId: event.id,
        eventType: event.eventType,
        merchantId: event.merchantId,
        message: 'Duplicate billing event ignored.',
      };
    }

    const merchantId = event.merchantId || 'mer_default';
    PROCESSED_BILLING_EVENT_IDS.add(event.id);

    // 4. State Machine Transition Execution
    try {
      const sub = await SubscriptionService.getSubscription(merchantId);

      switch (event.normalizedType) {
        case BillingEventType.SUBSCRIPTION_ACTIVATED: {
          if (sub.status !== SubscriptionStatusType.ACTIVE) {
            await SubscriptionService.changePlan(merchantId, sub.planCode, 'BILLING_WEBHOOK');
          }
          break;
        }

        case BillingEventType.SUBSCRIPTION_CHARGED: {
          if (sub.status === SubscriptionStatusType.PAST_DUE || sub.status === SubscriptionStatusType.TRIALING) {
            await SubscriptionService.changePlan(merchantId, sub.planCode, 'BILLING_WEBHOOK');
          }
          // Mark invoice as paid if providerInvoiceId is present
          if (event.providerInvoiceId) {
            const invoices = await InvoiceService.listInvoices(merchantId, 5);
            const matchingInv = invoices.find((i) => i.providerInvoiceId === event.providerInvoiceId) || invoices[0];
            if (matchingInv) {
              await InvoiceService.markInvoicePaid(matchingInv.id, merchantId, event.providerPaymentId);
            }
          }
          break;
        }

        case BillingEventType.PAYMENT_FAILED: {
          await SubscriptionService.markPastDue(merchantId, 'BILLING_WEBHOOK');
          break;
        }

        case BillingEventType.SUBSCRIPTION_SUSPENDED: {
          await SubscriptionService.suspendSubscription(
            merchantId,
            'Provider subscription halted/suspended',
            'BILLING_WEBHOOK'
          );
          break;
        }

        case BillingEventType.SUBSCRIPTION_CANCELLED: {
          await SubscriptionService.cancelSubscription(merchantId, 'BILLING_WEBHOOK', false);
          break;
        }

        case BillingEventType.INVOICE_PAID: {
          if (event.providerInvoiceId) {
            const invoices = await InvoiceService.listInvoices(merchantId, 5);
            const matchingInv = invoices.find((i) => i.providerInvoiceId === event.providerInvoiceId) || invoices[0];
            if (matchingInv) {
              await InvoiceService.markInvoicePaid(matchingInv.id, merchantId, event.providerPaymentId);
            }
          }
          break;
        }
      }

      // 5. Emit RecoverIQ Domain Event (Phase 7.4 outbox dispatcher)
      try {
        await RecoverIQEventStore.emitEvent({
          merchantId,
          type: RecoverIQEventType.RECOVERY_COMPLETED as any, // namespace compatibility
          aggregateType: 'payment',
          aggregateId: event.id,
          payload: {
            billingEvent: event.normalizedType,
            providerEventId: event.id,
            providerSubscriptionId: event.providerSubscriptionId,
            amountMinor: event.amountMinor,
            currency: event.currency,
          },
          test: event.isTestMode,
        });
      } catch {
        // non-blocking
      }

      // 6. Audit Logging
      try {
        await AuditService.logEvent({
          merchantId,
          actorType: 'BILLING_WEBHOOK',
          actorName: provider.provider,
          action: 'PAYMENT_CONFIRMED',
          entityType: 'SUBSCRIPTION',
          entityId: event.providerSubscriptionId || event.id,
          details: `Processed provider billing event '${event.eventType}' -> normalized '${event.normalizedType}'.`,
        });
      } catch {
        // non-blocking
      }

      return {
        success: true,
        status: 'PROCESSED',
        eventId: event.id,
        eventType: event.eventType,
        merchantId,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'ERROR',
        eventId: event.id,
        eventType: event.eventType,
        merchantId,
        message: err.message,
      };
    }
  }

  static clearCache(): void {
    PROCESSED_BILLING_EVENT_IDS.clear();
  }
}

import { SubscriptionService, IN_MEMORY_SUBSCRIPTIONS } from './subscription-service';
import { InvoiceService } from './invoice-service';
import { getBillingProvider } from './billing-provider';
import { SubscriptionStatusType, InvoiceStatus } from './billing-types';
import { prisma } from '@/lib/db/prisma';

export interface ReconciliationDiscrepancy {
  merchantId: string;
  type: 'PROVIDER_ACTIVE_LOCAL_PAST_DUE' | 'PROVIDER_CANCELLED_LOCAL_ACTIVE' | 'INVOICE_PAYMENT_MISMATCH';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  localStatus: string;
  providerStatus: string;
  details: string;
}

export interface ReconciliationReport {
  timestamp: string;
  totalMerchantsChecked: number;
  healthyCount: number;
  discrepancyCount: number;
  discrepancies: ReconciliationDiscrepancy[];
}

export class BillingReconciliationService {
  /**
   * Reconciles subscription state for a single merchant against billing provider.
   */
  static async reconcileMerchant(merchantId: string): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const sub = await SubscriptionService.getSubscription(merchantId);

    if (!sub.providerSubscriptionId) {
      return discrepancies; // Internal / trialing subscription with no external provider link
    }

    try {
      const provider = getBillingProvider();
      const providerSub = await provider.fetchSubscription(sub.providerSubscriptionId);

      // Check 1: Provider ACTIVE vs Local PAST_DUE
      if (
        providerSub.status === SubscriptionStatusType.ACTIVE &&
        sub.status === SubscriptionStatusType.PAST_DUE
      ) {
        discrepancies.push({
          merchantId,
          type: 'PROVIDER_ACTIVE_LOCAL_PAST_DUE',
          severity: 'HIGH',
          localStatus: sub.status,
          providerStatus: providerSub.status,
          details: `Provider subscription is ACTIVE, but RecoverIQ local subscription is PAST_DUE. Payment webhook may have been missed.`,
        });
      }

      // Check 2: Provider CANCELLED vs Local ACTIVE
      if (
        providerSub.status === SubscriptionStatusType.CANCELLED &&
        sub.status === SubscriptionStatusType.ACTIVE
      ) {
        discrepancies.push({
          merchantId,
          type: 'PROVIDER_CANCELLED_LOCAL_ACTIVE',
          severity: 'HIGH',
          localStatus: sub.status,
          providerStatus: providerSub.status,
          details: `Provider subscription is CANCELLED, but RecoverIQ local subscription remains ACTIVE. Cancellation event may have been dropped.`,
        });
      }
    } catch {
      // provider offline / test mode fallback
    }

    return discrepancies;
  }

  /**
   * Generates a platform-wide SaaS billing reconciliation report for all active merchants.
   */
  static async generateReconciliationReport(): Promise<ReconciliationReport> {
    const merchantIds = new Set<string>();

    // From memory
    for (const mId of IN_MEMORY_SUBSCRIPTIONS.keys()) {
      merchantIds.add(mId);
    }

    // From DB
    if (process.env.SKIP_DB !== 'true') {
      try {
        const merchants = await prisma.merchant.findMany({ select: { id: true } });
        merchants.forEach((m) => merchantIds.add(m.id));
      } catch {
        // fallback
      }
    }

    const allDiscrepancies: ReconciliationDiscrepancy[] = [];

    for (const merchantId of merchantIds) {
      const issues = await this.reconcileMerchant(merchantId);
      allDiscrepancies.push(...issues);
    }

    const total = merchantIds.size;
    const discrepancyCount = allDiscrepancies.length;
    const healthyCount = Math.max(0, total - discrepancyCount);

    return {
      timestamp: new Date().toISOString(),
      totalMerchantsChecked: total,
      healthyCount,
      discrepancyCount,
      discrepancies: allDiscrepancies,
    };
  }
}

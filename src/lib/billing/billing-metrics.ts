import { IN_MEMORY_SUBSCRIPTIONS } from './subscription-service';
import { IN_MEMORY_INVOICES } from './invoice-service';
import { PLANS_CONFIG } from './plan-config';
import { SubscriptionStatusType, InvoiceStatus } from './billing-types';
import { prisma } from '@/lib/db/prisma';

export interface SaaSBusinessMetrics {
  mrrMinor: number;
  arrMinor: number;
  totalMerchants: number;
  activePaidCount: number;
  trialingCount: number;
  pastDueCount: number;
  suspendedCount: number;
  churnedCount: number;
  trialConversionRate: number; // percentage
  invoicedRevenueMinor: number;
  collectedRevenueMinor: number;
  overageRevenueMinor: number;
}

export class BillingMetricsService {
  /**
   * Deterministically calculates MRR, ARR, and SaaS commercial metrics.
   * Derived from active subscriptions and immutable invoice ledger records.
   */
  static async calculateMetrics(): Promise<SaaSBusinessMetrics> {
    const subscriptions = Array.from(IN_MEMORY_SUBSCRIPTIONS.values());
    const invoices = Array.from(IN_MEMORY_INVOICES);

    let mrrMinor = 0;
    let activePaidCount = 0;
    let trialingCount = 0;
    let pastDueCount = 0;
    let suspendedCount = 0;
    let churnedCount = 0;

    for (const sub of subscriptions) {
      const plan = PLANS_CONFIG[sub.planCode];
      const monthlyPrice = plan && plan.monthlyPriceMinor > 0 ? plan.monthlyPriceMinor : 0;

      if (sub.status === SubscriptionStatusType.ACTIVE) {
        activePaidCount++;
        mrrMinor += monthlyPrice;
      } else if (sub.status === SubscriptionStatusType.TRIALING) {
        trialingCount++;
      } else if (sub.status === SubscriptionStatusType.PAST_DUE) {
        pastDueCount++;
        mrrMinor += monthlyPrice; // At-risk MRR
      } else if (sub.status === SubscriptionStatusType.SUSPENDED) {
        suspendedCount++;
      } else if (sub.status === SubscriptionStatusType.CANCELLED || sub.status === SubscriptionStatusType.EXPIRED) {
        churnedCount++;
      }
    }

    const arrMinor = mrrMinor * 12;
    const totalMerchants = subscriptions.length;
    const totalTrialsAndConverts = trialingCount + activePaidCount;
    const trialConversionRate =
      totalTrialsAndConverts > 0 ? Math.round((activePaidCount / totalTrialsAndConverts) * 1000) / 10 : 0;

    let invoicedRevenueMinor = 0;
    let collectedRevenueMinor = 0;
    let overageRevenueMinor = 0;

    for (const inv of invoices) {
      if (inv.status !== InvoiceStatus.VOID && inv.status !== InvoiceStatus.DRAFT) {
        invoicedRevenueMinor += inv.totalMinor;
        overageRevenueMinor += inv.overageMinor;
        if (inv.status === InvoiceStatus.PAID) {
          collectedRevenueMinor += inv.amountPaidMinor;
        }
      }
    }

    return {
      mrrMinor,
      arrMinor,
      totalMerchants,
      activePaidCount,
      trialingCount,
      pastDueCount,
      suspendedCount,
      churnedCount,
      trialConversionRate,
      invoicedRevenueMinor,
      collectedRevenueMinor,
      overageRevenueMinor,
    };
  }
}

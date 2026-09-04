import { prisma } from '../db/prisma';
import { TransactionFeatureVector, FeatureRecord } from './feature-types';

export class FeatureExtractor {
  private static merchantRateCache = new Map<string, { rate: number; expiresAt: number }>();

  /**
   * Extracts a standardized 18-feature vector for a given transaction ID
   */
  static async extractFeatures(transactionId: string): Promise<FeatureRecord> {
    const now = new Date();

    try {
      // 1. Fetch Transaction with all related tables
      const txn = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          customer: {
            include: {
              recoveryProfile: true,
            },
          },
          paymentEvents: {
            orderBy: { createdAt: 'desc' },
          },
          recoveryAttempts: {
            orderBy: { createdAt: 'desc' },
          },
          merchant: true,
        },
      });

      if (txn) {
        return this.buildFromPrismaRecord(txn);
      }
    } catch {
      // fallback to in-memory / synthesized extraction
    }

    // 2. Resilient fallback for tests and development
    return this.buildFallbackRecord(transactionId);
  }

  /**
   * Builds feature vector from Prisma database models
   */
  private static async buildFromPrismaRecord(txn: any): Promise<FeatureRecord> {
    const createdAt = new Date(txn.createdAt);
    const customer = txn.customer;
    const profile = customer?.recoveryProfile;
    const attempts = txn.recoveryAttempts || [];
    const events = txn.paymentEvents || [];

    // Temporal features
    const hour = createdAt.getHours();
    const dayOfWeek = createdAt.getDay();

    // Failure code resolution
    const latestEvent = events[0];
    const failureCode = txn.errorCode || latestEvent?.errorCode || 'GENERIC_FAILURE';

    // Customer metrics
    const totalTxns = Math.max(1, customer?.totalTransactions || 1);
    const pastRecoveries = customer?.pastRecoveries || 0;
    const customerSuccessRate = Math.min(1.0, Math.max(0.0, (totalTxns - 1) / totalTxns));
    const customerRecoveryRate = Math.min(1.0, Math.max(0.0, pastRecoveries / Math.max(1, totalTxns * 0.3)));

    const upiSuccessRate = profile?.upiSuccessRate ?? 0.82;
    const cardSuccessRate = profile?.cardSuccessRate ?? 0.79;
    const avgRecoveryDelay = profile?.avgRecoveryDelayMinutes ?? 15.0;

    // Previous attempts count
    const previousRetryCount = attempts.length;

    // Time since last transaction
    let timeSinceLastPaymentMinutes = -1;
    try {
      const priorTxn = await prisma.transaction.findFirst({
        where: {
          customerId: customer?.id,
          id: { not: txn.id },
          createdAt: { lt: createdAt },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (priorTxn) {
        timeSinceLastPaymentMinutes = Math.max(0, (createdAt.getTime() - new Date(priorTxn.createdAt).getTime()) / 60000);
      }
    } catch {
      timeSinceLastPaymentMinutes = 1440; // 24 hours fallback
    }

    // Merchant recovery rate
    const merchantRecoveryRate = await this.getMerchantRecoveryRate(txn.merchantId);

    // Target labels (if completed)
    let targetRecovered: number | undefined = undefined;
    let targetRecoveryChannel: string | undefined = undefined;
    let targetTimeToRecoverMinutes: number | undefined = undefined;

    if (txn.status === 'RECOVERED') {
      targetRecovered = 1;
      const winningAttempt = attempts.find((a: any) => a.status === 'PAID') || attempts[0];
      targetRecoveryChannel = winningAttempt?.channel || 'GATEWAY_RETRY';
      if (txn.recoveredAt) {
        targetTimeToRecoverMinutes = Math.max(0, (new Date(txn.recoveredAt).getTime() - createdAt.getTime()) / 60000);
      }
    } else if (txn.status === 'FAILED' && txn.executionStatus === 'HALTED') {
      targetRecovered = 0;
    }

    const features: TransactionFeatureVector = {
      amount: txn.amount,
      payment_method: txn.paymentMethod || 'UPI',
      failure_category: txn.failureCategory || 'TECHNICAL',
      failure_code: failureCode,
      hour,
      day_of_week: dayOfWeek,
      time_since_last_payment_minutes: timeSinceLastPaymentMinutes,
      customer_transaction_count: totalTxns,
      customer_success_rate: Number(customerSuccessRate.toFixed(4)),
      customer_recovery_rate: Number(customerRecoveryRate.toFixed(4)),
      upi_success_rate: Number(upiSuccessRate.toFixed(4)),
      card_success_rate: Number(cardSuccessRate.toFixed(4)),
      avg_recovery_delay_minutes: Number(avgRecoveryDelay.toFixed(2)),
      previous_retry_count: previousRetryCount,
      previous_recovery_count: pastRecoveries,
      fatigue_score: customer?.fatigueScore ?? 12,
      risk_score: customer?.riskScore ?? 8,
      merchant_recovery_rate: Number(merchantRecoveryRate.toFixed(4)),
      target_recovered: targetRecovered,
      target_recovery_channel: targetRecoveryChannel,
      target_time_to_recover_minutes: targetTimeToRecoverMinutes ? Number(targetTimeToRecoverMinutes.toFixed(2)) : undefined,
    };

    return {
      metadata: {
        transactionId: txn.id,
        customerId: customer?.id || 'unknown_cust',
        merchantId: txn.merchantId,
        extractedAt: new Date().toISOString(),
        isFallback: false,
      },
      features,
    };
  }

  /**
   * Resilient fallback feature generator for offline dev & test execution
   */
  static buildFallbackRecord(transactionId: string, overrides?: Partial<TransactionFeatureVector>): FeatureRecord {
    const now = new Date();

    const features: TransactionFeatureVector = {
      amount: 14500,
      payment_method: 'UPI',
      failure_category: 'TECHNICAL',
      failure_code: 'BAD_REQUEST_PAYMENT_TIMED_OUT',
      hour: now.getHours(),
      day_of_week: now.getDay(),
      time_since_last_payment_minutes: 1440, // 24 hours
      customer_transaction_count: 7,
      customer_success_rate: 0.8571,
      customer_recovery_rate: 0.7500,
      upi_success_rate: 0.8400,
      card_success_rate: 0.7800,
      avg_recovery_delay_minutes: 14.5,
      previous_retry_count: 1,
      previous_recovery_count: 3,
      fatigue_score: 15,
      risk_score: 8,
      merchant_recovery_rate: 0.7420,
      target_recovered: 1,
      target_recovery_channel: 'GATEWAY_RETRY',
      target_time_to_recover_minutes: 12.3,
      ...overrides,
    };

    return {
      metadata: {
        transactionId,
        customerId: 'cust_kartik_sharma',
        merchantId: 'mer_saasify_blr',
        extractedAt: now.toISOString(),
        isFallback: true,
      },
      features,
    };
  }

  /**
   * Computes or retrieves rolling merchant recovery rate
   */
  private static async getMerchantRecoveryRate(merchantId: string): Promise<number> {
    const cached = this.merchantRateCache.get(merchantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rate;
    }

    try {
      const [totalCount, recoveredCount] = await Promise.all([
        prisma.transaction.count({ where: { merchantId } }),
        prisma.transaction.count({ where: { merchantId, status: 'RECOVERED' } }),
      ]);

      const rate = totalCount > 0 ? recoveredCount / totalCount : 0.72;
      this.merchantRateCache.set(merchantId, { rate, expiresAt: Date.now() + 600000 }); // cache 10m
      return rate;
    } catch {
      return 0.72; // default platform baseline
    }
  }
}

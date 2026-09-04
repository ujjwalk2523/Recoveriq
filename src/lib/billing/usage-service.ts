import { prisma } from '@/lib/db/prisma';
import {
  PlanCode,
  RecordCorrectionParams,
  RecordUsageParams,
  UsageLedgerRecord,
  UsageMetric,
  UsageMetricSummary,
  UsageStatus,
  UsageSummaryResponse,
} from './billing-types';
import { SubscriptionService } from './subscription-service';
import { PLANS_CONFIG } from './plan-config';
import { AuditService } from '@/lib/services/audit.service';

// In-memory ledger storage for test speed & offline resilience
export const IN_MEMORY_USAGE_LEDGER: UsageLedgerRecord[] = [];
export const PROCESSED_USAGE_KEYS = new Set<string>();

export class UsageService {
  /**
   * Deterministic idempotency key generators
   */
  static buildTransactionKey(transactionId: string): string {
    return `usage:transaction:${transactionId}`;
  }

  static buildAttemptKey(recoveryAttemptId: string): string {
    return `usage:recovery-attempt:${recoveryAttemptId}`;
  }

  static buildApiKey(requestId: string): string {
    return `usage:api:${requestId}`;
  }

  static buildLinkKey(linkId: string): string {
    return `usage:payment-link:${linkId}`;
  }

  static buildWhatsAppKey(messageId: string): string {
    return `usage:whatsapp:${messageId}`;
  }

  static buildRecoveredTxnKey(transactionId: string): string {
    return `usage:recovered:${transactionId}`;
  }

  static buildRecoveredRevenueKey(transactionId: string): string {
    return `usage:recovered-revenue:${transactionId}`;
  }

  /**
   * Resolves the canonical billing period for an event based on occurredAt
   */
  static resolveUsagePeriod(
    subscription: { currentPeriodStart: Date; currentPeriodEnd: Date },
    occurredAt: Date
  ): { periodStart: Date; periodEnd: Date } {
    const occurredTime = occurredAt.getTime();
    const subStart = new Date(subscription.currentPeriodStart).getTime();
    const subEnd = new Date(subscription.currentPeriodEnd).getTime();

    // If event occurred within active subscription period
    if (occurredTime >= subStart && occurredTime <= subEnd) {
      return {
        periodStart: new Date(subscription.currentPeriodStart),
        periodEnd: new Date(subscription.currentPeriodEnd),
      };
    }

    // Otherwise calculate the calendar month window for that occurred date
    const d = new Date(occurredAt);
    const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { periodStart, periodEnd };
  }

  /**
   * Records a billable usage event into the immutable ledger.
   * Strictly idempotent: duplicate events return isDuplicate: true with zero mutation.
   */
  static async recordUsage(params: RecordUsageParams): Promise<{
    success: boolean;
    record?: UsageLedgerRecord;
    isDuplicate?: boolean;
    message?: string;
  }> {
    const {
      merchantId,
      metric,
      quantity = 1,
      unit = metric === UsageMetric.RECOVERED_REVENUE ? 'MINOR_UNIT' : 'COUNT',
      amountMinor,
      currency = 'INR',
      source,
      sourceId,
      metadata,
    } = params;

    const occurredAt = params.occurredAt ? new Date(params.occurredAt) : new Date();

    // Generate or use deterministic idempotency key
    const idempotencyKey =
      params.idempotencyKey ||
      (metric === UsageMetric.TRANSACTIONS_PROCESSED
        ? this.buildTransactionKey(sourceId)
        : metric === UsageMetric.RECOVERY_ATTEMPTS
        ? this.buildAttemptKey(sourceId)
        : metric === UsageMetric.API_REQUESTS
        ? this.buildApiKey(sourceId)
        : metric === UsageMetric.PAYMENT_LINKS_CREATED
        ? this.buildLinkKey(sourceId)
        : metric === UsageMetric.WHATSAPP_MESSAGES
        ? this.buildWhatsAppKey(sourceId)
        : metric === UsageMetric.RECOVERED_TRANSACTIONS
        ? this.buildRecoveredTxnKey(sourceId)
        : metric === UsageMetric.RECOVERED_REVENUE
        ? this.buildRecoveredRevenueKey(sourceId)
        : `usage:${String(metric).toLowerCase()}:${sourceId}`);

    const uniqueLookupKey = `${merchantId}:${idempotencyKey}`;

    // 1. Idempotency Check in memory
    if (PROCESSED_USAGE_KEYS.has(uniqueLookupKey)) {
      return {
        success: true,
        isDuplicate: true,
        message: 'Duplicate usage event skipped. Already recorded in immutable ledger.',
      };
    }
    // Atomically reserve in memory to protect against concurrent promises
    PROCESSED_USAGE_KEYS.add(uniqueLookupKey);

    // 2. Check Database uniqueness
    if (process.env.SKIP_DB !== 'true') {
      try {
        const existing = await prisma.usageLedgerEntry.findUnique({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          PROCESSED_USAGE_KEYS.add(uniqueLookupKey);
          return {
            success: true,
            isDuplicate: true,
            message: 'Duplicate usage event detected in database ledger.',
          };
        }
      } catch {
        // resilient
      }
    }

    // 3. Resolve subscription & period bounds
    const sub = await SubscriptionService.getSubscription(merchantId);
    const { periodStart, periodEnd } = this.resolveUsagePeriod(sub, occurredAt);

    const record: UsageLedgerRecord = {
      id: `usg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      merchantId,
      subscriptionId: sub.id,
      metric,
      quantity,
      unit,
      amountMinor: amountMinor !== undefined ? BigInt(amountMinor) : null,
      currency,
      source,
      sourceId,
      idempotencyKey,
      periodStart,
      periodEnd,
      metadata: metadata || null,
      occurredAt,
      createdAt: new Date(),
      isCorrection: false,
    };

    // Mark as processed
    PROCESSED_USAGE_KEYS.add(uniqueLookupKey);
    IN_MEMORY_USAGE_LEDGER.unshift(record);

    // Persist in DB
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.usageLedgerEntry.create({
          data: {
            id: record.id,
            merchantId,
            subscriptionId: sub.id,
            metric: metric as any,
            quantity,
            unit,
            amountMinor: amountMinor !== undefined ? BigInt(amountMinor) : null,
            currency,
            source,
            sourceId,
            idempotencyKey,
            periodStart,
            periodEnd,
            metadata: metadata as any,
            occurredAt,
            createdAt: record.createdAt,
            isCorrection: false,
          },
        });
      } catch (dbErr: any) {
        // If unique constraint race happened in DB
        if (dbErr.code === 'P2002') {
          return {
            success: true,
            isDuplicate: true,
            message: 'Concurrent duplicate detected by database unique constraint.',
          };
        }
      }
    }

    // Audit Logging
    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'USAGE_METER',
        actorName: source,
        action: 'USAGE_RECORDED',
        entityType: 'USAGE_LEDGER',
        entityId: record.id,
        details: `Recorded ${quantity} ${unit} for ${metric} (Source: ${sourceId}) in period ${periodStart.toISOString().slice(0, 10)}.`,
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      record,
      isDuplicate: false,
    };
  }

  /**
   * Records a compensating correction event without mutating historical rows.
   */
  static async recordUsageCorrection(params: RecordCorrectionParams): Promise<UsageLedgerRecord> {
    const { merchantId, originalEntryId, quantityDelta, reason, actor, metadata } = params;

    // 1. Locate original entry
    let original: UsageLedgerRecord | null =
      IN_MEMORY_USAGE_LEDGER.find((e) => e.id === originalEntryId && e.merchantId === merchantId) || null;

    if (!original && process.env.SKIP_DB !== 'true') {
      try {
        const dbEntry = await prisma.usageLedgerEntry.findFirst({
          where: { id: originalEntryId, merchantId },
        });
        if (dbEntry) {
          original = {
            id: dbEntry.id,
            merchantId: dbEntry.merchantId,
            subscriptionId: dbEntry.subscriptionId,
            metric: dbEntry.metric as UsageMetric,
            quantity: dbEntry.quantity,
            unit: dbEntry.unit,
            amountMinor: dbEntry.amountMinor,
            currency: dbEntry.currency,
            source: dbEntry.source,
            sourceId: dbEntry.sourceId,
            idempotencyKey: dbEntry.idempotencyKey,
            periodStart: dbEntry.periodStart,
            periodEnd: dbEntry.periodEnd,
            occurredAt: dbEntry.occurredAt,
            createdAt: dbEntry.createdAt,
          };
        }
      } catch {
        // fallback
      }
    }

    if (!original) {
      throw new Error(`Original usage ledger entry '${originalEntryId}' not found for merchant '${merchantId}'.`);
    }

    // 2. Create compensating entry
    const correctionId = `usg_corr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const idempotencyKey = `usage:correction:${originalEntryId}:${Date.now()}`;
    const occurredAt = params.occurredAt ? new Date(params.occurredAt) : new Date();

    const correctionRecord: UsageLedgerRecord = {
      id: correctionId,
      merchantId,
      subscriptionId: original.subscriptionId,
      metric: original.metric,
      quantity: quantityDelta,
      unit: original.unit,
      amountMinor: null,
      currency: original.currency,
      source: 'MANUAL_CORRECTION',
      sourceId: originalEntryId,
      idempotencyKey,
      periodStart: original.periodStart,
      periodEnd: original.periodEnd,
      metadata: { ...metadata, reason, actor, originalEntryId },
      occurredAt,
      createdAt: new Date(),
      isCorrection: true,
      originalEntryId,
      correctionReason: reason,
    };

    IN_MEMORY_USAGE_LEDGER.unshift(correctionRecord);
    PROCESSED_USAGE_KEYS.add(`${merchantId}:${idempotencyKey}`);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.usageLedgerEntry.create({
          data: {
            id: correctionRecord.id,
            merchantId,
            subscriptionId: original.subscriptionId,
            metric: original.metric as any,
            quantity: quantityDelta,
            unit: original.unit,
            currency: original.currency,
            source: 'MANUAL_CORRECTION',
            sourceId: originalEntryId,
            idempotencyKey,
            periodStart: original.periodStart,
            periodEnd: original.periodEnd,
            metadata: correctionRecord.metadata as any,
            occurredAt,
            createdAt: correctionRecord.createdAt,
            isCorrection: true,
            originalEntryId,
            correctionReason: reason,
          },
        });
      } catch {
        // resilient
      }
    }

    // Audit logging for correction
    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'ADMIN_CORRECTION',
        actorName: actor,
        action: 'USAGE_CORRECTED',
        entityType: 'USAGE_LEDGER',
        entityId: correctionId,
        details: `Compensating correction of ${quantityDelta} units applied to original entry ${originalEntryId}. Reason: ${reason}`,
      });
    } catch {
      // ignore
    }

    return correctionRecord;
  }

  /**
   * Aggregates usage for a specific metric within a time range.
   */
  static async getUsageByMetric(
    merchantId: string,
    metric: UsageMetric,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<{ quantity: number; amountMinor: number }> {
    let entries = IN_MEMORY_USAGE_LEDGER.filter(
      (e) => e.merchantId === merchantId && e.metric === metric
    );

    if (periodStart && periodEnd) {
      const pStart = periodStart.getTime();
      const pEnd = periodEnd.getTime();
      entries = entries.filter((e) => {
        const occ = new Date(e.occurredAt).getTime();
        return occ >= pStart && occ <= pEnd;
      });
    }

    let quantity = 0;
    let amountMinor = 0;

    for (const e of entries) {
      quantity += e.quantity;
      if (e.amountMinor) {
        amountMinor += Number(e.amountMinor);
      }
    }

    // Check DB if available and in-memory empty
    if (quantity === 0 && process.env.SKIP_DB !== 'true') {
      try {
        const whereClause: any = {
          merchantId,
          metric: metric as any,
        };
        if (periodStart && periodEnd) {
          whereClause.occurredAt = {
            gte: periodStart,
            lte: periodEnd,
          };
        }

        const aggregations = await prisma.usageLedgerEntry.aggregate({
          where: whereClause,
          _sum: {
            quantity: true,
          },
        });

        quantity = aggregations._sum.quantity || 0;
      } catch {
        // fallback
      }
    }

    return { quantity, amountMinor };
  }

  /**
   * Computes usage status based on utilization thresholds.
   * < 80%: WITHIN_LIMIT
   * 80% - <100%: NEAR_LIMIT
   * 100%: LIMIT_REACHED
   * > 100%: OVER_LIMIT
   */
  static calculateUsageStatus(used: number, included: number): UsageStatus {
    if (included === -1) return UsageStatus.WITHIN_LIMIT; // Unlimited
    if (included === 0) return used > 0 ? UsageStatus.OVER_LIMIT : UsageStatus.WITHIN_LIMIT;

    const ratio = used / included;
    if (ratio < 0.8) return UsageStatus.WITHIN_LIMIT;
    if (ratio < 1.0) return UsageStatus.NEAR_LIMIT;
    if (ratio === 1.0) return UsageStatus.LIMIT_REACHED;
    return UsageStatus.OVER_LIMIT;
  }

  /**
   * Generates a comprehensive usage summary for the merchant's active billing period.
   */
  static async getUsageSummary(merchantId: string): Promise<UsageSummaryResponse> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const plan = PLANS_CONFIG[sub.planCode] || PLANS_CONFIG[PlanCode.STARTER];
    const periodStart = new Date(sub.currentPeriodStart);
    const periodEnd = new Date(sub.currentPeriodEnd);

    // Fetch aggregates for all 7 metrics in parallel
    const [
      txResult,
      attemptResult,
      apiResult,
      linkResult,
      waResult,
      recTxnResult,
      recRevResult,
    ] = await Promise.all([
      this.getUsageByMetric(merchantId, UsageMetric.TRANSACTIONS_PROCESSED, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.RECOVERY_ATTEMPTS, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.API_REQUESTS, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.PAYMENT_LINKS_CREATED, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.WHATSAPP_MESSAGES, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.RECOVERED_TRANSACTIONS, periodStart, periodEnd),
      this.getUsageByMetric(merchantId, UsageMetric.RECOVERED_REVENUE, periodStart, periodEnd),
    ]);

    // Build metric summaries with overage & status
    const buildMetricSummary = (
      metric: UsageMetric,
      used: number,
      included: number,
      unit = 'COUNT',
      amountMinor?: number
    ): UsageMetricSummary => {
      const remaining = included === -1 ? -1 : Math.max(0, included - used);
      const overage = included === -1 ? 0 : Math.max(0, used - included);
      const utilization =
        included === -1 ? 0 : included > 0 ? Math.round((used / included) * 10000) / 100 : 100;
      const status = this.calculateUsageStatus(used, included);

      return {
        metric,
        used,
        included,
        remaining,
        overage,
        utilization,
        status,
        unit,
        amountMinor,
      };
    };

    const metrics: Record<string, UsageMetricSummary> = {
      [UsageMetric.TRANSACTIONS_PROCESSED]: buildMetricSummary(
        UsageMetric.TRANSACTIONS_PROCESSED,
        txResult.quantity,
        plan.includedTransactions
      ),
      [UsageMetric.RECOVERY_ATTEMPTS]: buildMetricSummary(
        UsageMetric.RECOVERY_ATTEMPTS,
        attemptResult.quantity,
        plan.includedRecoveryAttempts
      ),
      [UsageMetric.API_REQUESTS]: buildMetricSummary(
        UsageMetric.API_REQUESTS,
        apiResult.quantity,
        plan.includedApiRequests
      ),
      [UsageMetric.PAYMENT_LINKS_CREATED]: buildMetricSummary(
        UsageMetric.PAYMENT_LINKS_CREATED,
        linkResult.quantity,
        -1 // Tracked without hard ceiling
      ),
      [UsageMetric.WHATSAPP_MESSAGES]: buildMetricSummary(
        UsageMetric.WHATSAPP_MESSAGES,
        waResult.quantity,
        -1
      ),
      [UsageMetric.RECOVERED_TRANSACTIONS]: buildMetricSummary(
        UsageMetric.RECOVERED_TRANSACTIONS,
        recTxnResult.quantity,
        -1
      ),
      [UsageMetric.RECOVERED_REVENUE]: buildMetricSummary(
        UsageMetric.RECOVERED_REVENUE,
        recRevResult.quantity,
        -1,
        'MINOR_UNIT',
        recRevResult.amountMinor
      ),
    };

    return {
      merchantId,
      subscriptionId: sub.id,
      planCode: sub.planCode,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      metrics,
    };
  }

  /**
   * Reusable helper for recording API request usage.
   */
  static async recordApiRequestUsage(
    merchantId: string,
    requestId: string,
    occurredAt?: Date | string
  ) {
    return this.recordUsage({
      merchantId,
      metric: UsageMetric.API_REQUESTS,
      quantity: 1,
      source: 'API_GATEWAY',
      sourceId: requestId,
      idempotencyKey: this.buildApiKey(requestId),
      occurredAt,
    });
  }

  /**
   * Retrieves paginated/filtered historical ledger entries for a merchant.
   */
  static async getUsageHistory(
    merchantId: string,
    metric?: UsageMetric,
    limit = 50
  ): Promise<UsageLedgerRecord[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const whereClause: any = { merchantId };
        if (metric) whereClause.metric = metric as any;

        const dbEntries = await prisma.usageLedgerEntry.findMany({
          where: whereClause,
          orderBy: { occurredAt: 'desc' },
          take: limit,
        });

        if (dbEntries.length > 0) {
          return dbEntries.map((e) => ({
            id: e.id,
            merchantId: e.merchantId,
            subscriptionId: e.subscriptionId,
            metric: e.metric as UsageMetric,
            quantity: e.quantity,
            unit: e.unit,
            amountMinor: e.amountMinor ? Number(e.amountMinor) : null,
            currency: e.currency,
            source: e.source,
            sourceId: e.sourceId,
            idempotencyKey: e.idempotencyKey,
            periodStart: e.periodStart,
            periodEnd: e.periodEnd,
            metadata: e.metadata as any,
            occurredAt: e.occurredAt,
            createdAt: e.createdAt,
            isCorrection: e.isCorrection,
            originalEntryId: e.originalEntryId,
            correctionReason: e.correctionReason,
          }));
        }
      } catch {
        // fallback
      }
    }

    let list = IN_MEMORY_USAGE_LEDGER.filter((e) => e.merchantId === merchantId);
    if (metric) list = list.filter((e) => e.metric === metric);
    return list.slice(0, limit);
  }

  static clearCache(): void {
    IN_MEMORY_USAGE_LEDGER.length = 0;
    PROCESSED_USAGE_KEYS.clear();
  }
}

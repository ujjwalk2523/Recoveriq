import { prisma } from '@/lib/db/prisma';
import { AttemptStatus, PaymentStatus } from '@prisma/client';
import { defaultBanditService, BanditService } from './bandit-service';
import { BanditLedger } from './bandit-ledger';
import { AuditService } from '@/lib/services/audit.service';

export interface AttributePaymentCapturedParams {
  merchantId: string;
  transactionId?: string;
  orderId?: string;
  paymentId?: string;
  amountINR: number;
  eventId?: string;
}

export interface AttributeFailedRecoveryParams {
  merchantId: string;
  transactionId: string;
  attemptId?: string;
  reason?: string;
}

export interface AttributeSuppressedParams {
  merchantId: string;
  transactionId: string;
  decisionId: string;
}

export interface AttributionResult {
  success: boolean;
  status: 'LEARNED' | 'ALREADY_PROCESSED' | 'SKIPPED' | 'FAILED';
  decisionId?: string;
  action?: string;
  rawReward?: number;
  normalizedReward?: number;
  recoveredAmount?: number;
  recoveryCost?: number;
  fatiguePenalty?: number;
  riskPenalty?: number;
  isDuplicate?: boolean;
  message?: string;
}

// Configured standard fallback costs per action (INR)
export const ACTION_BASE_COSTS: Record<string, number> = {
  IMMEDIATE_RETRY: 3.50,
  OPTIMAL_DELAYED_RETRY: 3.50,
  PAYMENT_LINK: 8.00,
  WHATSAPP_NUDGE: 1.50,
  MANDATE_UPDATE: 12.00,
  HUMAN_ESCALATION: 45.00,
  DO_NOT_RECOVER: 0.0,
};

// In-memory processed attribution tracking for idempotency deduplication
const PROCESSED_ATTRIBUTION_KEYS = new Set<string>();

export class BanditOutcomeAttributionService {
  /**
   * Links payment.captured or order.paid events back to the originating BanditDecision,
   * calculates the economic net recovery surplus, and invokes the Bayesian posterior update.
   */
  static async attributePaymentCaptured(
    params: AttributePaymentCapturedParams,
    banditService: BanditService = defaultBanditService
  ): Promise<AttributionResult> {
    const { merchantId, transactionId, orderId, paymentId, amountINR, eventId } = params;

    // 1. Enforce Webhook/Event Idempotency (prevent order.paid + payment.captured double update)
    const idempotencyKey = `attr_${merchantId}_${transactionId || orderId || paymentId || 'unknown'}`;
    if (PROCESSED_ATTRIBUTION_KEYS.has(idempotencyKey)) {
      return {
        success: true,
        status: 'ALREADY_PROCESSED',
        isDuplicate: true,
        message: `Attribution for ${idempotencyKey} was already processed. Bayesian posterior preserved without duplicate update.`,
      };
    }

    // 2. Locate Transaction and its Recovery History
    let transaction: any = null;
    let isDbAvailable = true;

    if (process.env.SKIP_DB !== 'true') {
      try {
        transaction = await prisma.transaction.findFirst({
          where: {
            merchantId,
            OR: [
              ...(transactionId ? [{ id: transactionId }] : []),
              ...(orderId ? [{ orderId }] : []),
              ...(paymentId ? [{ paymentId }] : []),
            ],
          },
          include: {
            recoveryAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 3,
            },
            banditDecisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            customer: {
              include: { recoveryProfile: true },
            },
          },
        });
      } catch {
        isDbAvailable = false;
      }
    } else {
      isDbAvailable = false;
    }

    // Fallback: Check in-memory store if DB did not find transaction
    if (!transaction) {
      try {
        const { RazorpayWebhookService } = await import('@/lib/razorpay/webhooks');
        transaction = RazorpayWebhookService.getInMemoryTransaction(orderId || '') ||
          RazorpayWebhookService.getInMemoryTransaction(paymentId || '') ||
          RazorpayWebhookService.getInMemoryTransaction(transactionId || '');
      } catch {
        // ignore
      }
    }

    // 3. Check if transaction was already resolved previously
    if (transaction?.status === PaymentStatus.RECOVERED && (transaction?.banditDecisions?.[0]?.resolvedAt || transaction?.resolvedAt)) {
      PROCESSED_ATTRIBUTION_KEYS.add(idempotencyKey);
      return {
        success: true,
        status: 'ALREADY_PROCESSED',
        isDuplicate: true,
        decisionId: transaction.banditDecisions?.[0]?.id || transaction.banditDecisionId,
        action: transaction.banditDecisions?.[0]?.selectedAction || transaction.banditAction || transaction.recommendedAction,
        message: 'Transaction already marked RECOVERED with BanditDecision resolved.',
      };
    }

    // 4. Resolve Originating Bandit Decision
    let decisionId = transaction?.recoveryAttempts?.[0]?.banditDecisionId ||
      transaction?.banditDecisions?.[0]?.id ||
      transaction?.banditDecisionId;

    let selectedAction = transaction?.recoveryAttempts?.[0]?.banditAction ||
      transaction?.banditDecisions?.[0]?.selectedAction ||
      transaction?.banditAction ||
      transaction?.recommendedAction ||
      'OPTIMAL_DELAYED_RETRY';

    if (!decisionId) {
      decisionId = `bandit_dec_${transactionId || transaction?.id || orderId || 'txn_test'}`;
      const ledgerEntry = BanditLedger.getDecision(decisionId);
      if (ledgerEntry) {
        selectedAction = ledgerEntry.selectedAction;
      }
    }

    // 5. Determine Execution Cost
    const latestAttempt = transaction?.recoveryAttempts?.[0];
    const cost = latestAttempt?.cost && latestAttempt.cost > 0
      ? latestAttempt.cost
      : (ACTION_BASE_COSTS[selectedAction] ?? 3.50);

    // 6. Compute Fatigue & Risk Penalties from Customer Profile
    const fatigueScore = transaction?.customer?.recoveryProfile?.fatigueScore ?? 15;
    const riskScore = transaction?.customer?.recoveryProfile?.riskScore ?? 10;
    const fatiguePenalty = Math.round(((fatigueScore / 100) * 50) * 100) / 100; // max ₹50
    const riskPenalty = Math.round(((riskScore / 100) * 100) * 100) / 100; // max ₹100

    // 7. Calculate Net Recovery Reward
    // Reward = Recovered Revenue - Recovery Cost - Customer Experience Penalty - Risk Penalty
    const rawReward = Math.round((amountINR - cost - fatiguePenalty - riskPenalty) * 100) / 100;

    // 8. Transmit Outcome to Python Bandit Service
    let outcomeRes: any = null;
    try {
      outcomeRes = await banditService.reportOutcome({
        bandit_decision_id: decisionId,
        merchant_id: merchantId,
        transaction_id: transactionId || transaction?.id || 'txn_unknown',
        selected_action: selectedAction,
        recovered_amount: amountINR,
        recovery_cost: cost,
        experience_penalty: fatiguePenalty,
        risk_penalty: riskPenalty,
        outcome: 'RECOVERED',
        context_snapshot: transaction?.banditDecisions?.[0]?.contextSnapshot as any,
      });
    } catch (err: any) {
      console.warn(`[BanditOutcomeAttribution] Error transmitting outcome to Python bandit: ${err.message}`);
    }

    // 8.5 Closed-Loop Self-Improving Engine Dispatch (Phase 6.8)
    try {
      const { LearningOrchestrator } = await import('@/lib/ml/learning/learning-orchestrator');
      await LearningOrchestrator.processEvent({
        merchantId,
        transactionId: transactionId || transaction?.id || 'txn_unknown',
        customerId: transaction?.customerId || transaction?.customer?.id,
        banditDecisionId: decisionId,
        strategy: selectedAction,
        paymentMethod: transaction?.paymentMethod || 'upi',
        failureCategory: transaction?.failureCategory || 'TECHNICAL',
        amount: transaction?.amount || amountINR,
        recoveredAmount: amountINR,
        recoveryCost: cost,
        fatiguePenalty,
        riskPenalty,
        reward: rawReward,
        outcome: 'RECOVERY_SUCCEEDED',
        recoveryDelayMinutes: latestAttempt?.executedAt && latestAttempt?.completedAt
          ? Math.round((new Date(latestAttempt.completedAt).getTime() - new Date(latestAttempt.executedAt).getTime()) / (1000 * 60))
          : 15,
        dataSource: 'RAZORPAY_TEST',
      }, banditService);
    } catch (learnErr: any) {
      console.warn(`[BanditOutcomeAttribution] Learning engine dispatch error:`, learnErr.message);
    }

    // 8.6 Usage Metering for RECOVERED_TRANSACTIONS & RECOVERED_REVENUE (Phase 7.2)
    try {
      const { UsageService } = await import('@/lib/billing/usage-service');
      const { UsageMetric } = await import('@/lib/billing/billing-types');
      const txnKey = transactionId || transaction?.id || 'txn_unknown';

      await UsageService.recordUsage({
        merchantId,
        metric: UsageMetric.RECOVERED_TRANSACTIONS,
        quantity: 1,
        source: 'PAYMENT_CAPTURE',
        sourceId: txnKey,
        idempotencyKey: UsageService.buildRecoveredTxnKey(txnKey),
        occurredAt: new Date(),
      });

      await UsageService.recordUsage({
        merchantId,
        metric: UsageMetric.RECOVERED_REVENUE,
        quantity: Math.round(amountINR * 100), // stored in paise
        unit: 'MINOR_UNIT',
        amountMinor: Math.round(amountINR * 100),
        currency: 'INR',
        source: 'PAYMENT_CAPTURE',
        sourceId: txnKey,
        idempotencyKey: UsageService.buildRecoveredRevenueKey(txnKey),
        occurredAt: new Date(),
      });
    } catch {
      // Non-blocking
    }

    // 9. Update Database Ledger (BanditDecision & RecoveryAttempt)
    if (isDbAvailable && transaction) {
      try {
        if (decisionId) {
          await prisma.banditDecision.updateMany({
            where: { id: decisionId },
            data: {
              actualReward: rawReward,
              outcome: 'RECOVERED',
              recoveredAmount: amountINR,
              resolvedAt: new Date(),
            },
          });
        }

        if (latestAttempt) {
          await prisma.recoveryAttempt.update({
            where: { id: latestAttempt.id },
            data: {
              outcome: 'RECOVERED',
              recoveredAmount: amountINR,
              status: AttemptStatus.PAID,
              completedAt: new Date(),
            },
          });
        }
      } catch {
        // resilient
      }
    }

    // Mark in-memory key as processed
    PROCESSED_ATTRIBUTION_KEYS.add(idempotencyKey);

    // 10. Audit Trail
    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'WEBHOOK_INGEST',
        actorName: 'BanditOutcomeAttributionService',
        action: 'BANDIT_OUTCOME_LEARNED',
        entityType: 'BANDIT_DECISION',
        entityId: decisionId,
        details: `Closed-loop bandit outcome learned for action ${selectedAction}: Recovered ₹${amountINR.toLocaleString('en-IN')}, Cost ₹${cost}, Net Reward: ₹${rawReward.toLocaleString('en-IN')}.`,
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      status: outcomeRes?.status === 'ALREADY_PROCESSED' ? 'ALREADY_PROCESSED' : 'LEARNED',
      decisionId,
      action: selectedAction,
      rawReward,
      normalizedReward: outcomeRes?.normalized_reward,
      recoveredAmount: amountINR,
      recoveryCost: cost,
      fatiguePenalty,
      riskPenalty,
      isDuplicate: outcomeRes?.is_idempotent_duplicate || false,
    };
  }

  /**
   * Records a failed or expired recovery attempt as negative economic reward,
   * allowing the bandit to learn from negative outcomes.
   */
  static async attributeFailedRecovery(
    params: AttributeFailedRecoveryParams,
    banditService: BanditService = defaultBanditService
  ): Promise<AttributionResult> {
    const { merchantId, transactionId, attemptId, reason = 'PAYMENT_EXPIRED' } = params;

    const idempotencyKey = `attr_failed_${merchantId}_${transactionId}_${attemptId || '1'}`;
    if (PROCESSED_ATTRIBUTION_KEYS.has(idempotencyKey)) {
      return {
        success: true,
        status: 'ALREADY_PROCESSED',
        isDuplicate: true,
        message: 'Failed recovery attribution already processed.',
      };
    }

    let transaction: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        transaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: {
            recoveryAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
            banditDecisions: { orderBy: { createdAt: 'desc' }, take: 1 },
            customer: { include: { recoveryProfile: true } },
          },
        });
      } catch {
        // ignore
      }
    }

    const decisionId = transaction?.recoveryAttempts?.[0]?.banditDecisionId ||
      transaction?.banditDecisions?.[0]?.id ||
      `bandit_dec_${transactionId}`;

    const selectedAction = transaction?.recoveryAttempts?.[0]?.banditAction ||
      transaction?.banditDecisions?.[0]?.selectedAction ||
      transaction?.recommendedAction ||
      'PAYMENT_LINK';

    const cost = ACTION_BASE_COSTS[selectedAction] ?? 8.00;
    const fatigueScore = transaction?.customer?.recoveryProfile?.fatigueScore ?? 20;
    const riskScore = transaction?.customer?.recoveryProfile?.riskScore ?? 10;
    const fatiguePenalty = Math.round(((fatigueScore / 100) * 50) * 100) / 100;
    const riskPenalty = Math.round(((riskScore / 100) * 100) * 100) / 100;

    // Negative Reward = 0 - Cost - Fatigue - Risk
    const rawReward = Math.round((0.0 - cost - fatiguePenalty - riskPenalty) * 100) / 100;

    let outcomeRes: any = null;
    try {
      outcomeRes = await banditService.reportOutcome({
        bandit_decision_id: decisionId,
        merchant_id: merchantId,
        transaction_id: transactionId,
        selected_action: selectedAction,
        recovered_amount: 0.0,
        recovery_cost: cost,
        experience_penalty: fatiguePenalty,
        risk_penalty: riskPenalty,
        outcome: 'FAILED',
        context_snapshot: transaction?.banditDecisions?.[0]?.contextSnapshot as any,
      });
    } catch (err: any) {
      console.warn(`[BanditOutcomeAttribution] Error sending failed outcome: ${err.message}`);
    }

    // Phase 6.8 Closed-Loop Learning Event for Failed Recovery
    try {
      const { LearningOrchestrator } = await import('@/lib/ml/learning/learning-orchestrator');
      await LearningOrchestrator.processEvent({
        merchantId,
        transactionId,
        customerId: transaction?.customerId || transaction?.customer?.id,
        banditDecisionId: decisionId,
        strategy: selectedAction,
        paymentMethod: transaction?.paymentMethod || 'upi',
        failureCategory: transaction?.failureCategory || 'TECHNICAL',
        amount: transaction?.amount || 0,
        recoveredAmount: 0.0,
        recoveryCost: cost,
        fatiguePenalty,
        riskPenalty,
        reward: rawReward,
        outcome: 'RECOVERY_FAILED',
        dataSource: 'RAZORPAY_TEST',
      }, banditService);
    } catch (learnErr: any) {
      console.warn(`[BanditOutcomeAttribution] Learning engine dispatch error:`, learnErr.message);
    }

    PROCESSED_ATTRIBUTION_KEYS.add(idempotencyKey);

    return {
      success: true,
      status: 'LEARNED',
      decisionId,
      action: selectedAction,
      rawReward,
      normalizedReward: outcomeRes?.normalized_reward,
      recoveredAmount: 0.0,
      recoveryCost: cost,
      fatiguePenalty,
      riskPenalty,
      isDuplicate: false,
    };
  }

  /**
   * Resets in-memory idempotency caches (for tests)
   */
  static clearCaches(): void {
    PROCESSED_ATTRIBUTION_KEYS.clear();
  }
}

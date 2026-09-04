import { prisma } from '@/lib/db/prisma';
import { RecoveryLearningEventPayload, LearningResult } from './learning-types';
import { CustomerMemoryUpdater } from './customer-memory-updater';
import { StrategyMemoryUpdater } from './strategy-memory-updater';
import { TimingMemoryUpdater } from './timing-memory-updater';
import { FailurePatternUpdater } from './failure-pattern-updater';
import { AnomalyDetector } from './anomaly-detector';
import { MerchantMemoryUpdater } from './merchant-memory-updater';
import { defaultBanditService, BanditService } from '../bandit/bandit-service';
import { AuditService } from '@/lib/services/audit.service';

// In-memory processed learning event set for strict idempotency
const PROCESSED_LEARNING_EVENTS = new Set<string>();
const IN_MEMORY_LEARNING_EVENTS = new Map<string, RecoveryLearningEventPayload>();

export class LearningOrchestrator {
  /**
   * Universal ingestion for closed-loop recovery outcomes.
   * Dispatches statistical updates across Customer, Merchant, Strategy, Timing,
   * Failure Pattern memories, and the Bayesian Bandit posterior.
   */
  static async processEvent(
    payload: RecoveryLearningEventPayload,
    banditService: BanditService = defaultBanditService
  ): Promise<LearningResult> {
    const { merchantId, transactionId, strategy, outcome } = payload;
    const learningEventId = `learn_${merchantId}_${transactionId}_${strategy}_${outcome}`;
    const isDbAvailable = process.env.SKIP_DB !== 'true';

    // 1. Strict Idempotency Check
    if (PROCESSED_LEARNING_EVENTS.has(learningEventId)) {
      return {
        success: true,
        status: 'ALREADY_PROCESSED',
        learningEventId,
        isDuplicate: true,
        customerMemoryUpdated: false,
        merchantIntelligenceUpdated: false,
        strategyMemoryUpdated: false,
        timingMemoryUpdated: false,
        failurePatternUpdated: false,
        banditPosteriorUpdated: false,
        anomaliesDetected: 0,
        message: 'Recovery learning event was already processed. Duplicate update safely skipped.',
      };
    }

    if (isDbAvailable) {
      try {
        const existing = await prisma.recoveryLearningEvent.findUnique({
          where: { id: learningEventId },
        });
        if (existing) {
          PROCESSED_LEARNING_EVENTS.add(learningEventId);
          return {
            success: true,
            status: 'ALREADY_PROCESSED',
            learningEventId,
            isDuplicate: true,
            customerMemoryUpdated: false,
            merchantIntelligenceUpdated: false,
            strategyMemoryUpdated: false,
            timingMemoryUpdated: false,
            failurePatternUpdated: false,
            banditPosteriorUpdated: false,
            anomaliesDetected: 0,
            message: 'Learning event already recorded in DB.',
          };
        }
      } catch {
        // resilient fallback
      }
    }

    // 2. Execute Statistical Memory Updates
    let custUpdated = false;
    let stratUpdated = false;
    let timingUpdated = false;
    let failureUpdated = false;
    let merchUpdated = false;
    let banditUpdated = false;
    let anomaliesCount = 0;

    try {
      // Prior strategy rate for anomaly detection
      const prevStrat = StrategyMemoryUpdater.getStrategy(merchantId, strategy);
      const prevRate = prevStrat?.recoveryRate;

      // A. Update Customer Memory
      custUpdated = await CustomerMemoryUpdater.updateMemory(payload);

      // B. Update Strategy Memory
      const stratMetrics = await StrategyMemoryUpdater.updateMemory(payload);
      stratUpdated = true;

      // C. Update Timing Memory
      await TimingMemoryUpdater.updateMemory(payload);
      timingUpdated = true;

      // D. Update Failure Pattern Memory
      await FailurePatternUpdater.updateMemory(payload);
      failureUpdated = true;

      // E. Anomaly Detection
      const anomaly = await AnomalyDetector.evaluateStrategy(merchantId, stratMetrics, prevRate);
      if (anomaly) anomaliesCount += 1;

      // F. Update Merchant Aggregate Intelligence
      await MerchantMemoryUpdater.updateMemory(payload);
      merchUpdated = true;

      // G. Update Bayesian Bandit Posterior (if decisionId exists and outcome was not yet submitted)
      if (payload.banditDecisionId) {
        try {
          const outcomeRes = await banditService.reportOutcome({
            bandit_decision_id: payload.banditDecisionId,
            merchant_id: merchantId,
            transaction_id: transactionId,
            selected_action: strategy,
            recovered_amount: payload.recoveredAmount,
            recovery_cost: payload.recoveryCost,
            experience_penalty: payload.fatiguePenalty,
            risk_penalty: payload.riskPenalty,
            outcome: outcome === 'RECOVERY_SUCCEEDED' ? 'RECOVERED' : 'FAILED',
          });
          banditUpdated = outcomeRes?.status === 'LEARNED';
        } catch (banditErr: any) {
          console.warn(`[LearningOrchestrator] Bandit posterior update bypassed: ${banditErr.message}`);
        }
      }

      // Mark as processed
      PROCESSED_LEARNING_EVENTS.add(learningEventId);
      IN_MEMORY_LEARNING_EVENTS.set(learningEventId, payload);

      // Persist Learning Event
      if (isDbAvailable) {
        try {
          await prisma.recoveryLearningEvent.create({
            data: {
              id: learningEventId,
              merchantId,
              transactionId,
              customerId: payload.customerId,
              banditDecisionId: payload.banditDecisionId,
              strategy,
              timingBucket: payload.timingBucket,
              paymentMethod: payload.paymentMethod,
              failureCategory: payload.failureCategory,
              amount: payload.amount,
              recoveredAmount: payload.recoveredAmount,
              recoveryCost: payload.recoveryCost,
              fatiguePenalty: payload.fatiguePenalty,
              riskPenalty: payload.riskPenalty,
              reward: payload.reward,
              outcome,
              recoveryDelayMinutes: payload.recoveryDelayMinutes,
              dataSource: payload.dataSource || 'RAZORPAY_TEST',
              modelVersion: payload.modelVersion || 'RecoverIQ-Intelligence-v1.0',
              status: 'COMPLETED',
            },
          });
        } catch {
          // resilient
        }
      }

      // Audit Log
      try {
        await AuditService.logEvent({
          merchantId,
          actorType: 'LEARNING_ENGINE',
          actorName: 'LearningOrchestrator v1.0',
          action: 'RECOVERY_LEARNING_EVENT_PROCESSED',
          entityType: 'LEARNING_EVENT',
          entityId: learningEventId,
          details: `Processed ${outcome} for strategy ${strategy}. Reward: ₹${payload.reward.toLocaleString('en-IN')}. Memory updated.`,
        });
      } catch {
        // ignore
      }

      return {
        success: true,
        status: 'COMPLETED',
        learningEventId,
        customerMemoryUpdated: custUpdated,
        merchantIntelligenceUpdated: merchUpdated,
        strategyMemoryUpdated: stratUpdated,
        timingMemoryUpdated: timingUpdated,
        failurePatternUpdated: failureUpdated,
        banditPosteriorUpdated: banditUpdated,
        anomaliesDetected: anomaliesCount,
      };
    } catch (err: any) {
      console.error(`[LearningOrchestrator] Error processing learning event:`, err);
      return {
        success: false,
        status: 'FAILED',
        learningEventId,
        customerMemoryUpdated: custUpdated,
        merchantIntelligenceUpdated: merchUpdated,
        strategyMemoryUpdated: stratUpdated,
        timingMemoryUpdated: timingUpdated,
        failurePatternUpdated: failureUpdated,
        banditPosteriorUpdated: banditUpdated,
        anomaliesDetected: anomaliesCount,
        message: err.message,
      };
    }
  }

  static getLearningEvents(merchantId?: string): RecoveryLearningEventPayload[] {
    const list = Array.from(IN_MEMORY_LEARNING_EVENTS.values());
    if (merchantId) {
      return list.filter((e) => e.merchantId === merchantId);
    }
    return list;
  }

  static clearCache(): void {
    PROCESSED_LEARNING_EVENTS.clear();
    IN_MEMORY_LEARNING_EVENTS.clear();
    CustomerMemoryUpdater.clearCache();
    StrategyMemoryUpdater.clearCache();
    TimingMemoryUpdater.clearCache();
    FailurePatternUpdater.clearCache();
    AnomalyDetector.clearCache();
    MerchantMemoryUpdater.clearCache();
  }
}

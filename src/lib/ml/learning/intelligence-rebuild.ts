import { prisma } from '@/lib/db/prisma';
import { RecoveryLearningEventPayload } from './learning-types';
import { CustomerMemoryUpdater, IN_MEMORY_CUSTOMER_MEMORIES } from './customer-memory-updater';
import { StrategyMemoryUpdater, IN_MEMORY_STRATEGY_MEMORIES } from './strategy-memory-updater';
import { TimingMemoryUpdater, IN_MEMORY_TIMING_MEMORIES } from './timing-memory-updater';
import { FailurePatternUpdater, IN_MEMORY_FAILURE_PATTERNS } from './failure-pattern-updater';
import { MerchantMemoryUpdater, IN_MEMORY_MERCHANT_INTELLIGENCE } from './merchant-memory-updater';
import { AnomalyDetector, IN_MEMORY_ANOMALIES } from './anomaly-detector';

export interface RebuildReport {
  rebuiltEventsCount: number;
  distinctMerchants: number;
  distinctCustomers: number;
  distinctStrategies: number;
  banditReTrained: false; // Invariant: Bandit must NEVER be re-trained during rebuild
  durationMs: number;
}

export class IntelligenceRebuildService {
  /**
   * Safely rebuilds all derived statistical intelligence from raw historical learning events.
   * STRICT INVARIANT: ZERO bandit posterior updates are triggered during rebuild.
   */
  static async rebuildIntelligence(eventsList?: RecoveryLearningEventPayload[]): Promise<RebuildReport> {
    const startTime = Date.now();
    const isDbAvailable = process.env.SKIP_DB !== 'true';

    // 1. Fetch raw events
    let events: RecoveryLearningEventPayload[] = eventsList || [];
    if (events.length === 0 && isDbAvailable) {
      try {
        const dbEvents = await prisma.recoveryLearningEvent.findMany({
          orderBy: { createdAt: 'asc' },
        });
        events = dbEvents.map((e) => ({
          merchantId: e.merchantId,
          transactionId: e.transactionId,
          customerId: e.customerId || undefined,
          banditDecisionId: undefined, // Cleared to prevent ANY bandit update during replay
          strategy: e.strategy,
          timingBucket: e.timingBucket || undefined,
          paymentMethod: e.paymentMethod,
          failureCategory: e.failureCategory,
          amount: e.amount,
          recoveredAmount: e.recoveredAmount,
          recoveryCost: e.recoveryCost,
          fatiguePenalty: e.fatiguePenalty,
          riskPenalty: e.riskPenalty,
          reward: e.reward,
          outcome: e.outcome as any,
          recoveryDelayMinutes: e.recoveryDelayMinutes || undefined,
          dataSource: e.dataSource as any,
          modelVersion: e.modelVersion,
          timestamp: e.createdAt.toISOString(),
        }));
      } catch {
        // resilient
      }
    }

    // 2. Clear all derived in-memory intelligence
    IN_MEMORY_CUSTOMER_MEMORIES.clear();
    IN_MEMORY_STRATEGY_MEMORIES.clear();
    IN_MEMORY_TIMING_MEMORIES.clear();
    IN_MEMORY_FAILURE_PATTERNS.clear();
    IN_MEMORY_MERCHANT_INTELLIGENCE.clear();
    IN_MEMORY_ANOMALIES.length = 0;

    const merchants = new Set<string>();
    const customers = new Set<string>();
    const strategies = new Set<string>();

    // 3. Replay all events sequentially through derived updaters
    for (const ev of events) {
      merchants.add(ev.merchantId);
      if (ev.customerId) customers.add(ev.customerId);
      strategies.add(ev.strategy);

      // Replay through memory updaters WITHOUT bandit
      await CustomerMemoryUpdater.updateMemory(ev);
      const stratMetrics = await StrategyMemoryUpdater.updateMemory(ev);
      await TimingMemoryUpdater.updateMemory(ev);
      await FailurePatternUpdater.updateMemory(ev);
      await AnomalyDetector.evaluateStrategy(ev.merchantId, stratMetrics);
      await MerchantMemoryUpdater.updateMemory(ev);
    }

    return {
      rebuiltEventsCount: events.length,
      distinctMerchants: merchants.size,
      distinctCustomers: customers.size,
      distinctStrategies: strategies.size,
      banditReTrained: false,
      durationMs: Date.now() - startTime,
    };
  }
}

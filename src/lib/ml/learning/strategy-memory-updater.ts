import { RecoveryLearningEventPayload, StrategyPerformanceMetrics } from './learning-types';
import { DecayEngine } from './decay-engine';
import { ConfidenceEngine } from './confidence-engine';

// In-memory strategy memory store: merchantId -> Map<strategy, StrategyPerformanceMetrics>
export const IN_MEMORY_STRATEGY_MEMORIES = new Map<string, Map<string, StrategyPerformanceMetrics>>();

export class StrategyMemoryUpdater {
  /**
   * Updates merchant-scoped strategy performance metrics.
   */
  static async updateMemory(event: RecoveryLearningEventPayload): Promise<StrategyPerformanceMetrics> {
    const { merchantId, strategy, outcome, recoveredAmount, recoveryCost, reward, recoveryDelayMinutes } = event;
    const isSuccess = outcome === 'RECOVERY_SUCCEEDED';

    let merchantStrategies = IN_MEMORY_STRATEGY_MEMORIES.get(merchantId);
    if (!merchantStrategies) {
      merchantStrategies = new Map();
      IN_MEMORY_STRATEGY_MEMORIES.set(merchantId, merchantStrategies);
    }

    let stats = merchantStrategies.get(strategy);
    if (!stats) {
      stats = {
        strategy,
        attempts: 0,
        successes: 0,
        failures: 0,
        recoveryRate: 0.5,
        rawSuccessRate: 0.0,
        recoveredRevenue: 0.0,
        recoveryCost: 0.0,
        netRecoveryRevenue: 0.0,
        averageReward: 0.0,
        averageDelayMinutes: 30.0,
        evidenceLevel: 'LOW',
        lastObservedAt: new Date().toISOString(),
      };
      merchantStrategies.set(strategy, stats);
    }

    // 1. Update counters
    stats.attempts += 1;
    if (isSuccess) {
      stats.successes += 1;
      stats.recoveredRevenue += recoveredAmount;
      if (recoveryDelayMinutes !== undefined) {
        stats.averageDelayMinutes = stats.successes === 1
          ? recoveryDelayMinutes
          : Math.round(((stats.averageDelayMinutes * (stats.successes - 1) + recoveryDelayMinutes) / stats.successes) * 10) / 10;
      }
    } else {
      stats.failures += 1;
    }

    stats.recoveryCost += recoveryCost;
    stats.netRecoveryRevenue = Math.round((stats.recoveredRevenue - stats.recoveryCost) * 100) / 100;
    stats.rawSuccessRate = Math.round((stats.successes / stats.attempts) * 10000) / 10000;
    stats.recoveryRate = DecayEngine.smoothRate(stats.successes, stats.attempts);

    // Incremental average reward
    stats.averageReward = Math.round(((stats.averageReward * (stats.attempts - 1) + reward) / stats.attempts) * 100) / 100;
    stats.evidenceLevel = ConfidenceEngine.getEvidenceTier(stats.attempts);
    stats.lastObservedAt = event.timestamp || new Date().toISOString();

    return { ...stats };
  }

  /**
   * Retrieves all strategy performance records for a merchant.
   */
  static getMerchantStrategies(merchantId: string): StrategyPerformanceMetrics[] {
    const map = IN_MEMORY_STRATEGY_MEMORIES.get(merchantId);
    if (!map) return [];
    return Array.from(map.values());
  }

  static getStrategy(merchantId: string, strategy: string): StrategyPerformanceMetrics | undefined {
    return IN_MEMORY_STRATEGY_MEMORIES.get(merchantId)?.get(strategy);
  }

  static clearCache(): void {
    IN_MEMORY_STRATEGY_MEMORIES.clear();
  }
}

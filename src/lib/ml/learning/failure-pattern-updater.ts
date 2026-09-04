import { RecoveryLearningEventPayload, FailurePatternPerformanceMetrics } from './learning-types';
import { DecayEngine } from './decay-engine';

// In-memory pattern store: merchantId -> Map<key, FailurePatternPerformanceMetrics>
export const IN_MEMORY_FAILURE_PATTERNS = new Map<string, Map<string, FailurePatternPerformanceMetrics>>();

export class FailurePatternUpdater {
  /**
   * Resolves transaction amount into discrete amount band.
   */
  static resolveAmountBand(amount: number): string {
    if (amount <= 2000) return 'MICRO';
    if (amount <= 10000) return 'STANDARD';
    if (amount <= 50000) return 'HIGH';
    return 'ENTERPRISE';
  }

  /**
   * Updates failure pattern statistics based on recovery outcome.
   */
  static async updateMemory(event: RecoveryLearningEventPayload): Promise<FailurePatternPerformanceMetrics> {
    const { merchantId, failureCategory, paymentMethod, amount, outcome, strategy, reward } = event;
    const isSuccess = outcome === 'RECOVERY_SUCCEEDED';
    const amountBand = FailurePatternUpdater.resolveAmountBand(amount);
    const key = `${failureCategory}:${paymentMethod}:${amountBand}`;

    let merchantPatterns = IN_MEMORY_FAILURE_PATTERNS.get(merchantId);
    if (!merchantPatterns) {
      merchantPatterns = new Map();
      IN_MEMORY_FAILURE_PATTERNS.set(merchantId, merchantPatterns);
    }

    let stats = merchantPatterns.get(key);
    if (!stats) {
      stats = {
        key,
        failureCategory,
        paymentMethod,
        amountBand,
        attempts: 0,
        successes: 0,
        recoveryRate: 0.5,
        bestStrategy: strategy,
        averageReward: 0.0,
        lastObservedAt: new Date().toISOString(),
      };
      merchantPatterns.set(key, stats);
    }

    stats.attempts += 1;
    if (isSuccess) {
      stats.successes += 1;
      stats.bestStrategy = strategy; // most recent successful strategy
    }

    stats.recoveryRate = DecayEngine.smoothRate(stats.successes, stats.attempts);
    stats.averageReward = Math.round(((stats.averageReward * (stats.attempts - 1) + reward) / stats.attempts) * 100) / 100;
    stats.lastObservedAt = event.timestamp || new Date().toISOString();

    return { ...stats };
  }

  static getMerchantPatterns(merchantId: string): FailurePatternPerformanceMetrics[] {
    const map = IN_MEMORY_FAILURE_PATTERNS.get(merchantId);
    if (!map) return [];
    return Array.from(map.values());
  }

  static clearCache(): void {
    IN_MEMORY_FAILURE_PATTERNS.clear();
  }
}

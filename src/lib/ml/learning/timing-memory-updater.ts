import { RecoveryLearningEventPayload, TimingBucketPerformanceMetrics } from './learning-types';
import { DecayEngine } from './decay-engine';
import { ConfidenceEngine } from './confidence-engine';

// In-memory timing store: merchantId -> Map<bucket, TimingBucketPerformanceMetrics>
export const IN_MEMORY_TIMING_MEMORIES = new Map<string, Map<string, TimingBucketPerformanceMetrics>>();

export class TimingMemoryUpdater {
  /**
   * Resolves delay in minutes into canonical timing bucket.
   */
  static resolveBucket(delayMinutes?: number): string {
    if (delayMinutes === undefined || delayMinutes <= 2) return 'IMMEDIATE_0M';
    if (delayMinutes <= 20) return 'SHORT_5_15M';
    if (delayMinutes <= 90) return 'MEDIUM_30_60M';
    return 'LONG_2_4H';
  }

  /**
   * Updates timing bucket metrics based on recovery outcome.
   */
  static async updateMemory(event: RecoveryLearningEventPayload): Promise<TimingBucketPerformanceMetrics> {
    const { merchantId, outcome, reward, recoveryDelayMinutes } = event;
    const isSuccess = outcome === 'RECOVERY_SUCCEEDED';
    const bucket = event.timingBucket || TimingMemoryUpdater.resolveBucket(recoveryDelayMinutes);

    let merchantTiming = IN_MEMORY_TIMING_MEMORIES.get(merchantId);
    if (!merchantTiming) {
      merchantTiming = new Map();
      IN_MEMORY_TIMING_MEMORIES.set(merchantId, merchantTiming);
    }

    let stats = merchantTiming.get(bucket);
    if (!stats) {
      stats = {
        bucket,
        attempts: 0,
        successes: 0,
        recoveryRate: 0.5,
        averageReward: 0.0,
        averageDelayMinutes: recoveryDelayMinutes ?? 15.0,
        evidenceLevel: 'LOW',
        lastObservedAt: new Date().toISOString(),
      };
      merchantTiming.set(bucket, stats);
    }

    stats.attempts += 1;
    if (isSuccess) {
      stats.successes += 1;
      if (recoveryDelayMinutes !== undefined) {
        stats.averageDelayMinutes = stats.successes === 1
          ? recoveryDelayMinutes
          : Math.round(((stats.averageDelayMinutes * (stats.successes - 1) + recoveryDelayMinutes) / stats.successes) * 10) / 10;
      }
    }

    stats.recoveryRate = DecayEngine.smoothRate(stats.successes, stats.attempts);
    stats.averageReward = Math.round(((stats.averageReward * (stats.attempts - 1) + reward) / stats.attempts) * 100) / 100;
    stats.evidenceLevel = ConfidenceEngine.getEvidenceTier(stats.attempts);
    stats.lastObservedAt = event.timestamp || new Date().toISOString();

    return { ...stats };
  }

  static getMerchantTiming(merchantId: string): TimingBucketPerformanceMetrics[] {
    const map = IN_MEMORY_TIMING_MEMORIES.get(merchantId);
    if (!map) return [];
    return Array.from(map.values());
  }

  static clearCache(): void {
    IN_MEMORY_TIMING_MEMORIES.clear();
  }
}

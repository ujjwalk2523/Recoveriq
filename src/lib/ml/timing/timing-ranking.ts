import { RecoveryStrategyClass } from '../models/model-types';
import {
  ALL_TIME_BUCKETS,
  RankedTimeBucket,
  TimeBucket,
  TIME_BUCKET_TYPICAL_DELAYS,
  TimingRankingResult,
} from './timing-types';
import { TimingScorer } from './timing-scorer';

export class TimingRankingEngine {
  /**
   * Ranks all 7 time buckets by Net Expected Value (EV) and resolves the optimal operational delay
   */
  static rankTimingBuckets(params: {
    transactionId: string;
    amount: number;
    strategy: RecoveryStrategyClass;
    bucketProbabilities: Record<TimeBucket, number>;
    baseRecoveryProbability: number;
    hour: number;
    fatigueScore: number;
  }): TimingRankingResult {
    const {
      transactionId,
      amount,
      strategy,
      bucketProbabilities,
      baseRecoveryProbability,
      hour,
      fatigueScore,
    } = params;

    const scoredBuckets: Omit<RankedTimeBucket, 'rank'>[] = ALL_TIME_BUCKETS.map(bucket => {
      const prob = bucketProbabilities[bucket] ?? 0.0;
      const scored = TimingScorer.calculateTimeNetEV({
        bucket,
        bucketProbability: prob,
        baseRecoveryProbability,
        strategy,
        amount,
        hour,
        fatigueScore,
      });

      return {
        bucket,
        typicalDelayMinutes: TIME_BUCKET_TYPICAL_DELAYS[bucket] ?? -1,
        probability: prob,
        conditionalRecoveryProbability: scored.conditionalRecoveryProbability,
        expectedGrossRecovery: scored.expectedGrossRecovery,
        costs: scored.costs,
        netEV: scored.netEV,
      };
    });

    // Sort descending by Net EV, secondarily by bucket probability
    scoredBuckets.sort((a, b) => {
      if (b.netEV !== a.netEV) return b.netEV - a.netEV;
      return b.probability - a.probability;
    });

    const rankedBuckets: RankedTimeBucket[] = scoredBuckets.map((b, idx) => ({
      ...b,
      rank: idx + 1,
    }));

    const optimalBucket = rankedBuckets[0]!;

    return {
      transactionId,
      amount,
      strategy,
      rankedBuckets,
      optimalBucket,
      optimalDelayMinutes: optimalBucket.typicalDelayMinutes,
      generatedAt: new Date().toISOString(),
      isShadowOnly: true,
    };
  }

  /**
   * Generates a readable audit table of Top-3 time windows
   */
  static formatTimingRankingSummary(result: TimingRankingResult): string[] {
    const lines: string[] = [];
    lines.push(
      `Recovery Timing Net EV Ranking for Txn ${result.transactionId} (₹${result.amount.toLocaleString('en-IN')}, Strategy: ${result.strategy}):`
    );

    for (let i = 0; i < Math.min(3, result.rankedBuckets.length); i++) {
      const b = result.rankedBuckets[i]!;
      lines.push(
        `  ${b.rank}. ${b.bucket.padEnd(16)} (~${b.typicalDelayMinutes}m) | Net EV: ₹${b.netEV.toLocaleString('en-IN').padStart(8)} | P(Window): ${(b.probability * 100).toFixed(1).padStart(5)}% | Est. Gross: ₹${b.expectedGrossRecovery.toLocaleString('en-IN')} | Costs: ₹${b.costs.totalCost}`
      );
    }

    return lines;
  }
}

import { RecoveryStrategyClass } from '../models/model-types';
import { RankedTimeBucket, TimeBucket, TIME_BUCKET_TYPICAL_DELAYS } from './timing-types';
import { DEFAULT_STRATEGY_COSTS } from '../strategy/strategy-scorer';

export class TimingScorer {
  /**
   * Calculates Net EV for a strategy executed in a specific Time Bucket
   */
  static calculateTimeNetEV(params: {
    bucket: TimeBucket;
    bucketProbability: number;
    baseRecoveryProbability: number;
    strategy: RecoveryStrategyClass;
    amount: number;
    hour: number;
    fatigueScore: number;
  }): {
    conditionalRecoveryProbability: number;
    expectedGrossRecovery: number;
    costs: RankedTimeBucket['costs'];
    netEV: number;
  } {
    const {
      bucket,
      bucketProbability,
      baseRecoveryProbability,
      strategy,
      amount,
      hour,
      fatigueScore,
    } = params;

    if (bucket === 'DO_NOT_CONTACT' || strategy === 'DO_NOT_RECOVER') {
      return {
        conditionalRecoveryProbability: 0.0,
        expectedGrossRecovery: 0.0,
        costs: { directCost: 0, fatiguePenalty: 0, decayPenalty: 0, totalCost: 0 },
        netEV: 0.0,
      };
    }

    // 1. Intent Decay Factor over time
    const decayFactors: Record<TimeBucket, number> = {
      IMMEDIATE: 1.0,
      VERY_SOON: 0.98,
      SHORT_DELAY: 0.94,
      MEDIUM_DELAY: 0.86,
      LONG_DELAY: 0.76,
      NEXT_DAY: 0.68,
      DO_NOT_CONTACT: 0.0,
    };

    const decay = decayFactors[bucket] ?? 0.80;

    // 2. Conditional Recovery Probability: modulated by model bucket confidence & decay
    const efficacy = 0.70 + 0.60 * bucketProbability;
    const condProb = Math.min(0.99, Math.max(0.01, baseRecoveryProbability * efficacy * decay));

    // 3. Expected Gross Recovery
    const expectedGross = condProb * amount;

    // 4. Costs & Penalties
    const baseDirectCost = DEFAULT_STRATEGY_COSTS[strategy]?.directCost ?? 1.0;

    // Off-hours penalty: contacting customer between 22:00 and 08:00
    const isNight = hour >= 22 || hour < 8;
    const isIntrusive = strategy === 'WHATSAPP_NUDGE' || strategy === 'HUMAN_ESCALATION';
    const offHoursPenalty = isNight && isIntrusive && (bucket === 'IMMEDIATE' || bucket === 'VERY_SOON')
      ? Math.min(100, amount * 0.04)
      : 0;

    const fatiguePenalty = (fatigueScore / 100) * 8.0 + offHoursPenalty;
    const decayPenalty = (1.0 - decay) * Math.min(200, amount * 0.03);

    const totalCost = baseDirectCost + fatiguePenalty + decayPenalty;
    const netEV = expectedGross - totalCost;

    return {
      conditionalRecoveryProbability: Number(condProb.toFixed(4)),
      expectedGrossRecovery: Number(expectedGross.toFixed(2)),
      costs: {
        directCost: Number(baseDirectCost.toFixed(2)),
        fatiguePenalty: Number(fatiguePenalty.toFixed(2)),
        decayPenalty: Number(decayPenalty.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
      },
      netEV: Number(netEV.toFixed(2)),
    };
  }
}

import { DriftReport, DriftStatus, PSIMetric } from './observability-types';

export class DriftDetector {
  /**
   * Calculates Population Stability Index (PSI) between a baseline and current distribution
   */
  static calculatePSI(
    name: string,
    baselineCounts: Record<string, number>,
    currentCounts: Record<string, number>
  ): PSIMetric {
    const allKeys = Array.from(
      new Set([...Object.keys(baselineCounts), ...Object.keys(currentCounts)])
    );

    const totalBase = Object.values(baselineCounts).reduce((s, v) => s + v, 0) || 1;
    const totalCurr = Object.values(currentCounts).reduce((s, v) => s + v, 0) || 1;

    const baselineDistribution: Record<string, number> = {};
    const currentDistribution: Record<string, number> = {};

    let psi = 0;
    const eps = 0.0001; // Epsilon to handle zero probabilities safely

    for (const key of allKeys) {
      const p_act = (currentCounts[key] || 0) / totalCurr;
      const q_base = (baselineCounts[key] || 0) / totalBase;

      baselineDistribution[key] = Number(q_base.toFixed(4));
      currentDistribution[key] = Number(p_act.toFixed(4));

      const p_safe = Math.max(eps, p_act);
      const q_safe = Math.max(eps, q_base);

      psi += (p_safe - q_safe) * Math.log(p_safe / q_safe);
    }

    const finalPsi = Number(Math.max(0, psi).toFixed(4));

    let status: DriftStatus = 'STABLE';
    if (finalPsi >= 0.25) {
      status = 'CRITICAL';
    } else if (finalPsi >= 0.10) {
      status = 'WARNING';
    }

    return {
      name,
      psi: finalPsi,
      status,
      baselineDistribution,
      currentDistribution,
    };
  }

  /**
   * Evaluates comprehensive multi-dimensional drift
   */
  static evaluateDrift(params: {
    baselineFeatures: {
      payment_method: Record<string, number>;
      failure_category: Record<string, number>;
    };
    currentFeatures: {
      payment_method: Record<string, number>;
      failure_category: Record<string, number>;
    };
    baselinePredictions: number[]; // probabilities [0, 1]
    currentPredictions: number[];
    baselineRecoveryRate: number; // e.g. 0.72
    currentRecoveryRate: number; // e.g. 0.54
    baselineSegmentOutcomes?: Record<string, number>;
    currentSegmentOutcomes?: Record<string, number>;
    baselineStrategies?: Record<string, number>;
    currentStrategies?: Record<string, number>;
    baselineTiming?: Record<string, number>;
    currentTiming?: Record<string, number>;
  }): DriftReport {
    // 1. Feature Drift
    const methodDrift = this.calculatePSI(
      'payment_method',
      params.baselineFeatures.payment_method,
      params.currentFeatures.payment_method
    );

    const categoryDrift = this.calculatePSI(
      'failure_category',
      params.baselineFeatures.failure_category,
      params.currentFeatures.failure_category
    );

    // 2. Prediction Drift (binned into 5 deciles)
    const binProbs = (probs: number[]): Record<string, number> => {
      const counts: Record<string, number> = {
        '0.0-0.2': 0,
        '0.2-0.4': 0,
        '0.4-0.6': 0,
        '0.6-0.8': 0,
        '0.8-1.0': 0,
      };
      for (const p of probs) {
        if (p < 0.2) counts['0.0-0.2']!++;
        else if (p < 0.4) counts['0.2-0.4']!++;
        else if (p < 0.6) counts['0.4-0.6']!++;
        else if (p < 0.8) counts['0.6-0.8']!++;
        else counts['0.8-1.0']!++;
      }
      return counts;
    };

    const predictionDrift = this.calculatePSI(
      'recovery_probability_deciles',
      binProbs(params.baselinePredictions),
      binProbs(params.currentPredictions)
    );

    // 3. Outcome Drift
    const rateDelta = Number((params.currentRecoveryRate - params.baselineRecoveryRate).toFixed(4));
    const isOutcomeDrifting = Math.abs(rateDelta) >= 0.08;

    let outcomeStatus: DriftStatus = 'STABLE';
    if (Math.abs(rateDelta) >= 0.18) {
      outcomeStatus = 'CRITICAL';
    } else if (Math.abs(rateDelta) >= 0.08) {
      outcomeStatus = 'WARNING';
    }

    const segmentOutcomes: DriftReport['outcomeDrift']['segmentOutcomes'] = {};
    if (params.baselineSegmentOutcomes && params.currentSegmentOutcomes) {
      for (const key of Object.keys(params.baselineSegmentOutcomes)) {
        const base = params.baselineSegmentOutcomes[key] || 0;
        const curr = params.currentSegmentOutcomes[key] || 0;
        segmentOutcomes[key] = {
          baselineRate: base,
          currentRate: curr,
          delta: Number((curr - base).toFixed(4)),
        };
      }
    }

    // 4. Strategy & Timing Drift
    const strategyDrift = this.calculatePSI(
      'recommended_strategy',
      params.baselineStrategies ?? { PAYMENT_LINK: 50, OPTIMAL_DELAYED_RETRY: 50 },
      params.currentStrategies ?? { PAYMENT_LINK: 50, OPTIMAL_DELAYED_RETRY: 50 }
    );

    const timingDrift = this.calculatePSI(
      'recommended_timing_bucket',
      params.baselineTiming ?? { SHORT_DELAY: 50, NEXT_DAY: 50 },
      params.currentTiming ?? { SHORT_DELAY: 50, NEXT_DAY: 50 }
    );

    // 5. Aggregate Overall Status
    const allStatuses = [
      methodDrift.status,
      categoryDrift.status,
      predictionDrift.status,
      outcomeStatus,
      strategyDrift.status,
      timingDrift.status,
    ];

    let overallStatus: DriftStatus = 'STABLE';
    if (allStatuses.includes('CRITICAL')) {
      overallStatus = 'CRITICAL';
    } else if (allStatuses.includes('WARNING')) {
      overallStatus = 'WARNING';
    }

    return {
      overallStatus,
      featureDrift: [methodDrift, categoryDrift],
      predictionDrift,
      outcomeDrift: {
        baselineRecoveryRate: params.baselineRecoveryRate,
        currentRecoveryRate: params.currentRecoveryRate,
        rateDelta,
        isDrifting: isOutcomeDrifting,
        status: outcomeStatus,
        segmentOutcomes,
      },
      strategyDrift,
      timingDrift,
      generatedAt: new Date().toISOString(),
    };
  }
}

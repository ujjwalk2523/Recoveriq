import { EvidenceTier, IntelligenceQualityBreakdown } from './learning-types';

export class ConfidenceEngine {
  /**
   * Evaluates evidence tier based on sample size thresholds.
   * LOW: < 30 observations
   * MEDIUM: 30 - 199 observations
   * HIGH: >= 200 observations
   */
  static getEvidenceTier(observations: number): EvidenceTier {
    if (observations < 30) return 'LOW';
    if (observations < 200) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Checks if an entity is in cold-start state.
   */
  static evaluateColdStart(totalObservations: number): { isColdStart: boolean; reason?: string } {
    if (totalObservations === 0) {
      return {
        isColdStart: true,
        reason: 'Zero historical recovery observations. Operating on Phase 3 heuristics and global priors.',
      };
    }
    if (totalObservations < 30) {
      return {
        isColdStart: true,
        reason: `Insufficient sample size (${totalObservations}/30 observations required for statistical confidence).`,
      };
    }
    return { isColdStart: false };
  }

  /**
   * Calculates 0-100 Intelligence Quality score for a merchant recovery profile.
   */
  static calculateQualityScore(params: {
    totalObservations: number;
    lastUpdatedMinutesAgo: number;
    distinctStrategiesObserved: number; // 0 to 7
    successRate: number; // 0.0 to 1.0
  }): IntelligenceQualityBreakdown {
    const { totalObservations, lastUpdatedMinutesAgo, distinctStrategiesObserved, successRate } = params;

    // 1. Sample Size Score (max 30 points)
    // 0 obs -> 0 pts, 30 obs -> 15 pts, 200+ obs -> 30 pts
    let sampleSizeScore = 0;
    if (totalObservations >= 200) sampleSizeScore = 30;
    else if (totalObservations >= 100) sampleSizeScore = 25;
    else if (totalObservations >= 30) sampleSizeScore = 18;
    else if (totalObservations > 0) sampleSizeScore = Math.min(12, Math.round((totalObservations / 30) * 15));

    // 2. Recency Score (max 25 points)
    // Active within 1 hour -> 25 pts, within 24h -> 20 pts, within 7d -> 12 pts, older -> 5 pts
    let recencyScore = 5;
    if (lastUpdatedMinutesAgo <= 60) recencyScore = 25;
    else if (lastUpdatedMinutesAgo <= 1440) recencyScore = 20;
    else if (lastUpdatedMinutesAgo <= 10080) recencyScore = 12;

    // 3. Strategy Coverage Score (max 25 points)
    // 7 approved actions. 5+ actions -> 25 pts, 3-4 -> 18 pts, 1-2 -> 10 pts
    let strategyCoverageScore = 0;
    if (distinctStrategiesObserved >= 5) strategyCoverageScore = 25;
    else if (distinctStrategiesObserved >= 3) strategyCoverageScore = 18;
    else if (distinctStrategiesObserved >= 1) strategyCoverageScore = 10;

    // 4. Outcome Balance Score (max 20 points)
    // Realistic balance between 20% and 80% recovery rate gets max points
    let outcomeBalanceScore = 15;
    if (successRate >= 0.2 && successRate <= 0.8) outcomeBalanceScore = 20;
    else if (successRate > 0 && successRate < 1.0) outcomeBalanceScore = 12;

    const totalScore = Math.min(100, Math.max(0, sampleSizeScore + recencyScore + strategyCoverageScore + outcomeBalanceScore));
    const evidenceLevel = ConfidenceEngine.getEvidenceTier(totalObservations);
    const coldStart = ConfidenceEngine.evaluateColdStart(totalObservations);

    return {
      score: totalScore,
      sampleSizeScore,
      recencyScore,
      strategyCoverageScore,
      outcomeBalanceScore,
      evidenceLevel,
      isColdStart: coldStart.isColdStart,
      coldStartReason: coldStart.reason,
    };
  }
}

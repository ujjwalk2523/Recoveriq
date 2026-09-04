import {
  CalibrationReport,
  DriftReport,
  MLHealthGrade,
  MLHealthReport,
  RecommendedGovernanceAction,
  SegmentReport,
} from './observability-types';

export class MLHealthScorer {
  /**
   * Evaluates composite ML Health Score (0-100) and determines fallback necessity
   */
  static evaluateHealth(params: {
    calibration: CalibrationReport;
    drift: DriftReport;
    segments: SegmentReport;
  }): MLHealthReport {
    const { calibration, drift, segments } = params;

    let score = 100;

    // 1. Calibration Penalties
    let calibrationPenalty = 0;
    const ece = calibration.expectedCalibrationError;
    if (ece > 0.18) {
      calibrationPenalty += 30;
    } else if (ece > 0.10) {
      calibrationPenalty += 15;
    }

    if (calibration.brierScore > 0.20) {
      calibrationPenalty += 10;
    }
    score -= calibrationPenalty;

    // 2. Drift Penalties
    let driftPenalty = 0;
    if (drift.overallStatus === 'CRITICAL') {
      driftPenalty += 25;
    } else if (drift.overallStatus === 'WARNING') {
      driftPenalty += 10;
    }

    if (drift.outcomeDrift.status === 'CRITICAL') {
      driftPenalty += 25;
    } else if (drift.outcomeDrift.status === 'WARNING') {
      driftPenalty += 10;
    }
    score -= driftPenalty;

    // 3. Segment Weakness Penalties
    const weakCount = segments.weakestSegments.length;
    const segmentWeaknessPenalty = Math.min(25, weakCount * 6);
    score -= segmentWeaknessPenalty;

    // Clamp score
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // Determine Grade
    let grade: MLHealthGrade = 'HEALTHY';
    if (finalScore < 50) {
      grade = 'CRITICAL';
    } else if (finalScore < 80) {
      grade = 'DEGRADED';
    }

    // Determine Action & Fallback
    let recommendedAction: RecommendedGovernanceAction = 'PROCEED_SHADOW';
    let shouldFallback = false;

    if (grade === 'CRITICAL' || drift.outcomeDrift.status === 'CRITICAL' || ece > 0.20) {
      recommendedAction = 'FALLBACK_TO_HEURISTICS';
      shouldFallback = true;
    } else if (grade === 'DEGRADED') {
      recommendedAction = 'ALERT_MONITOR';
      shouldFallback = finalScore < 65;
    }

    let summary = `ML Health is ${grade} (Score: ${finalScore}/100). Model is well-calibrated (ECE: ${(ece * 100).toFixed(1)}%) and data distributions are stable.`;
    if (shouldFallback) {
      summary = `⚠️ ML Health DEGRADED (Score: ${finalScore}/100, Grade: ${grade}). Automated fallback to Phase 3 Heuristic Intelligence activated. Zero payment disruption.`;
    } else if (grade === 'DEGRADED') {
      summary = `⚡ ML Health WARNING (Score: ${finalScore}/100, Grade: ${grade}). Slight drift or segment weakness detected. Monitoring closely.`;
    }

    return {
      overallScore: finalScore,
      grade,
      recommendedAction,
      summary,
      penalties: {
        calibrationPenalty,
        driftPenalty,
        segmentWeaknessPenalty,
      },
      calibration,
      drift,
      segments,
      shouldFallbackToHeuristics: shouldFallback,
      generatedAt: new Date().toISOString(),
    };
  }
}

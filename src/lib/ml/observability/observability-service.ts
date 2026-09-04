import { CalibrationEngine } from './calibration-engine';
import { DriftDetector } from './drift-detector';
import { SegmentEvaluator, SliceSample } from './segment-evaluator';
import { MLHealthScorer } from './ml-health-scorer';
import { MLHealthReport, PredictionLedgerEntry } from './observability-types';
import { PredictionLedger } from './prediction-ledger';

export class MLObservabilityService {
  /**
   * Conducts a full ML health, calibration, drift, and segment evaluation audit
   */
  static runAudit(options?: {
    baselineSamples?: PredictionLedgerEntry[];
    currentSamples?: PredictionLedgerEntry[];
  }): MLHealthReport {
    const resolvedEntries = PredictionLedger.getResolvedEntries();
    const currentSamples = options?.currentSamples ?? resolvedEntries;

    if (currentSamples.length === 0) {
      throw new Error(
        'No resolved prediction ledger entries available for ML observability audit.'
      );
    }

    const N = currentSamples.length;

    // 1. Prepare vectors for Calibration
    const yTrue = currentSamples.map(e => (e.actualRecovered ? 1 : 0));
    const yPredProbs = currentSamples.map(e => e.predictedProbability);

    const calibration = CalibrationEngine.computeCalibration(yTrue, yPredProbs);

    // 2. Prepare distributions for Drift Detection
    const getDistribution = (
      entries: PredictionLedgerEntry[],
      key: keyof PredictionLedgerEntry
    ): Record<string, number> => {
      const counts: Record<string, number> = {};
      for (const e of entries) {
        const val = String(e[key] || 'UNKNOWN');
        counts[val] = (counts[val] || 0) + 1;
      }
      return counts;
    };

    const baseSamples = options?.baselineSamples ?? currentSamples;

    const baseRecovered = baseSamples.filter(e => e.actualRecovered).length;
    const currRecovered = currentSamples.filter(e => e.actualRecovered).length;

    const baselineRecoveryRate = Number((baseRecovered / baseSamples.length).toFixed(4));
    const currentRecoveryRate = Number((currRecovered / N).toFixed(4));

    const drift = DriftDetector.evaluateDrift({
      baselineFeatures: {
        payment_method: getDistribution(baseSamples, 'paymentMethod'),
        failure_category: getDistribution(baseSamples, 'failureCategory'),
      },
      currentFeatures: {
        payment_method: getDistribution(currentSamples, 'paymentMethod'),
        failure_category: getDistribution(currentSamples, 'failureCategory'),
      },
      baselinePredictions: baseSamples.map(e => e.predictedProbability),
      currentPredictions: yPredProbs,
      baselineRecoveryRate,
      currentRecoveryRate,
      baselineStrategies: getDistribution(baseSamples, 'recommendedStrategy'),
      currentStrategies: getDistribution(currentSamples, 'recommendedStrategy'),
      baselineTiming: getDistribution(baseSamples, 'recommendedTimeBucket'),
      currentTiming: getDistribution(currentSamples, 'recommendedTimeBucket'),
    });

    // 3. Prepare slices for Segment Evaluation
    const sliceSamples: SliceSample[] = currentSamples.map(e => ({
      paymentMethod: e.paymentMethod,
      failureCategory: e.failureCategory,
      amount: e.amount,
      predictedProbability: e.predictedProbability,
      actualRecovered: e.actualRecovered ? 1 : 0,
    }));

    const segments = SegmentEvaluator.evaluateSegments(sliceSamples);

    // 4. Composite ML Health Evaluation
    const health = MLHealthScorer.evaluateHealth({
      calibration,
      drift,
      segments,
    });

    if (health.shouldFallbackToHeuristics) {
      console.warn(`[MLHealthGuardrail] ${health.summary}`);
    } else {
      console.log(`[MLHealthGuardrail] ${health.summary}`);
    }

    return health;
  }
}

import { RecoveryStrategyClass } from '../models/model-types';
import { TimeBucket } from '../timing/timing-types';

export interface CalibrationBin {
  binIndex: number;
  binRange: [number, number]; // e.g. [0.7, 0.8]
  sampleCount: number;
  positiveCount: number;
  meanPredictedProbability: number;
  actualFractionPositives: number;
  calibrationError: number; // |meanPred - actualFraction|
}

export interface CalibrationReport {
  binCount: number;
  totalSamples: number;
  expectedCalibrationError: number; // ECE (0.00 to 1.00)
  maximumCalibrationError: number; // MCE (0.00 to 1.00)
  brierScore: number;
  bins: CalibrationBin[];
  isWellCalibrated: boolean; // ECE <= 0.10
  generatedAt: string;
}

export type DriftStatus = 'STABLE' | 'WARNING' | 'CRITICAL';

export interface PSIMetric {
  name: string;
  psi: number;
  status: DriftStatus;
  baselineDistribution: Record<string, number>;
  currentDistribution: Record<string, number>;
}

export interface DriftReport {
  overallStatus: DriftStatus;
  featureDrift: PSIMetric[];
  predictionDrift: PSIMetric;
  outcomeDrift: {
    baselineRecoveryRate: number;
    currentRecoveryRate: number;
    rateDelta: number;
    isDrifting: boolean;
    status: DriftStatus;
    segmentOutcomes: Record<string, { baselineRate: number; currentRate: number; delta: number }>;
  };
  strategyDrift: PSIMetric;
  timingDrift: PSIMetric;
  generatedAt: string;
}

export interface SegmentMetric {
  segmentKey: string; // e.g. "payment_method:UPI"
  sliceDimension: string; // "payment_method" | "failure_category" | "amount_band" | "customer_segment"
  sliceValue: string; // "UPI" | "CARD" | etc.
  sampleCount: number;
  actualRecoveryRate: number;
  meanPredictedProbability: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  isWeakSegment: boolean; // rocAuc < 0.70 or accuracy < 0.65
}

export interface SegmentReport {
  slicesEvaluated: number;
  weakestSegments: SegmentMetric[];
  segmentMetrics: Record<string, SegmentMetric[]>;
  generatedAt: string;
}

export type MLHealthGrade = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
export type RecommendedGovernanceAction = 'PROCEED_SHADOW' | 'ALERT_MONITOR' | 'FALLBACK_TO_HEURISTICS';

export interface MLHealthReport {
  overallScore: number; // 0 to 100
  grade: MLHealthGrade;
  recommendedAction: RecommendedGovernanceAction;
  summary: string;
  penalties: {
    calibrationPenalty: number;
    driftPenalty: number;
    segmentWeaknessPenalty: number;
  };
  calibration: CalibrationReport;
  drift: DriftReport;
  segments: SegmentReport;
  shouldFallbackToHeuristics: boolean;
  generatedAt: string;
}

export interface PredictionLedgerEntry {
  id: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  failureCategory: string;
  predictedProbability: number;
  recommendedStrategy: RecoveryStrategyClass;
  recommendedTimeBucket: TimeBucket;
  optimalDelayMinutes: number;
  actualRecovered?: boolean;
  actualRecoveryMinutes?: number;
  timestamp: string;
}

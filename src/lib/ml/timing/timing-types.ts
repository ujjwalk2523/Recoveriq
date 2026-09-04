import { FeatureRecord } from '../feature-types';
import { RecoveryStrategyClass } from '../models/model-types';

export type TimeBucket =
  | 'IMMEDIATE'       // 0–10 min (ideal: ~5 min)
  | 'VERY_SOON'       // 10–30 min (ideal: ~18 min)
  | 'SHORT_DELAY'     // 30–60 min (ideal: ~42 min)
  | 'MEDIUM_DELAY'    // 1–4 hours (ideal: ~150 min / 2.5h)
  | 'LONG_DELAY'      // 4–12 hours (ideal: ~360 min / 6h)
  | 'NEXT_DAY'        // 12–24 hours (ideal: ~960 min / 16h)
  | 'DO_NOT_CONTACT'; // >24h / suppress

export const ALL_TIME_BUCKETS: TimeBucket[] = [
  'IMMEDIATE',
  'VERY_SOON',
  'SHORT_DELAY',
  'MEDIUM_DELAY',
  'LONG_DELAY',
  'NEXT_DAY',
  'DO_NOT_CONTACT',
];

export const TIME_BUCKET_TYPICAL_DELAYS: Record<TimeBucket, number> = {
  IMMEDIATE: 5,        // 5 minutes
  VERY_SOON: 18,       // 18 minutes
  SHORT_DELAY: 42,     // 42 minutes
  MEDIUM_DELAY: 150,   // 2.5 hours (150 minutes)
  LONG_DELAY: 360,     // 6 hours (360 minutes)
  NEXT_DAY: 960,       // 16 hours (960 minutes)
  DO_NOT_CONTACT: -1,  // Suppressed
};

export interface TimingEvaluationMetrics {
  sampleCount: number;
  top1Accuracy: number;
  top3Accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  multiclassLogLoss: number;
  classMetrics: Record<
    TimeBucket,
    {
      precision: number;
      recall: number;
      f1: number;
      support: number;
    }
  >;
}

export interface TimingPredictionResult {
  bestTimeBucket: TimeBucket;
  confidence: number;
  probabilities: Record<TimeBucket, number>;
  modelVersion: string;
  modelType: string;
  generatedAt: string;
}

export interface RankedTimeBucket {
  rank: number;
  bucket: TimeBucket;
  typicalDelayMinutes: number;
  probability: number;
  conditionalRecoveryProbability: number;
  expectedGrossRecovery: number;
  costs: {
    directCost: number;
    fatiguePenalty: number;
    decayPenalty: number;
    totalCost: number;
  };
  netEV: number;
}

export interface TimingRankingResult {
  transactionId: string;
  amount: number;
  strategy: RecoveryStrategyClass;
  rankedBuckets: RankedTimeBucket[];
  optimalBucket: RankedTimeBucket;
  optimalDelayMinutes: number;
  generatedAt: string;
  isShadowOnly: true;
}

export interface UnifiedRecoveryPlan {
  transactionId: string;
  amount: number;
  strategy: RecoveryStrategyClass;
  recoveryProbability: number;
  timeBucket: TimeBucket;
  optimalDelayMinutes: number;
  expectedNetRecovery: number;
  confidence: number;
  rationale: string;
  generatedAt: string;
  isShadowOnly: true;
}

export interface TimingModelArtifact {
  modelVersion: string;
  modelType: string;
  createdAt: string;
  featureNames: string[];
  classes: TimeBucket[];
  weights: number[][]; // K x D
  intercepts: number[]; // K
  categoricalVocabulary: {
    payment_method: string[];
    failure_category: string[];
    failure_code: string[];
    strategy: string[];
  };
  numericalStatistics: {
    mean: Record<string, number>;
    std: Record<string, number>;
  };
  metrics: {
    train: TimingEvaluationMetrics;
    test: TimingEvaluationMetrics;
  };
  metadata: {
    datasetSize: number;
    trainSize: number;
    testSize: number;
    isSyntheticDevelopmentData: boolean;
    trainingDurationMs: number;
  };
}

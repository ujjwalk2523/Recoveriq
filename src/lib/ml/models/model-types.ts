import { FeatureRecord, TransactionFeatureVector } from '../feature-types';

export type RecoveryStrategyClass =
  | 'IMMEDIATE_RETRY'
  | 'OPTIMAL_DELAYED_RETRY'
  | 'PAYMENT_LINK'
  | 'WHATSAPP_NUDGE'
  | 'MANDATE_UPDATE'
  | 'HUMAN_ESCALATION'
  | 'DO_NOT_RECOVER';

export const ALL_STRATEGY_CLASSES: RecoveryStrategyClass[] = [
  'IMMEDIATE_RETRY',
  'OPTIMAL_DELAYED_RETRY',
  'PAYMENT_LINK',
  'WHATSAPP_NUDGE',
  'MANDATE_UPDATE',
  'HUMAN_ESCALATION',
  'DO_NOT_RECOVER',
];

export interface BinaryEvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  logLoss: number;
  brierScore: number;
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
}

export interface MulticlassEvaluationMetrics {
  sampleCount: number;
  top1Accuracy: number;
  top3Accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  multiclassLogLoss: number;
  classMetrics: Record<
    RecoveryStrategyClass,
    {
      precision: number;
      recall: number;
      f1: number;
      support: number;
    }
  >;
}

export interface StrategyPredictionResult {
  bestStrategy: RecoveryStrategyClass;
  confidence: number; // 0.00 to 1.00
  probabilities: Record<RecoveryStrategyClass, number>;
  modelVersion: string;
  modelType: string;
  generatedAt: string;
  shadowComparison?: {
    heuristicAction: string;
    heuristicRank: number;
    aligned: boolean;
  };
}

export interface RankedStrategy {
  rank: number;
  strategy: RecoveryStrategyClass;
  strategyProbability: number;
  recoveryProbability: number;
  expectedGrossRecovery: number;
  costs: {
    directCost: number;
    fatiguePenalty: number;
    riskPenalty: number;
    totalCost: number;
  };
  netEV: number;
  confidence: number;
}

export interface StrategyRankingResult {
  transactionId: string;
  amount: number;
  rankedStrategies: RankedStrategy[];
  topStrategy: RankedStrategy;
  generatedAt: string;
  isShadowOnly: true;
}

export interface StrategyModelArtifact {
  modelVersion: string;
  modelType: string;
  createdAt: string;
  featureNames: string[];
  classes: RecoveryStrategyClass[];
  // Weight matrix W in R^{K x D}, intercept vector b in R^K
  weights: number[][];
  intercepts: number[];
  categoricalVocabulary: {
    payment_method: string[];
    failure_category: string[];
    failure_code: string[];
  };
  numericalStatistics: {
    mean: Record<string, number>;
    std: Record<string, number>;
  };
  metrics: {
    train: MulticlassEvaluationMetrics;
    test: MulticlassEvaluationMetrics;
  };
  metadata: {
    datasetSize: number;
    trainSize: number;
    testSize: number;
    isSyntheticDevelopmentData: boolean;
    trainingDurationMs: number;
  };
}

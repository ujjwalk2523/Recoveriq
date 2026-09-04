import { FeatureRecord, TransactionFeatureVector } from './feature-types';

export interface EvaluationMetrics {
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

export interface PredictionResult {
  probability: number; // 0.0 to 1.0
  modelVersion: string;
  modelType: string;
  generatedAt: string;
  shadowComparison?: {
    heuristicProbability: number;
    delta: number;
    aligned: boolean;
  };
}

export interface ModelArtifact {
  modelVersion: string;
  modelType: string;
  createdAt: string;
  featureNames: string[];
  weights: number[];
  intercept: number;
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
    train: EvaluationMetrics;
    test: EvaluationMetrics;
  };
  metadata: {
    datasetSize: number;
    trainSize: number;
    testSize: number;
    isSyntheticDevelopmentData: boolean;
    trainingDurationMs: number;
  };
}

export interface RecoveryProbabilityModel {
  readonly modelVersion: string;
  readonly modelType: string;
  train(X: number[][], y: number[], featureNames: string[]): Promise<void>;
  predictProbability(x: number[]): number;
  saveArtifact(
    encoderVocab: ModelArtifact['categoricalVocabulary'],
    normalizerStats: ModelArtifact['numericalStatistics'],
    metrics: ModelArtifact['metrics'],
    metadata: ModelArtifact['metadata']
  ): ModelArtifact;
  loadArtifact(artifact: ModelArtifact): void;
}

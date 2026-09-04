import { ALL_TIME_BUCKETS, TimeBucket, TimingModelArtifact } from './timing-types';

export interface TimingModelConfig {
  learningRate?: number;
  l2Regularization?: number;
  epochs?: number;
  batchSize?: number;
}

export class TimingPredictionModel {
  readonly modelType = 'MULTICLASS_SOFTMAX_REGRESSION';
  readonly modelVersion = 'RecoverIQ-TimingIntelligence-v1.0';

  readonly classes: TimeBucket[] = ALL_TIME_BUCKETS;
  private weights: number[][] = []; // K x D
  private intercepts: number[] = []; // K
  private featureNames: string[] = [];
  private isTrained = false;

  private config: Required<TimingModelConfig>;

  constructor(config?: TimingModelConfig) {
    this.config = {
      learningRate: config?.learningRate ?? 0.08,
      l2Regularization: config?.l2Regularization ?? 0.01,
      epochs: config?.epochs ?? 40,
      batchSize: config?.batchSize ?? 64,
    };
  }

  /**
   * Numerically stable Softmax activation over 7 time bucket logits
   */
  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expValues = logits.map(z => Math.exp(z - maxLogit));
    const sumExp = expValues.reduce((sum, v) => sum + v, 0);
    return expValues.map(v => v / (sumExp > 0 ? sumExp : 1.0));
  }

  /**
   * Trains multiclass Softmax model using mini-batch SGD
   */
  async train(X: number[][], yIndices: number[], featureNames: string[]): Promise<void> {
    const N = X.length;
    if (N === 0) throw new Error('Training dataset cannot be empty.');
    const D = X[0]?.length || 0;
    if (D === 0) throw new Error('Feature dimension must be greater than 0.');

    const K = this.classes.length;
    this.featureNames = [...featureNames];

    const scale = Math.sqrt(2.0 / (D + K));
    this.weights = Array.from({ length: K }, () =>
      Array.from({ length: D }, () => (Math.random() - 0.5) * scale)
    );
    this.intercepts = new Array(K).fill(0.0);

    const { learningRate, l2Regularization, epochs, batchSize } = this.config;
    const indices = Array.from({ length: N }, (_, i) => i);

    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = learningRate / (1.0 + 0.005 * epoch);

      // Shuffle
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = indices[i]!;
        indices[i] = indices[j]!;
        indices[j] = temp;
      }

      for (let start = 0; start < N; start += batchSize) {
        const end = Math.min(start + batchSize, N);
        const batchN = end - start;

        const gradW = Array.from({ length: K }, () => new Array(D).fill(0));
        const gradB = new Array(K).fill(0);

        for (let b = start; b < end; b++) {
          const idx = indices[b]!;
          const x_i = X[idx]!;
          const trueClassIdx = yIndices[idx]!;

          // Logits
          const logits = new Array(K);
          for (let k = 0; k < K; k++) {
            let z = this.intercepts[k]!;
            const w_k = this.weights[k]!;
            for (let d = 0; d < D; d++) {
              z += w_k[d]! * x_i[d]!;
            }
            logits[k] = z;
          }

          const probs = this.softmax(logits);

          for (let k = 0; k < K; k++) {
            const target_k = k === trueClassIdx ? 1.0 : 0.0;
            const error = probs[k]! - target_k;

            for (let d = 0; d < D; d++) {
              gradW[k]![d] += error * x_i[d]!;
            }
            gradB[k] += error;
          }
        }

        // Apply weight updates
        for (let k = 0; k < K; k++) {
          for (let d = 0; d < D; d++) {
            const l2Term = (l2Regularization / N) * this.weights[k]![d]!;
            this.weights[k]![d] -= lr * (gradW[k]![d] / batchN + l2Term);
          }
          this.intercepts[k] -= lr * (gradB[k] / batchN);
        }
      }
    }

    this.isTrained = true;
  }

  /**
   * Predicts probabilities across all 7 time buckets
   */
  predictProbabilities(x: number[]): Record<TimeBucket, number> {
    if (!this.isTrained) {
      throw new Error('TimingPredictionModel is not trained.');
    }

    const K = this.classes.length;
    const logits = new Array(K);

    for (let k = 0; k < K; k++) {
      let z = this.intercepts[k]!;
      const w_k = this.weights[k]!;
      for (let d = 0; d < this.featureNames.length; d++) {
        z += (w_k[d] || 0) * (x[d] || 0);
      }
      logits[k] = z;
    }

    const probs = this.softmax(logits);
    const result = {} as Record<TimeBucket, number>;

    for (let k = 0; k < K; k++) {
      result[this.classes[k]!] = Number(probs[k]!.toFixed(4));
    }

    return result;
  }

  /**
   * Predicts top time bucket and confidence
   */
  predict(x: number[]): {
    bestTimeBucket: TimeBucket;
    confidence: number;
    probabilities: Record<TimeBucket, number>;
  } {
    const probabilities = this.predictProbabilities(x);

    let bestTimeBucket = this.classes[0]!;
    let maxProb = -1;

    for (const [bucket, prob] of Object.entries(probabilities)) {
      if (prob > maxProb) {
        maxProb = prob;
        bestTimeBucket = bucket as TimeBucket;
      }
    }

    return {
      bestTimeBucket,
      confidence: maxProb,
      probabilities,
    };
  }

  saveArtifact(
    encoderVocab: TimingModelArtifact['categoricalVocabulary'],
    normalizerStats: TimingModelArtifact['numericalStatistics'],
    metrics: TimingModelArtifact['metrics'],
    metadata: TimingModelArtifact['metadata']
  ): TimingModelArtifact {
    if (!this.isTrained) {
      throw new Error('Cannot export an untrained TimingPredictionModel artifact.');
    }

    return {
      modelVersion: this.modelVersion,
      modelType: this.modelType,
      createdAt: new Date().toISOString(),
      featureNames: [...this.featureNames],
      classes: [...this.classes],
      weights: this.weights.map(row => [...row]),
      intercepts: [...this.intercepts],
      categoricalVocabulary: encoderVocab,
      numericalStatistics: normalizerStats,
      metrics,
      metadata,
    };
  }

  loadArtifact(artifact: TimingModelArtifact): void {
    this.weights = artifact.weights.map(row => [...row]);
    this.intercepts = [...artifact.intercepts];
    this.featureNames = [...artifact.featureNames];
    this.isTrained = true;
  }
}

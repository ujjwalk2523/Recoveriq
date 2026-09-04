import { ALL_STRATEGY_CLASSES, RecoveryStrategyClass, StrategyModelArtifact } from './model-types';

export interface StrategyModelConfig {
  learningRate?: number;
  l2Regularization?: number;
  epochs?: number;
  batchSize?: number;
}

export class StrategyPredictionModel {
  readonly modelType = 'MULTICLASS_SOFTMAX_REGRESSION';
  readonly modelVersion = 'RecoverIQ-StrategyPrediction-v1.0';

  readonly classes: RecoveryStrategyClass[] = ALL_STRATEGY_CLASSES;
  private weights: number[][] = []; // K x D
  private intercepts: number[] = []; // K
  private featureNames: string[] = [];
  private isTrained = false;

  private config: Required<StrategyModelConfig>;

  constructor(config?: StrategyModelConfig) {
    this.config = {
      learningRate: config?.learningRate ?? 0.08,
      l2Regularization: config?.l2Regularization ?? 0.01,
      epochs: config?.epochs ?? 40,
      batchSize: config?.batchSize ?? 64,
    };
  }

  /**
   * Numerically stable Softmax activation over K logits
   */
  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expValues = logits.map(z => Math.exp(z - maxLogit));
    const sumExp = expValues.reduce((sum, v) => sum + v, 0);
    return expValues.map(v => v / (sumExp > 0 ? sumExp : 1.0));
  }

  /**
   * Trains the multiclass softmax regression model using mini-batch SGD
   */
  async train(X: number[][], yIndices: number[], featureNames: string[]): Promise<void> {
    const N = X.length;
    if (N === 0) throw new Error('Training dataset cannot be empty.');
    const D = X[0]?.length || 0;
    if (D === 0) throw new Error('Feature dimension must be greater than 0.');

    const K = this.classes.length;
    this.featureNames = [...featureNames];

    // Xavier initialization
    const scale = Math.sqrt(2.0 / (D + K));
    this.weights = Array.from({ length: K }, () =>
      Array.from({ length: D }, () => (Math.random() - 0.5) * scale)
    );
    this.intercepts = new Array(K).fill(0.0);

    const { learningRate, l2Regularization, epochs, batchSize } = this.config;
    const indices = Array.from({ length: N }, (_, i) => i);

    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = learningRate / (1.0 + 0.005 * epoch);

      // Shuffle dataset
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = indices[i]!;
        indices[i] = indices[j]!;
        indices[j] = temp;
      }

      // Mini-batch updates
      for (let start = 0; start < N; start += batchSize) {
        const end = Math.min(start + batchSize, N);
        const batchN = end - start;

        const gradW = Array.from({ length: K }, () => new Array(D).fill(0));
        const gradB = new Array(K).fill(0);

        for (let b = start; b < end; b++) {
          const idx = indices[b]!;
          const x_i = X[idx]!;
          const trueClassIdx = yIndices[idx]!;

          // Compute logits z_k = w_k . x + b_k
          const logits = new Array(K);
          for (let k = 0; k < K; k++) {
            let z = this.intercepts[k]!;
            const w_k = this.weights[k]!;
            for (let d = 0; d < D; d++) {
              z += w_k[d]! * x_i[d]!;
            }
            logits[k] = z;
          }

          // Softmax probabilities
          const probs = this.softmax(logits);

          // Accumulate gradients
          for (let k = 0; k < K; k++) {
            const target_k = k === trueClassIdx ? 1.0 : 0.0;
            const error = probs[k]! - target_k;

            for (let d = 0; d < D; d++) {
              gradW[k]![d] += error * x_i[d]!;
            }
            gradB[k] += error;
          }
        }

        // Apply parameter updates with L2 weight decay
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
   * Predicts probability distribution across all 7 strategy classes
   */
  predictProbabilities(x: number[]): Record<RecoveryStrategyClass, number> {
    if (!this.isTrained) {
      throw new Error('StrategyPredictionModel is not trained. Call train() or loadArtifact() first.');
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
    const result = {} as Record<RecoveryStrategyClass, number>;

    for (let k = 0; k < K; k++) {
      result[this.classes[k]!] = Number(probs[k]!.toFixed(4));
    }

    return result;
  }

  /**
   * Convenience predictor returning best strategy, confidence, and full distribution
   */
  predict(x: number[]): {
    bestStrategy: RecoveryStrategyClass;
    confidence: number;
    probabilities: Record<RecoveryStrategyClass, number>;
  } {
    const probabilities = this.predictProbabilities(x);

    let bestStrategy = this.classes[0]!;
    let maxProb = -1;

    for (const [strategy, prob] of Object.entries(probabilities)) {
      if (prob > maxProb) {
        maxProb = prob;
        bestStrategy = strategy as RecoveryStrategyClass;
      }
    }

    return {
      bestStrategy,
      confidence: maxProb,
      probabilities,
    };
  }

  /**
   * Exports complete model artifact for versioned registry storage
   */
  saveArtifact(
    encoderVocab: StrategyModelArtifact['categoricalVocabulary'],
    normalizerStats: StrategyModelArtifact['numericalStatistics'],
    metrics: StrategyModelArtifact['metrics'],
    metadata: StrategyModelArtifact['metadata']
  ): StrategyModelArtifact {
    if (!this.isTrained) {
      throw new Error('Cannot export an untrained StrategyPredictionModel artifact.');
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

  /**
   * Loads a serialized model artifact
   */
  loadArtifact(artifact: StrategyModelArtifact): void {
    this.weights = artifact.weights.map(row => [...row]);
    this.intercepts = [...artifact.intercepts];
    this.featureNames = [...artifact.featureNames];
    this.isTrained = true;
  }
}

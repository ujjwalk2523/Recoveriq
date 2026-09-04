import { RecoveryProbabilityModel, ModelArtifact } from './model-types';

export interface LogisticRegressionConfig {
  learningRate?: number;
  l2Regularization?: number;
  epochs?: number;
  batchSize?: number;
}

export class LogisticRegressionModel implements RecoveryProbabilityModel {
  readonly modelType = 'LOGISTIC_REGRESSION';
  readonly modelVersion = 'RecoverIQ-RecoveryProbability-v1.0';

  private weights: number[] = [];
  private intercept = 0.0;
  private featureNames: string[] = [];
  private isTrained = false;

  private config: Required<LogisticRegressionConfig>;

  constructor(config?: LogisticRegressionConfig) {
    this.config = {
      learningRate: config?.learningRate ?? 0.05,
      l2Regularization: config?.l2Regularization ?? 0.01,
      epochs: config?.epochs ?? 35,
      batchSize: config?.batchSize ?? 64,
    };
  }

  /**
   * Sigmoid activation function: sigma(z) = 1 / (1 + exp(-z))
   */
  private sigmoid(z: number): number {
    if (z > 35) return 1.0;
    if (z < -35) return 0.0;
    return 1.0 / (1.0 + Math.exp(-z));
  }

  /**
   * Trains the model via mini-batch gradient descent with L2 regularization
   */
  async train(X: number[][], y: number[], featureNames: string[]): Promise<void> {
    const N = X.length;
    if (N === 0) throw new Error('Training dataset cannot be empty.');
    const D = X[0]?.length || 0;
    if (D === 0) throw new Error('Feature dimension must be greater than 0.');

    this.featureNames = [...featureNames];

    // Xavier / Glorot initialization
    const scale = Math.sqrt(2.0 / D);
    this.weights = Array.from({ length: D }, () => (Math.random() - 0.5) * scale);
    this.intercept = 0.0;

    const { learningRate, l2Regularization, epochs, batchSize } = this.config;

    // Indices for shuffling
    const indices = Array.from({ length: N }, (_, i) => i);

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Learning rate decay
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

        const gradW = new Array(D).fill(0);
        let gradB = 0;

        for (let b = start; b < end; b++) {
          const idx = indices[b]!;
          const x_i = X[idx]!;
          const y_i = y[idx]!;

          // Forward pass: z = w.x + b
          let z = this.intercept;
          for (let d = 0; d < D; d++) {
            z += this.weights[d]! * x_i[d]!;
          }
          const p_i = this.sigmoid(z);
          const error = p_i - y_i;

          // Backward pass
          for (let d = 0; d < D; d++) {
            gradW[d] += error * x_i[d]!;
          }
          gradB += error;
        }

        // Apply weight updates with L2 regularization
        for (let d = 0; d < D; d++) {
          const l2Term = (l2Regularization / N) * this.weights[d]!;
          this.weights[d] -= lr * (gradW[d] / batchN + l2Term);
        }
        this.intercept -= lr * (gradB / batchN);
      }
    }

    this.isTrained = true;
  }

  /**
   * Predicts calibrated probability in range [0.0, 1.0]
   */
  predictProbability(x: number[]): number {
    if (!this.isTrained) {
      throw new Error('Model is not trained. Call train() or loadArtifact() first.');
    }

    let z = this.intercept;
    for (let d = 0; d < this.weights.length; d++) {
      z += (this.weights[d] || 0) * (x[d] || 0);
    }

    const prob = this.sigmoid(z);
    return Number(Math.min(1.0, Math.max(0.0, prob)).toFixed(4));
  }

  /**
   * Generates a portable, versioned model artifact
   */
  saveArtifact(
    encoderVocab: ModelArtifact['categoricalVocabulary'],
    normalizerStats: ModelArtifact['numericalStatistics'],
    metrics: ModelArtifact['metrics'],
    metadata: ModelArtifact['metadata']
  ): ModelArtifact {
    if (!this.isTrained) {
      throw new Error('Cannot export an untrained model artifact.');
    }

    return {
      modelVersion: this.modelVersion,
      modelType: this.modelType,
      createdAt: new Date().toISOString(),
      featureNames: [...this.featureNames],
      weights: [...this.weights],
      intercept: this.intercept,
      categoricalVocabulary: encoderVocab,
      numericalStatistics: normalizerStats,
      metrics,
      metadata,
    };
  }

  /**
   * Loads a serialized model artifact
   */
  loadArtifact(artifact: ModelArtifact): void {
    if (artifact.modelVersion !== this.modelVersion) {
      console.warn(`[LogisticRegressionModel] Loading artifact version ${artifact.modelVersion}, expected ${this.modelVersion}`);
    }

    this.weights = [...artifact.weights];
    this.intercept = artifact.intercept;
    this.featureNames = [...artifact.featureNames];
    this.isTrained = true;
  }

  getWeights(): number[] {
    return [...this.weights];
  }

  getIntercept(): number {
    return this.intercept;
  }
}

import { ModelArtifact } from './model-types';
import { LogisticRegressionModel } from './logistic-regression';
import { FeatureEncoder } from './encoder';

export class ModelRegistry {
  private static registry = new Map<string, ModelArtifact>();
  private static activeVersion = 'RecoverIQ-RecoveryProbability-v1.0';

  /**
   * Registers a trained model artifact in the registry
   */
  static registerModel(artifact: ModelArtifact): void {
    this.registry.set(artifact.modelVersion, artifact);
    console.log(`[ModelRegistry] Registered artifact for version: ${artifact.modelVersion}`);
  }

  /**
   * Retrieves a registered artifact by version
   */
  static getModelArtifact(version = this.activeVersion): ModelArtifact | null {
    return this.registry.get(version) || null;
  }

  /**
   * Instantiates a fully loaded, ready-to-infer model and encoder for the requested version
   */
  static getActiveModel(version = this.activeVersion): {
    model: LogisticRegressionModel;
    encoder: FeatureEncoder;
    artifact: ModelArtifact;
  } | null {
    const artifact = this.getModelArtifact(version);
    if (!artifact) return null;

    // 1. Reconstitute encoder state
    const encoder = new FeatureEncoder();
    encoder.loadState(
      artifact.categoricalVocabulary,
      artifact.numericalStatistics,
      artifact.featureNames
    );

    // 2. Reconstitute model weights
    const model = new LogisticRegressionModel();
    model.loadArtifact(artifact);

    return { model, encoder, artifact };
  }

  /**
   * Lists all registered model versions
   */
  static listModels(): {
    version: string;
    modelType: string;
    createdAt: string;
    metrics: ModelArtifact['metrics'];
  }[] {
    return Array.from(this.registry.values()).map(a => ({
      version: a.modelVersion,
      modelType: a.modelType,
      createdAt: a.createdAt,
      metrics: a.metrics,
    }));
  }

  /**
   * Clear registry (for test isolation)
   */
  static clear(): void {
    this.registry.clear();
  }
}

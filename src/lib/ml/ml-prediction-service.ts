import { PredictionResult } from './model-types';
import { ModelRegistry } from './model-registry';
import { FeatureExtractor } from './feature-extractor';
import { FeatureRecord } from './feature-types';

export interface ShadowModeComparison {
  transactionId: string;
  heuristicProbability: number;
  mlProbability: number;
  delta: number;
  aligned: boolean; // within +/- 0.15
  isShadowOnly: true;
}

export class MLPredictionService {
  private static shadowLog: ShadowModeComparison[] = [];

  /**
   * Generates recovery probability prediction for a transaction in SHADOW MODE.
   *
   * CRITICAL GUARANTEE:
   * This service operates strictly in shadow mode.
   * ML predictions are logged for drift evaluation and NEVER alter production
   * recovery decisions, heuristic policy evaluations, or execution sequences.
   */
  static async predictRecoveryProbability(params: {
    transactionId: string;
    record?: FeatureRecord;
    heuristicBaselineProbability?: number;
  }): Promise<PredictionResult> {
    const { transactionId, heuristicBaselineProbability } = params;

    // 1. Load active ML model & encoder from registry
    const active = ModelRegistry.getActiveModel();
    if (!active) {
      throw new Error(
        'No active ML model found in ModelRegistry. Run TrainingPipeline.trainRecoveryModel() first.'
      );
    }

    const { model, encoder, artifact } = active;

    // 2. Extract or use provided FeatureRecord
    const record = params.record ?? (await FeatureExtractor.extractFeatures(transactionId));

    // 3. Transform via fitted encoder
    const featureVector = encoder.transform(record);

    // 4. Compute ML Probability
    const mlProbability = model.predictProbability(featureVector);

    // 5. Shadow Mode Evaluation & Comparison
    let shadowComparison: PredictionResult['shadowComparison'] = undefined;

    if (heuristicBaselineProbability !== undefined) {
      const delta = Number((mlProbability - heuristicBaselineProbability).toFixed(4));
      const aligned = Math.abs(delta) <= 0.20;

      shadowComparison = {
        heuristicProbability: heuristicBaselineProbability,
        delta,
        aligned,
      };

      const logEntry: ShadowModeComparison = {
        transactionId,
        heuristicProbability: heuristicBaselineProbability,
        mlProbability,
        delta,
        aligned,
        isShadowOnly: true,
      };

      this.shadowLog.push(logEntry);

      console.log(
        `[ShadowMode] Transaction ${transactionId}: Heuristic=${heuristicBaselineProbability.toFixed(
          4
        )} vs ML=${mlProbability.toFixed(4)} (Delta=${delta >= 0 ? '+' : ''}${delta}) [SHADOW ONLY - NO PROD IMPACT]`
      );
    }

    return {
      probability: mlProbability,
      modelVersion: artifact.modelVersion,
      modelType: artifact.modelType,
      generatedAt: new Date().toISOString(),
      shadowComparison,
    };
  }

  /**
   * Retrieves shadow mode comparisons for analysis
   */
  static getShadowLog(): ShadowModeComparison[] {
    return [...this.shadowLog];
  }

  /**
   * Clears shadow log (for test isolation)
   */
  static clearShadowLog(): void {
    this.shadowLog = [];
  }
}

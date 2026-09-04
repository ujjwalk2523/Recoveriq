import { MLPredictionService } from '../ml-prediction-service';
import { PredictionResult } from '../model-types';
import { FeatureRecord } from '../feature-types';

export class RecoveryProbabilityInferenceService {
  /**
   * Generates recovery probability prediction for a transaction in SHADOW MODE
   */
  static async predict(params: {
    transactionId: string;
    record?: FeatureRecord;
    heuristicBaselineProbability?: number;
  }): Promise<PredictionResult> {
    return MLPredictionService.predictRecoveryProbability(params);
  }
}

import { ArtifactManager } from '../training/model-artifact';
import { StrategyPredictionModel } from '../models/strategy-prediction-model';
import { FeatureEncoder } from '../encoder';
import { FeatureExtractor } from '../feature-extractor';
import { FeatureRecord } from '../feature-types';
import { StrategyRankingEngine } from '../strategy/strategy-ranking';
import {
  RecoveryStrategyClass,
  StrategyPredictionResult,
  StrategyRankingResult,
} from '../models/model-types';

export interface StrategyInferenceOutput {
  prediction: StrategyPredictionResult;
  ranking: StrategyRankingResult;
  isShadowOnly: true;
}

export class StrategyPredictionService {
  private static cachedModel: StrategyPredictionModel | null = null;
  private static cachedEncoder: FeatureEncoder | null = null;
  private static cachedVersion = '';

  /**
   * Loads the active strategy model and encoder
   */
  private static getActiveModel(): { model: StrategyPredictionModel; encoder: FeatureEncoder } {
    const artifact = ArtifactManager.loadStrategyArtifact();
    if (!artifact) {
      throw new Error(
        'No StrategyModelArtifact found in ArtifactManager. Run StrategyTrainer.trainStrategyModel() first.'
      );
    }

    if (this.cachedModel && this.cachedEncoder && this.cachedVersion === artifact.modelVersion) {
      return { model: this.cachedModel, encoder: this.cachedEncoder };
    }

    const encoder = new FeatureEncoder();
    encoder.loadState(
      artifact.categoricalVocabulary,
      artifact.numericalStatistics,
      artifact.featureNames.filter(name => name !== 'num_phase62_recovery_prob')
    );

    const model = new StrategyPredictionModel();
    model.loadArtifact(artifact);

    this.cachedModel = model;
    this.cachedEncoder = encoder;
    this.cachedVersion = artifact.modelVersion;

    return { model, encoder };
  }

  /**
   * Generates shadow-only strategy predictions and Net EV ranking for a transaction
   *
   * CRITICAL GUARANTEE:
   * Operates strictly in shadow mode. Does not alter production heuristic decisions,
   * policy guardrail evaluations, or sequence engine dispatches.
   */
  static async predictAndRank(params: {
    transactionId: string;
    record?: FeatureRecord;
    recoveryProbability?: number; // Phase 6.2 recovery probability
    heuristicAction?: string;
  }): Promise<StrategyInferenceOutput> {
    const { transactionId, heuristicAction } = params;
    const { model, encoder } = this.getActiveModel();

    // 1. Get or extract feature record
    const record = params.record ?? (await FeatureExtractor.extractFeatures(transactionId));
    const baseRecoveryProb = params.recoveryProbability ?? 0.75;

    // 2. Transform features + append normalized recovery probability
    const baseVector = encoder.transform(record);
    const normProb = Number(((baseRecoveryProb - 0.5) / 0.25).toFixed(6));
    const fullVector = [...baseVector, normProb];

    // 3. Predict strategy probabilities
    const rawPrediction = model.predict(fullVector);

    // 4. Calculate Net EV Rankings
    const amount = record.features.amount || 5000;
    const fatigueScore = record.features.fatigue_score || 10;
    const riskScore = record.features.risk_score || 10;

    const ranking = StrategyRankingEngine.rankStrategies({
      transactionId,
      amount,
      strategyProbabilities: rawPrediction.probabilities,
      baseRecoveryProbability: baseRecoveryProb,
      fatigueScore,
      riskScore,
    });

    // 5. Build Shadow Comparison
    let shadowComparison: StrategyPredictionResult['shadowComparison'] = undefined;
    if (heuristicAction) {
      const heuristicRank = ranking.rankedStrategies.findIndex(
        s => s.strategy === heuristicAction
      ) + 1;

      shadowComparison = {
        heuristicAction,
        heuristicRank: heuristicRank > 0 ? heuristicRank : 99,
        aligned: rawPrediction.bestStrategy === heuristicAction,
      };

      console.log(
        `[ShadowMode:Strategy] Transaction ${transactionId}: Heuristic=${heuristicAction} vs ML=${
          rawPrediction.bestStrategy
        } (Conf=${(rawPrediction.confidence * 100).toFixed(1)}%, TopNetEV=₹${
          ranking.topStrategy.netEV
        }) [SHADOW ONLY - NO PROD IMPACT]`
      );
    }

    const prediction: StrategyPredictionResult = {
      bestStrategy: rawPrediction.bestStrategy,
      confidence: rawPrediction.confidence,
      probabilities: rawPrediction.probabilities,
      modelVersion: model.modelVersion,
      modelType: model.modelType,
      generatedAt: new Date().toISOString(),
      shadowComparison,
    };

    return {
      prediction,
      ranking,
      isShadowOnly: true,
    };
  }

  static clearCache(): void {
    this.cachedModel = null;
    this.cachedEncoder = null;
    this.cachedVersion = '';
  }
}

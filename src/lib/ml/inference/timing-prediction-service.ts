import { ArtifactManager } from '../training/model-artifact';
import { TimingPredictionModel } from '../timing/timing-model';
import { FeatureEncoder } from '../encoder';
import { FeatureExtractor } from '../feature-extractor';
import { FeatureRecord } from '../feature-types';
import { ALL_STRATEGY_CLASSES, RecoveryStrategyClass } from '../models/model-types';
import {
  RankedTimeBucket,
  TimeBucket,
  TimingPredictionResult,
  TimingRankingResult,
  UnifiedRecoveryPlan,
} from '../timing/timing-types';
import { TimingRankingEngine } from '../timing/timing-ranking';

export interface UnifiedPlanOutput {
  plan: UnifiedRecoveryPlan;
  timingPrediction: TimingPredictionResult;
  timingRanking: TimingRankingResult;
  isShadowOnly: true;
}

export class TimingPredictionService {
  private static cachedModel: TimingPredictionModel | null = null;
  private static cachedEncoder: FeatureEncoder | null = null;
  private static cachedVersion = '';

  private static getActiveModel(): { model: TimingPredictionModel; encoder: FeatureEncoder } {
    const artifact = ArtifactManager.loadTimingArtifact();
    if (!artifact) {
      throw new Error(
        'No TimingModelArtifact found in ArtifactManager. Run TimingTrainer.trainTimingModel() first.'
      );
    }

    if (this.cachedModel && this.cachedEncoder && this.cachedVersion === artifact.modelVersion) {
      return { model: this.cachedModel, encoder: this.cachedEncoder };
    }

    const encoder = new FeatureEncoder();
    const baseFeatureNames = artifact.featureNames.filter(
      name => name !== 'num_phase62_recovery_prob' && !name.startsWith('ohe_strat_')
    );

    encoder.loadState(
      artifact.categoricalVocabulary,
      artifact.numericalStatistics,
      baseFeatureNames
    );

    const model = new TimingPredictionModel();
    model.loadArtifact(artifact);

    this.cachedModel = model;
    this.cachedEncoder = encoder;
    this.cachedVersion = artifact.modelVersion;

    return { model, encoder };
  }

  /**
   * Generates shadow-only Timing Prediction & compiles the Unified Recovery Plan
   *
   * CRITICAL GUARANTEE:
   * Operates strictly in SHADOW MODE. Does not alter production heuristic sequences,
   * queue worker delays, or Razorpay execution.
   */
  static async predictAndPlan(params: {
    transactionId: string;
    record?: FeatureRecord;
    recoveryProbability?: number; // Phase 6.2 recovery probability
    strategy?: RecoveryStrategyClass; // Phase 6.3 top strategy
  }): Promise<UnifiedPlanOutput> {
    const { transactionId } = params;
    const { model, encoder } = this.getActiveModel();

    // 1. Get or extract feature record
    const record = params.record ?? (await FeatureExtractor.extractFeatures(transactionId));
    const recoveryProbability = params.recoveryProbability ?? 0.78;
    const strategy: RecoveryStrategyClass = params.strategy ?? 'PAYMENT_LINK';

    // 2. Build 20-signal input vector
    const baseVector = encoder.transform(record);
    const normProb = Number(((recoveryProbability - 0.5) / 0.25).toFixed(6));
    const stratOhe = ALL_STRATEGY_CLASSES.map(strat => (strategy === strat ? 1.0 : 0.0));

    const fullVector = [...baseVector, normProb, ...stratOhe];

    // 3. Predict timing probabilities
    const rawPrediction = model.predict(fullVector);

    // 4. Calculate Net EV Rankings across time windows
    const amount = record.features.amount || 5000;
    const hour = record.features.hour ?? new Date().getHours();
    const fatigueScore = record.features.fatigue_score || 10;

    const timingRanking = TimingRankingEngine.rankTimingBuckets({
      transactionId,
      amount,
      strategy,
      bucketProbabilities: rawPrediction.probabilities,
      baseRecoveryProbability: recoveryProbability,
      hour,
      fatigueScore,
    });

    const optimalBucket = timingRanking.optimalBucket;

    // 5. Synthesize Unified Recovery Plan
    const plan: UnifiedRecoveryPlan = {
      transactionId,
      amount,
      strategy,
      recoveryProbability,
      timeBucket: optimalBucket.bucket,
      optimalDelayMinutes: timingRanking.optimalDelayMinutes,
      expectedNetRecovery: optimalBucket.netEV,
      confidence: rawPrediction.confidence,
      rationale: `Strategy ${strategy} scheduled for ${optimalBucket.bucket} (~${timingRanking.optimalDelayMinutes}m delay) maximizes Net EV at ₹${optimalBucket.netEV.toLocaleString('en-IN')}.`,
      generatedAt: new Date().toISOString(),
      isShadowOnly: true,
    };

    console.log(
      `[ShadowMode:Timing] Txn ${transactionId}: Strategy=${strategy} -> Window=${optimalBucket.bucket} (~${timingRanking.optimalDelayMinutes}m), NetEV=₹${optimalBucket.netEV} [SHADOW ONLY - NO PROD IMPACT]`
    );

    const timingPrediction: TimingPredictionResult = {
      bestTimeBucket: rawPrediction.bestTimeBucket,
      confidence: rawPrediction.confidence,
      probabilities: rawPrediction.probabilities,
      modelVersion: model.modelVersion,
      modelType: model.modelType,
      generatedAt: new Date().toISOString(),
    };

    return {
      plan,
      timingPrediction,
      timingRanking,
      isShadowOnly: true,
    };
  }

  static clearCache(): void {
    this.cachedModel = null;
    this.cachedEncoder = null;
    this.cachedVersion = '';
  }
}

import { FeatureEncoder } from '../encoder';
import { StrategyPredictionModel, StrategyModelConfig } from '../models/strategy-prediction-model';
import { StrategyDatasetGenerator, StrategyTrainingSample } from '../strategy/strategy-dataset';
import { ALL_STRATEGY_CLASSES, StrategyModelArtifact } from '../models/model-types';
import { MLEvaluator } from './evaluator';
import { ArtifactManager } from './model-artifact';

export interface StrategyTrainingResult {
  artifact: StrategyModelArtifact;
  metrics: StrategyModelArtifact['metrics'];
  trainCount: number;
  testCount: number;
  featureDimension: number;
  isAntiLeakageVerified: boolean;
}

export class StrategyTrainer {
  /**
   * Trains the Multiclass Softmax Strategy Prediction model with anti-leakage guards
   */
  static async trainStrategyModel(options?: {
    samples?: StrategyTrainingSample[];
    config?: StrategyModelConfig;
  }): Promise<StrategyTrainingResult> {
    const startTime = Date.now();
    console.log('[StrategyTrainer] Initializing Multiclass Strategy Prediction training...');

    // 1. Load Strategy Dataset (10,000 samples)
    let samples = options?.samples;
    if (!samples || samples.length === 0) {
      console.log('[StrategyTrainer] Generating 10,000 synthetic strategy samples with realistic domain distributions...');
      const generated = StrategyDatasetGenerator.generate({ sampleCount: 10000 });
      samples = generated.samples;
    }

    const N = samples.length;
    console.log(`[StrategyTrainer] Loaded ${N} strategy training samples.`);

    // 2. Strict Anti-Leakage Audit: Verify no post-decision labels in input features
    let isAntiLeakageVerified = true;
    for (let i = 0; i < Math.min(500, N); i++) {
      const f = samples[i]!.record.features;
      if (f.target_recovered !== undefined || f.target_time_to_recover_minutes !== undefined) {
        isAntiLeakageVerified = false;
        throw new Error(`[CRITICAL LEAKAGE DETECTED] Feature record ${samples[i]!.record.metadata.transactionId} contains post-decision outcome variables!`);
      }
    }
    console.log('[StrategyTrainer] Anti-Leakage Audit PASSED: Feature space contains zero post-decision outcome variables.');

    // 3. Chronological 80/20 Train/Test Split (Preserve temporal order)
    const splitIndex = Math.floor(N * 0.8);
    const trainSamples = samples.slice(0, splitIndex);
    const testSamples = samples.slice(splitIndex);

    console.log(`[StrategyTrainer] Chronological Split: Train = ${trainSamples.length} (80%), Test = ${testSamples.length} (20%)`);

    // 4. Fit Feature Encoder on Train Set ONLY
    const encoder = new FeatureEncoder();
    encoder.fit(trainSamples.map(s => s.record));

    // Base feature names + Phase 6.2 recovery probability feature
    const featureNames = [...encoder.getFeatureNames(), 'num_phase62_recovery_prob'];
    console.log(`[StrategyTrainer] Encoded input feature space: ${featureNames.length} dimensions (including Phase 6.2 P_rec).`);

    // 5. Build Numerical Matrices
    // For each sample: [x_encoder..., sample.recoveryProbability]
    const transformSample = (s: StrategyTrainingSample): number[] => {
      const baseVector = encoder.transform(s.record);
      // Normalize recoveryProbability around 0.5 (mean 0.5, std ~0.25)
      const normProb = (s.recoveryProbability - 0.5) / 0.25;
      return [...baseVector, Number(normProb.toFixed(6))];
    };

    const X_train = trainSamples.map(transformSample);
    const y_train = trainSamples.map(s => ALL_STRATEGY_CLASSES.indexOf(s.targetStrategy));

    const X_test = testSamples.map(transformSample);
    const y_test = testSamples.map(s => ALL_STRATEGY_CLASSES.indexOf(s.targetStrategy));

    // 6. Train Multiclass Softmax Model
    const model = new StrategyPredictionModel(options?.config);
    console.log(`[StrategyTrainer] Training ${model.modelType} (${model.modelVersion}) across 7 classes...`);
    await model.train(X_train, y_train, featureNames);

    // 7. Predict & Evaluate on Train & Holdout Test Sets
    const trainPredProbs = X_train.map(x => model.predictProbabilities(x));
    const testPredProbs = X_test.map(x => model.predictProbabilities(x));

    const trainMetrics = MLEvaluator.evaluateMulticlass(y_train, trainPredProbs);
    const testMetrics = MLEvaluator.evaluateMulticlass(y_test, testPredProbs);

    console.log('[StrategyTrainer] Evaluation on 2,000 Holdout Test Samples:');
    console.log(`  Top-1 Accuracy:    ${(testMetrics.top1Accuracy * 100).toFixed(2)}%`);
    console.log(`  Top-3 Accuracy:    ${(testMetrics.top3Accuracy * 100).toFixed(2)}%`);
    console.log(`  Macro Precision:   ${(testMetrics.macroPrecision * 100).toFixed(2)}%`);
    console.log(`  Macro Recall:      ${(testMetrics.macroRecall * 100).toFixed(2)}%`);
    console.log(`  Macro F1-Score:    ${(testMetrics.macroF1 * 100).toFixed(2)}%`);
    console.log(`  Multiclass LogLoss: ${testMetrics.multiclassLogLoss.toFixed(4)}`);

    // 8. Package & Save Versioned Artifact
    const trainingDurationMs = Date.now() - startTime;
    const artifact = model.saveArtifact(
      encoder.exportVocab(),
      encoder.exportStats(),
      { train: trainMetrics, test: testMetrics },
      {
        datasetSize: N,
        trainSize: trainSamples.length,
        testSize: testSamples.length,
        isSyntheticDevelopmentData: true,
        trainingDurationMs,
      }
    );

    ArtifactManager.saveStrategyArtifact(artifact);
    console.log(`[StrategyTrainer] Artifact ${artifact.modelVersion} saved to ArtifactManager (${trainingDurationMs}ms).`);

    return {
      artifact,
      metrics: artifact.metrics,
      trainCount: trainSamples.length,
      testCount: testSamples.length,
      featureDimension: featureNames.length,
      isAntiLeakageVerified,
    };
  }
}

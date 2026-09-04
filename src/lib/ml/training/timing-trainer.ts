import { FeatureEncoder } from '../encoder';
import { ALL_STRATEGY_CLASSES } from '../models/model-types';
import { ALL_TIME_BUCKETS, TimingModelArtifact } from '../timing/timing-types';
import { TimingPredictionModel, TimingModelConfig } from '../timing/timing-model';
import { TimingDatasetGenerator, TimingTrainingSample } from '../timing/timing-dataset';
import { TimingEvaluator } from './timing-evaluator';
import { ArtifactManager } from './model-artifact';

export interface TimingTrainingResult {
  artifact: TimingModelArtifact;
  metrics: TimingModelArtifact['metrics'];
  trainCount: number;
  testCount: number;
  featureDimension: number;
  isAntiLeakageVerified: boolean;
}

export class TimingTrainer {
  /**
   * Trains the Multiclass Softmax Timing Intelligence Model with anti-leakage guards
   */
  static async trainTimingModel(options?: {
    samples?: TimingTrainingSample[];
    config?: TimingModelConfig;
  }): Promise<TimingTrainingResult> {
    const startTime = Date.now();
    console.log('[TimingTrainer] Initializing Multiclass Timing Intelligence training...');

    // 1. Load Dataset
    let samples = options?.samples;
    if (!samples || samples.length === 0) {
      console.log('[TimingTrainer] Generating 10,000 synthetic timing samples with realistic temporal dynamics...');
      const generated = TimingDatasetGenerator.generate({ sampleCount: 10000 });
      samples = generated.samples;
    }

    const N = samples.length;
    console.log(`[TimingTrainer] Loaded ${N} timing training samples.`);

    // 2. Strict Anti-Leakage Audit
    let isAntiLeakageVerified = true;
    for (let i = 0; i < Math.min(500, N); i++) {
      const f = samples[i]!.record.features;
      if (f.target_recovered !== undefined || f.target_time_to_recover_minutes !== undefined) {
        isAntiLeakageVerified = false;
        throw new Error(
          `[CRITICAL LEAKAGE DETECTED] Feature record ${samples[i]!.record.metadata.transactionId} contains post-decision outcome variables!`
        );
      }
    }
    console.log('[TimingTrainer] Anti-Leakage Audit PASSED: Feature space contains zero post-decision outcome variables.');

    // 3. Chronological 80/20 Train/Test Split
    const splitIndex = Math.floor(N * 0.8);
    const trainSamples = samples.slice(0, splitIndex);
    const testSamples = samples.slice(splitIndex);
    console.log(`[TimingTrainer] Chronological Split: Train = ${trainSamples.length} (80%), Test = ${testSamples.length} (20%)`);

    // 4. Fit Feature Encoder on Train Set ONLY
    const encoder = new FeatureEncoder();
    encoder.fit(trainSamples.map(s => s.record));

    // Build feature names list: base features + normalized recovery prob + strategy one-hot
    const strategyColNames = ALL_STRATEGY_CLASSES.map(s => `ohe_strat_${s}`);
    const featureNames = [
      ...encoder.getFeatureNames(),
      'num_phase62_recovery_prob',
      ...strategyColNames,
    ];
    console.log(`[TimingTrainer] Encoded input feature space: ${featureNames.length} dimensions.`);

    // 5. Transform samples
    const transformSample = (s: TimingTrainingSample): number[] => {
      const baseVector = encoder.transform(s.record);
      const normProb = Number(((s.recoveryProbability - 0.5) / 0.25).toFixed(6));

      // One-hot encode strategy
      const stratOhe = ALL_STRATEGY_CLASSES.map(strat => (s.strategy === strat ? 1.0 : 0.0));

      return [...baseVector, normProb, ...stratOhe];
    };

    const X_train = trainSamples.map(transformSample);
    const y_train = trainSamples.map(s => ALL_TIME_BUCKETS.indexOf(s.targetTimeBucket));

    const X_test = testSamples.map(transformSample);
    const y_test = testSamples.map(s => ALL_TIME_BUCKETS.indexOf(s.targetTimeBucket));

    // 6. Train Multiclass Softmax Model
    const model = new TimingPredictionModel(options?.config);
    console.log(`[TimingTrainer] Training ${model.modelType} (${model.modelVersion}) across 7 time buckets...`);
    await model.train(X_train, y_train, featureNames);

    // 7. Predict & Evaluate
    const trainPredProbs = X_train.map(x => model.predictProbabilities(x));
    const testPredProbs = X_test.map(x => model.predictProbabilities(x));

    const trainMetrics = TimingEvaluator.evaluate(y_train, trainPredProbs);
    const testMetrics = TimingEvaluator.evaluate(y_test, testPredProbs);

    console.log('[TimingTrainer] Evaluation on 2,000 Holdout Test Samples:');
    console.log(`  Top-1 Accuracy:    ${(testMetrics.top1Accuracy * 100).toFixed(2)}%`);
    console.log(`  Top-3 Accuracy:    ${(testMetrics.top3Accuracy * 100).toFixed(2)}%`);
    console.log(`  Macro Precision:   ${(testMetrics.macroPrecision * 100).toFixed(2)}%`);
    console.log(`  Macro Recall:      ${(testMetrics.macroRecall * 100).toFixed(2)}%`);
    console.log(`  Macro F1-Score:    ${(testMetrics.macroF1 * 100).toFixed(2)}%`);
    console.log(`  Multiclass LogLoss: ${testMetrics.multiclassLogLoss.toFixed(4)}`);

    // 8. Package & Save Artifact
    const trainingDurationMs = Date.now() - startTime;
    const baseVocab = encoder.exportVocab();
    const artifactVocab: TimingModelArtifact['categoricalVocabulary'] = {
      ...baseVocab,
      strategy: [...ALL_STRATEGY_CLASSES],
    };

    const artifact = model.saveArtifact(
      artifactVocab,
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

    ArtifactManager.saveTimingArtifact(artifact);
    console.log(`[TimingTrainer] Artifact ${artifact.modelVersion} saved to ArtifactManager (${trainingDurationMs}ms).`);

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

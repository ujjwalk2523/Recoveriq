import { FeatureEncoder } from './encoder';
import { LogisticRegressionModel, LogisticRegressionConfig } from './logistic-regression';
import { MLEvaluator } from './evaluator';
import { ModelArtifact } from './model-types';
import { FeatureRecord } from './feature-types';
import { DatasetGenerator } from './dataset-generator';
import { SyntheticDatasetGenerator } from './synthetic-dataset';
import { ModelRegistry } from './model-registry';

export interface TrainingPipelineResult {
  artifact: ModelArtifact;
  metrics: ModelArtifact['metrics'];
  featureCount: number;
  trainSamples: number;
  testSamples: number;
}

export class TrainingPipeline {
  /**
   * Runs the complete end-to-end ML training pipeline:
   * Load Data -> 80/20 Chronological Split -> Fit Encoder -> Train Model -> Evaluate -> Register Artifact
   */
  static async trainRecoveryModel(options?: {
    records?: FeatureRecord[];
    isSynthetic?: boolean;
    config?: LogisticRegressionConfig;
  }): Promise<TrainingPipelineResult> {
    const startTime = Date.now();
    console.log('[TrainingPipeline] Initializing Recovery Probability ML training pipeline...');

    // 1. Load Dataset
    let dataset = options?.records;
    let isSynthetic = options?.isSynthetic ?? false;

    if (!dataset || dataset.length === 0) {
      console.log('[TrainingPipeline] Generating 10,000 synthetic development samples with realistic domain correlations...');
      const synthetic = SyntheticDatasetGenerator.generate({ sampleCount: 10000 });
      dataset = synthetic.records;
      isSynthetic = true;
    }

    const totalSamples = dataset.length;
    console.log(`[TrainingPipeline] Loaded ${totalSamples} samples (isSyntheticDevelopmentData: ${isSynthetic})`);

    // 2. Chronological 80/20 Train/Test Split (Preserves temporal ordering)
    const split = DatasetGenerator.splitChronological(dataset, 0.8);
    const trainRecords = split.train;
    const testRecords = split.test;

    console.log(`[TrainingPipeline] Split complete: Train = ${trainRecords.length} (80%), Test = ${testRecords.length} (20%)`);

    // 3. Fit Feature Encoder on Train Split ONLY (prevent data leakage)
    const encoder = new FeatureEncoder();
    encoder.fit(trainRecords);
    const featureNames = encoder.getFeatureNames();

    console.log(`[TrainingPipeline] Fitted FeatureEncoder with ${featureNames.length} encoded features.`);

    // 4. Transform Feature Records to Numerical Matrices
    const X_train = trainRecords.map(r => encoder.transform(r));
    const y_train = trainRecords.map(r => r.features.target_recovered ?? 0);

    const X_test = testRecords.map(r => encoder.transform(r));
    const y_test = testRecords.map(r => r.features.target_recovered ?? 0);

    // 5. Train Logistic Regression Model
    const model = new LogisticRegressionModel(options?.config);
    console.log(`[TrainingPipeline] Training ${model.modelType} (${model.modelVersion})...`);
    await model.train(X_train, y_train, featureNames);

    // 6. Predict Probabilities & Evaluate
    console.log('[TrainingPipeline] Generating predictions for Train and Test sets...');
    const y_train_preds = X_train.map(x => model.predictProbability(x));
    const y_test_preds = X_test.map(x => model.predictProbability(x));

    const trainMetrics = MLEvaluator.evaluate(y_train, y_train_preds);
    const testMetrics = MLEvaluator.evaluate(y_test, y_test_preds);

    console.log('[TrainingPipeline] Evaluation Results on Test Set (20%):');
    console.log(`  Accuracy:    ${(testMetrics.accuracy * 100).toFixed(2)}%`);
    console.log(`  Precision:   ${(testMetrics.precision * 100).toFixed(2)}%`);
    console.log(`  Recall:      ${(testMetrics.recall * 100).toFixed(2)}%`);
    console.log(`  F1-Score:    ${(testMetrics.f1 * 100).toFixed(2)}%`);
    console.log(`  ROC-AUC:     ${testMetrics.rocAuc.toFixed(4)}`);
    console.log(`  Log Loss:    ${testMetrics.logLoss.toFixed(4)}`);
    console.log(`  Brier Score: ${testMetrics.brierScore.toFixed(4)}`);

    // 7. Package Versioned Model Artifact
    const trainingDurationMs = Date.now() - startTime;
    const artifact: ModelArtifact = model.saveArtifact(
      encoder.exportVocab(),
      encoder.exportStats(),
      { train: trainMetrics, test: testMetrics },
      {
        datasetSize: totalSamples,
        trainSize: trainRecords.length,
        testSize: testRecords.length,
        isSyntheticDevelopmentData: isSynthetic,
        trainingDurationMs,
      }
    );

    // 8. Register in Model Registry
    ModelRegistry.registerModel(artifact);
    console.log(`[TrainingPipeline] Successfully registered model artifact ${artifact.modelVersion} in Model Registry (${trainingDurationMs}ms).`);

    return {
      artifact,
      metrics: artifact.metrics,
      featureCount: featureNames.length,
      trainSamples: trainRecords.length,
      testSamples: testRecords.length,
    };
  }
}

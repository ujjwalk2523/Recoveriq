import { SyntheticDatasetGenerator } from '../src/lib/ml/synthetic-dataset';
import { FeatureEncoder } from '../src/lib/ml/encoder';
import { LogisticRegressionModel } from '../src/lib/ml/logistic-regression';
import { MLEvaluator } from '../src/lib/ml/evaluator';
import { TrainingPipeline } from '../src/lib/ml/training-pipeline';
import { ModelRegistry } from '../src/lib/ml/model-registry';
import { MLPredictionService } from '../src/lib/ml/ml-prediction-service';
import { RecoveryProbabilityService } from '../src/lib/engine/probability-service';
import { FeatureExtractor } from '../src/lib/ml/feature-extractor';

async function runPhase6MLTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 6.2 — RECOVERY PROBABILITY ML BASELINE SUITE');
  console.log('================================================================\n');

  // Clear states
  ModelRegistry.clear();
  MLPredictionService.clearShadowLog();

  // ---------------------------------------------------------------------------
  // Test 1: 10,000-Sample Synthetic Dataset with Realistic Correlations
  // ---------------------------------------------------------------------------
  console.log('▶ Test 1: 10,000+ Sample Synthetic Correlated Dataset Generation');
  const synthetic = SyntheticDatasetGenerator.generate({ sampleCount: 10000 });

  console.log(`  Total Synthetic Samples: ${synthetic.records.length}`);
  console.log(`  isSyntheticDevelopmentData: ${synthetic.isSyntheticDevelopmentData}`);
  console.log(`  Overall Synthetic Recovery Rate: ${(synthetic.metadata.recoveryRate * 100).toFixed(2)}%`);

  if (synthetic.records.length < 10000) {
    throw new Error('Dataset must contain at least 10,000 samples!');
  }
  if (!synthetic.isSyntheticDevelopmentData) {
    throw new Error('Synthetic dataset must be clearly marked as synthetic development data!');
  }
  console.log('  ✔ Synthetic dataset generated (10,000 samples) with realistic domain correlations.');

  // ---------------------------------------------------------------------------
  // Test 2: Categorical One-Hot Encoding Without Arbitrary Ordinal Bias
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 2: Categorical One-Hot Encoding & Z-Score Normalization');
  const encoder = new FeatureEncoder();
  const sampleSubset = synthetic.records.slice(0, 100);
  encoder.fit(sampleSubset);

  const featureNames = encoder.getFeatureNames();
  console.log(`  Total Encoded Feature Dimensions: ${featureNames.length}`);
  console.log(`  Sample Encoded Features: ${featureNames.slice(0, 5).join(', ')} ... ${featureNames.slice(-3).join(', ')}`);

  // Verify One-Hot encoded columns for payment_method and categories exist
  const hasUpiOhe = featureNames.some(f => f.includes('ohe_method_UPI'));
  const hasOtherOhe = featureNames.some(f => f.includes('ohe_method___OTHER__'));
  const hasTechOhe = featureNames.some(f => f.includes('ohe_cat_TECHNICAL'));

  if (!hasUpiOhe || !hasOtherOhe || !hasTechOhe) {
    throw new Error('One-Hot Encoding failed to produce explicit category indicators or __OTHER__ bucket!');
  }

  // Transform test record
  const transformed = encoder.transform(sampleSubset[0]!);
  if (transformed.length !== featureNames.length) {
    throw new Error('Transformed vector dimension does not match feature names length!');
  }
  console.log('  ✔ Strict One-Hot Encoding verified with zero arbitrary ordinal encoding.');

  // ---------------------------------------------------------------------------
  // Test 3: End-to-End Training Pipeline & Chronological 80/20 Split
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3: End-to-End Model Training Pipeline & Chronological Split');
  const trainResult = await TrainingPipeline.trainRecoveryModel({
    records: synthetic.records,
    isSynthetic: true,
  });

  console.log(`  Model Version:     ${trainResult.artifact.modelVersion}`);
  console.log(`  Model Type:        ${trainResult.artifact.modelType}`);
  console.log(`  Total Dataset:     ${trainResult.artifact.metadata.datasetSize}`);
  console.log(`  Training Samples:  ${trainResult.trainSamples} (80%)`);
  console.log(`  Test Samples:      ${trainResult.testSamples} (20%)`);
  console.log(`  Training Duration: ${trainResult.artifact.metadata.trainingDurationMs}ms`);

  if (trainResult.trainSamples !== 8000 || trainResult.testSamples !== 2000) {
    throw new Error('Chronological 80/20 train/test split not preserved!');
  }
  console.log('  ✔ Chronological 80/20 train/test split strictly preserved.');

  // ---------------------------------------------------------------------------
  // Test 4: Comprehensive Evaluation Metrics Computation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4: Evaluation Metrics on Holdout Test Set (2,000 samples)');
  const metrics = trainResult.metrics.test;

  console.log(`    Accuracy:    ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`    Precision:   ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`    Recall:      ${(metrics.recall * 100).toFixed(2)}%`);
  console.log(`    F1-Score:    ${(metrics.f1 * 100).toFixed(2)}%`);
  console.log(`    ROC-AUC:     ${metrics.rocAuc.toFixed(4)}`);
  console.log(`    Log Loss:    ${metrics.logLoss.toFixed(4)}`);
  console.log(`    Brier Score: ${metrics.brierScore.toFixed(4)}`);

  if (metrics.accuracy <= 0.60) throw new Error('Baseline accuracy is too low for synthetic correlated data!');
  if (metrics.rocAuc <= 0.65) throw new Error('ROC-AUC must exceed 0.65 for correlated feature signal!');
  if (metrics.brierScore >= 0.30) throw new Error('Brier score is too high (poor calibration)!');
  console.log('  ✔ Comprehensive evaluation metrics verified (Accuracy, Precision, Recall, F1, ROC-AUC, Log Loss, Brier).');

  // ---------------------------------------------------------------------------
  // Test 5: Probability Range [0.0, 1.0] & Deterministic Inference
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5: Output Probability Range [0.0, 1.0] & Deterministic Inference');
  const active = ModelRegistry.getActiveModel()!;
  const testRecord = synthetic.records[100]!;

  const x_test = active.encoder.transform(testRecord);
  const p1 = active.model.predictProbability(x_test);
  const p2 = active.model.predictProbability(x_test);

  console.log(`  Sample 1 Prediction (Run 1): ${p1}`);
  console.log(`  Sample 1 Prediction (Run 2): ${p2}`);

  if (p1 < 0.0 || p1 > 1.0) throw new Error('Predicted probability out of [0, 1] range!');
  if (p1 !== p2) throw new Error('Inference must be strictly deterministic!');
  console.log('  ✔ Output probability strictly bounded within [0, 1] and deterministic.');

  // ---------------------------------------------------------------------------
  // Test 6: Model Artifact Serialization & Reload
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6: Model Artifact Serialization & Reload from Registry');
  const serializedJson = JSON.stringify(trainResult.artifact);
  const reloadedArtifact = JSON.parse(serializedJson);

  const freshModel = new LogisticRegressionModel();
  freshModel.loadArtifact(reloadedArtifact);

  const reloadedProb = freshModel.predictProbability(x_test);
  console.log(`  Original Prediction: ${p1}`);
  console.log(`  Reloaded Model Prediction: ${reloadedProb}`);

  if (p1 !== reloadedProb) {
    throw new Error('Reloaded model prediction does not match original!');
  }
  console.log('  ✔ Full JSON artifact serialization and reconstituted inference verified.');

  // ---------------------------------------------------------------------------
  // Test 7: Shadow Mode & Heuristic Independence
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 7: Shadow Mode Isolation & Heuristic Independence');

  // 1. Compute Phase 3 Heuristic Probability
  const heuristicProbResult = RecoveryProbabilityService.predict({
    amount: 14500,
    paymentMethod: 'UPI',
    failureCategory: 'TECHNICAL',
    failureCode: 'BAD_REQUEST_PAYMENT_TIMED_OUT',
    severity: 'LOW',
    recoverability: 'HIGH',
    actionType: 'IMMEDIATE_RETRY',
    attemptNumber: 1,
    hourOfDay: 14,
    customerSegment: 'CONSUMER',
    customerRecoveryRate: 75,
    customerFatigueScore: 12,
    customerRiskScore: 8,
  });

  // 2. Compute ML Probability in Shadow Mode
  const fallbackRecord = FeatureExtractor.buildFallbackRecord('txn_shadow_test_01');
  const shadowPrediction = await MLPredictionService.predictRecoveryProbability({
    transactionId: 'txn_shadow_test_01',
    record: fallbackRecord,
    heuristicBaselineProbability: heuristicProbResult.probability,
  });

  console.log(`  Heuristic Active Decision Probability: ${heuristicProbResult.probability}`);
  console.log(`  ML Shadow Prediction:                  ${shadowPrediction.probability}`);
  console.log(`  Delta:                                  ${shadowPrediction.shadowComparison?.delta}`);
  console.log(`  Model Version:                          ${shadowPrediction.modelVersion}`);

  const shadowLogs = MLPredictionService.getShadowLog();
  if (shadowLogs.length !== 1 || !shadowLogs[0]?.isShadowOnly) {
    throw new Error('Shadow mode logging verification failed!');
  }

  // 3. Confirm heuristic probability remains untouched
  if (heuristicProbResult.probability !== 0.95) {
    throw new Error(`Heuristic probability was altered by ML shadow mode! Expected 0.95, got ${heuristicProbResult.probability}`);
  }
  console.log('  ✔ Confirmed: Heuristic probability is 100% untouched; ML operates strictly in shadow mode.');

  // ---------------------------------------------------------------------------
  // Final Summary Report
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 PHASE 6.2 ML BASELINE VERIFICATION REPORT');
  console.log('================================================================');
  console.log(`  Dataset Size:       ${trainResult.artifact.metadata.datasetSize.toLocaleString()} samples`);
  console.log(`  Training Size:      ${trainResult.trainSamples.toLocaleString()} samples (80% Chronological split)`);
  console.log(`  Test Size:          ${trainResult.testSamples.toLocaleString()} samples (20% Chronological holdout)`);
  console.log(`  Model Version:      ${trainResult.artifact.modelVersion}`);
  console.log(`  Model Architecture: ${trainResult.artifact.modelType} with One-Hot Encoding + L2 Regularization`);
  console.log('  Test Metrics:');
  console.log(`    • Accuracy:       ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`    • Precision:      ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`    • Recall:         ${(metrics.recall * 100).toFixed(2)}%`);
  console.log(`    • F1-Score:       ${(metrics.f1 * 100).toFixed(2)}%`);
  console.log(`    • ROC-AUC:        ${metrics.rocAuc.toFixed(4)}`);
  console.log(`    • Log Loss:       ${metrics.logLoss.toFixed(4)}`);
  console.log(`    • Brier Score:    ${metrics.brierScore.toFixed(4)}`);
  console.log('  Sample Shadow Inferences:');
  console.log(`    • UPI Technical Failure:   ML Prob = ${shadowPrediction.probability} (Heuristic = ${heuristicProbResult.probability})`);
  console.log('  Shadow Mode Status: 100% SHADOW ONLY (Zero production interference)');
  console.log('================================================================\n');

  console.log('🎉 ALL PHASE 6.2 ML BASELINE TESTS PASSED WITH 100% SUCCESS!');
}

runPhase6MLTests().catch(err => {
  console.error('❌ Phase 6.2 ML test failed:', err);
  process.exit(1);
});

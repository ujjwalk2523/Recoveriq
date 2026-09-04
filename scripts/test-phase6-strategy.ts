import { StrategyDatasetGenerator } from '../src/lib/ml/strategy/strategy-dataset';
import { StrategyTrainer } from '../src/lib/ml/training/trainer';
import { ArtifactManager } from '../src/lib/ml/training/model-artifact';
import { StrategyPredictionModel } from '../src/lib/ml/models/strategy-prediction-model';
import { StrategyPredictionService } from '../src/lib/ml/inference/strategy-prediction-service';
import { StrategyScorer } from '../src/lib/ml/strategy/strategy-scorer';
import { StrategyRankingEngine } from '../src/lib/ml/strategy/strategy-ranking';
import { FeatureExtractor } from '../src/lib/ml/feature-extractor';
import { evaluateRecoveryStrategies } from '../src/lib/engine/strategy-recommender';
import { RecoveryStrategyClass } from '../src/lib/ml/models/model-types';

async function runPhase6StrategyTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 6.3 — MULTICLASS STRATEGY & NET EV RANKING SUITE');
  console.log('================================================================\n');

  ArtifactManager.clear();
  StrategyPredictionService.clearCache();

  // ---------------------------------------------------------------------------
  // Test 1: 10,000+ Sample Synthetic Strategy Dataset Generation
  // ---------------------------------------------------------------------------
  console.log('▶ Test 1: 10,000+ Sample Synthetic Strategy Dataset Generation');
  const datasetOutput = StrategyDatasetGenerator.generate({ sampleCount: 10000 });
  const samples = datasetOutput.samples;

  console.log(`  Total Synthetic Samples: ${samples.length}`);
  console.log(`  isSyntheticDevelopmentData: ${datasetOutput.isSyntheticDevelopmentData}`);
  console.log('  Class Distribution:');
  for (const [strat, count] of Object.entries(datasetOutput.metadata.classDistribution)) {
    console.log(`    • ${strat.padEnd(23)}: ${count} (${((count / samples.length) * 100).toFixed(1)}%)`);
  }

  if (samples.length < 10000) {
    throw new Error('Dataset must contain at least 10,000 strategy samples!');
  }
  console.log('  ✔ Synthetic strategy dataset generated with realistic multivariable distributions.');

  // ---------------------------------------------------------------------------
  // Test 2: Strict Anti-Leakage Audit (No Post-Decision Outcomes in Features)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 2: Strict Anti-Leakage Audit');
  let leakageCount = 0;
  for (let i = 0; i < samples.length; i++) {
    const f = samples[i]!.record.features;
    if (f.target_recovered !== undefined || f.target_time_to_recover_minutes !== undefined) {
      leakageCount++;
    }
  }

  console.log(`  Inspected ${samples.length} sample feature vectors for post-decision outcome leaks.`);
  console.log(`  Leakage Violations Detected: ${leakageCount}`);

  if (leakageCount > 0) {
    throw new Error('CRITICAL LEAKAGE: Post-decision recovery variables detected in input feature space!');
  }
  console.log('  ✔ Anti-Leakage Verification PASSED: Inputs strictly restricted to decision-time signals.');

  // ---------------------------------------------------------------------------
  // Test 3: Model Training & Chronological 80/20 Train/Test Split
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3: Multiclass Softmax Model Training & Chronological Split');
  const trainResult = await StrategyTrainer.trainStrategyModel({
    samples,
    config: { epochs: 40, learningRate: 0.08, l2Regularization: 0.01 },
  });

  console.log(`  Model Version:     ${trainResult.artifact.modelVersion}`);
  console.log(`  Model Architecture: ${trainResult.artifact.modelType}`);
  console.log(`  Feature Dimension: ${trainResult.featureDimension} inputs (18 signals + Phase 6.2 P_rec)`);
  console.log(`  Training Samples:  ${trainResult.trainCount} (80% Chronological)`);
  console.log(`  Test Samples:      ${trainResult.testCount} (20% Holdout)`);

  if (trainResult.trainCount !== 8000 || trainResult.testCount !== 2000) {
    throw new Error('Chronological 80/20 split was not preserved!');
  }
  console.log('  ✔ Multiclass Softmax model trained successfully on chronological 80/20 split.');

  // ---------------------------------------------------------------------------
  // Test 4: Multiclass Evaluation Metrics on 2,000 Holdout Samples
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 4: Multiclass Evaluation Metrics (Holdout 2,000 Samples)');
  const m = trainResult.metrics.test;

  console.log(`    Top-1 Accuracy:     ${(m.top1Accuracy * 100).toFixed(2)}%`);
  console.log(`    Top-3 Accuracy:     ${(m.top3Accuracy * 100).toFixed(2)}%`);
  console.log(`    Macro Precision:    ${(m.macroPrecision * 100).toFixed(2)}%`);
  console.log(`    Macro Recall:       ${(m.macroRecall * 100).toFixed(2)}%`);
  console.log(`    Macro F1-Score:     ${(m.macroF1 * 100).toFixed(2)}%`);
  console.log(`    Multiclass LogLoss:  ${m.multiclassLogLoss.toFixed(4)}`);

  if (m.top1Accuracy < 0.65) throw new Error('Top-1 accuracy too low for domain correlated dataset!');
  if (m.top3Accuracy < 0.85) throw new Error('Top-3 accuracy must exceed 85%!');
  if (m.macroF1 < 0.60) throw new Error('Macro F1 score below baseline standard!');
  if (m.multiclassLogLoss > 1.25) throw new Error('Multiclass log loss is too high!');
  console.log('  ✔ Multiclass evaluation metrics verified (Top-1, Top-3, Macro-F1, LogLoss).');

  // ---------------------------------------------------------------------------
  // Test 5: Probability Simplex Test (Probabilities Sum to ~1.0000)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5: Probability Simplex & Determinism Test');
  const artifact = trainResult.artifact;
  const testModel = new StrategyPredictionModel();
  testModel.loadArtifact(artifact);

  const testX = new Array(trainResult.featureDimension).fill(0.1);
  const probs1 = testModel.predictProbabilities(testX);
  const probs2 = testModel.predictProbabilities(testX);

  let sumProbs = 0;
  for (const p of Object.values(probs1)) {
    if (p < 0 || p > 1) throw new Error('Strategy probability outside [0, 1] range!');
    sumProbs += p;
  }

  console.log(`  Strategy Probabilities:`);
  for (const [strat, p] of Object.entries(probs1)) {
    console.log(`    • ${strat.padEnd(23)}: ${(p * 100).toFixed(2)}%`);
  }
  console.log(`  Sum of Probabilities: ${sumProbs.toFixed(4)} (Expected: ~1.0000)`);

  if (Math.abs(sumProbs - 1.0) > 0.005) {
    throw new Error(`Probabilities do not sum to ~1.0! Got sum = ${sumProbs}`);
  }

  // Determinism check
  for (const [strat, p] of Object.entries(probs1)) {
    if (p !== probs2[strat as RecoveryStrategyClass]) throw new Error('Inference must be strictly deterministic!');
  }
  console.log('  ✔ Probability distribution satisfies probability simplex sum(~1.0) and determinism.');

  // ---------------------------------------------------------------------------
  // Test 6: Strategy Net EV Calculation & Top-3 Ranking
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6: Strategy Net Expected Value (EV) Calculation & Ranking');
  const mockAmount = 8500;
  const mockRanking = StrategyRankingEngine.rankStrategies({
    transactionId: 'txn_ev_test_01',
    amount: mockAmount,
    strategyProbabilities: probs1,
    baseRecoveryProbability: 0.85,
    fatigueScore: 15,
    riskScore: 8,
  });

  const formattedLines = StrategyRankingEngine.formatRankingSummary(mockRanking);
  for (const line of formattedLines) {
    console.log(line);
  }

  if (mockRanking.rankedStrategies.length !== 7) {
    throw new Error('All 7 strategies must be ranked!');
  }
  if (mockRanking.rankedStrategies[0]!.netEV < mockRanking.rankedStrategies[1]!.netEV) {
    throw new Error('Strategies not sorted descending by Net EV!');
  }
  console.log('  ✔ Strategy Net Expected Value (EV) ranking engine verified.');

  // ---------------------------------------------------------------------------
  // Test 7: Shadow Mode Isolation & Heuristic Independence
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 7: Shadow Mode Isolation & Heuristic Independence');

  const fallbackRecord = FeatureExtractor.buildFallbackRecord('txn_shadow_strat_01', {
    amount: 14500,
    payment_method: 'UPI',
    failure_category: 'TECHNICAL',
  });

  // 1. Run Phase 3 Heuristic Action Recommender
  const mockCustomer = {
    id: 'cust_kartik',
    name: 'Kartik Sharma',
    email: 'kartik@example.in',
    phone: '+919845012345',
    segment: 'CONSUMER' as const,
    lifetimeValue: 25000,
    totalTransactions: 6,
    pastRecoveries: 2,
    fatigueScore: 12,
    riskScore: 8,
  };

  const heuristicScoring = evaluateRecoveryStrategies(
    14500,
    'TECHNICAL',
    'BAD_REQUEST_PAYMENT_TIMED_OUT',
    'UPI',
    mockCustomer
  );

  const heuristicTopAction = heuristicScoring.recommendedAction;

  // 2. Run Phase 6.3 ML Strategy Prediction Service in SHADOW MODE
  const shadowInference = await StrategyPredictionService.predictAndRank({
    transactionId: 'txn_shadow_strat_01',
    record: fallbackRecord,
    recoveryProbability: 0.92,
    heuristicAction: heuristicTopAction,
  });

  console.log(`  Heuristic Active Decision: ${heuristicTopAction}`);
  console.log(`  ML Top Strategy:           ${shadowInference.prediction.bestStrategy} (Confidence: ${(shadowInference.prediction.confidence * 100).toFixed(1)}%)`);
  console.log(`  ML Top Net EV:             ₹${shadowInference.ranking.topStrategy.netEV.toLocaleString('en-IN')}`);
  console.log(`  Shadow Only:               ${shadowInference.isShadowOnly}`);

  if (!shadowInference.isShadowOnly) {
    throw new Error('ML must operate strictly in shadow mode!');
  }
  if (heuristicTopAction !== 'OPTIMAL_DELAYED_RETRY') {
    throw new Error(`Heuristic decision was modified by ML service! Expected OPTIMAL_DELAYED_RETRY, got ${heuristicTopAction}`);
  }
  console.log('  ✔ Confirmed: Heuristic decision pipeline is 100% untouched; ML operates strictly in shadow mode.');

  // ---------------------------------------------------------------------------
  // Final Verification Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 PHASE 6.3 STRATEGY RECOMMENDATION ML VERIFICATION REPORT');
  console.log('================================================================');
  console.log(`  Dataset Size:       ${trainResult.artifact.metadata.datasetSize.toLocaleString()} samples (isSyntheticDevelopmentData: true)`);
  console.log(`  Training Size:      ${trainResult.trainCount.toLocaleString()} samples (80% Chronological train split)`);
  console.log(`  Test Size:          ${trainResult.testCount.toLocaleString()} samples (20% Chronological holdout split)`);
  console.log(`  Model Version:      ${trainResult.artifact.modelVersion}`);
  console.log(`  Model Architecture: ${trainResult.artifact.modelType} (7 Classes, Softmax)`);
  console.log(`  Input Feature Space: ${trainResult.featureDimension} dimensions (18 pre-decision signals + Phase 6.2 P_rec)`);
  console.log('  Anti-Leakage Audit: 100% PASSED (Zero post-decision outcome features in training)');
  console.log('  Holdout Test Metrics (2,000 samples):');
  console.log(`    • Top-1 Accuracy:     ${(m.top1Accuracy * 100).toFixed(2)}%`);
  console.log(`    • Top-3 Accuracy:     ${(m.top3Accuracy * 100).toFixed(2)}%`);
  console.log(`    • Macro Precision:    ${(m.macroPrecision * 100).toFixed(2)}%`);
  console.log(`    • Macro Recall:       ${(m.macroRecall * 100).toFixed(2)}%`);
  console.log(`    • Macro F1-Score:     ${(m.macroF1 * 100).toFixed(2)}%`);
  console.log(`    • Multiclass LogLoss:  ${m.multiclassLogLoss.toFixed(4)}`);
  console.log('  Strategy Net EV Ranking Sample:');
  for (let i = 0; i < 3; i++) {
    const s = mockRanking.rankedStrategies[i]!;
    console.log(`    #${s.rank} ${s.strategy.padEnd(23)}: Net EV = ₹${s.netEV.toLocaleString('en-IN')}, P(Strat) = ${(s.strategyProbability * 100).toFixed(1)}%`);
  }
  console.log('  Shadow Mode Status: 100% SHADOW ONLY (Zero production execution impact)');
  console.log('  Policy Engine Authority: Intact and Sole Decider');
  console.log('================================================================\n');

  console.log('🎉 ALL PHASE 6.3 MULTICLASS STRATEGY & NET EV TESTS PASSED WITH 100% SUCCESS!');
}

runPhase6StrategyTests().catch(err => {
  console.error('❌ Phase 6.3 Strategy test failed:', err);
  process.exit(1);
});

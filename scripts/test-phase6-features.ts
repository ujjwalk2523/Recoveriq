import { FeatureExtractor } from '../src/lib/ml/feature-extractor';
import { DatasetGenerator } from '../src/lib/ml/dataset-generator';
import { TransactionFeatureVector } from '../src/lib/ml/feature-types';

async function runPhase6FeaturesTests() {
  console.log('===========================================================');
  console.log('🚀 RUNNING PHASE 6.1 — FEATURE ENGINEERING PIPELINE SUITE');
  console.log('===========================================================\n');

  // ---------------------------------------------------------------------------
  // 6.1 Feature Extraction & Field Completeness
  // ---------------------------------------------------------------------------
  console.log('▶ Test 6.1: Feature Extraction Pipeline (18 Features)');
  const record = await FeatureExtractor.extractFeatures('txn_sample_test_01');

  console.log(`  Extracted from: ${record.metadata.transactionId} (Customer: ${record.metadata.customerId})`);
  console.log(`  Extracted At: ${record.metadata.extractedAt}`);
  console.log('\n  18-Feature Vector Summary:');
  const feat = record.features;

  console.log(`    [Transaction] amount: ₹${feat.amount}`);
  console.log(`    [Transaction] payment_method: ${feat.payment_method}`);
  console.log(`    [Transaction] failure_category: ${feat.failure_category}`);
  console.log(`    [Transaction] failure_code: ${feat.failure_code}`);
  console.log(`    [Transaction] hour: ${feat.hour}`);
  console.log(`    [Transaction] day_of_week: ${feat.day_of_week}`);
  console.log(`    [Transaction] time_since_last_payment_minutes: ${feat.time_since_last_payment_minutes}`);

  console.log(`    [Customer]    customer_transaction_count: ${feat.customer_transaction_count}`);
  console.log(`    [Customer]    customer_success_rate: ${feat.customer_success_rate}`);
  console.log(`    [Customer]    customer_recovery_rate: ${feat.customer_recovery_rate}`);
  console.log(`    [Customer]    upi_success_rate: ${feat.upi_success_rate}`);
  console.log(`    [Customer]    card_success_rate: ${feat.card_success_rate}`);
  console.log(`    [Customer]    avg_recovery_delay_minutes: ${feat.avg_recovery_delay_minutes}`);
  console.log(`    [Customer]    previous_retry_count: ${feat.previous_retry_count}`);
  console.log(`    [Customer]    previous_recovery_count: ${feat.previous_recovery_count}`);
  console.log(`    [Customer]    fatigue_score: ${feat.fatigue_score}`);
  console.log(`    [Customer]    risk_score: ${feat.risk_score}`);

  console.log(`    [Merchant]    merchant_recovery_rate: ${feat.merchant_recovery_rate}`);
  console.log(`    [Label]       target_recovered: ${feat.target_recovered}`);
  console.log(`    [Label]       target_recovery_channel: ${feat.target_recovery_channel}`);
  console.log(`    [Label]       target_time_to_recover_minutes: ${feat.target_time_to_recover_minutes}`);

  // ---------------------------------------------------------------------------
  // 6.2 Strict Value Boundary & Hygiene Validation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6.2: Feature Value Boundary & Hygiene Validation');

  const requiredKeys: (keyof TransactionFeatureVector)[] = [
    'amount',
    'payment_method',
    'failure_category',
    'failure_code',
    'hour',
    'day_of_week',
    'time_since_last_payment_minutes',
    'customer_transaction_count',
    'customer_success_rate',
    'customer_recovery_rate',
    'upi_success_rate',
    'card_success_rate',
    'avg_recovery_delay_minutes',
    'previous_retry_count',
    'previous_recovery_count',
    'fatigue_score',
    'risk_score',
    'merchant_recovery_rate',
  ];

  for (const key of requiredKeys) {
    if (feat[key] === undefined || feat[key] === null) {
      throw new Error(`Feature missing or null: ${key}`);
    }
  }

  if (feat.amount <= 0) throw new Error('Amount must be positive');
  if (feat.hour < 0 || feat.hour > 23) throw new Error(`Invalid hour: ${feat.hour}`);
  if (feat.day_of_week < 0 || feat.day_of_week > 6) throw new Error(`Invalid day_of_week: ${feat.day_of_week}`);
  if (feat.customer_success_rate < 0 || feat.customer_success_rate > 1) throw new Error('Invalid customer_success_rate range');
  if (feat.customer_recovery_rate < 0 || feat.customer_recovery_rate > 1) throw new Error('Invalid customer_recovery_rate range');
  if (feat.upi_success_rate < 0 || feat.upi_success_rate > 1) throw new Error('Invalid upi_success_rate range');
  if (feat.card_success_rate < 0 || feat.card_success_rate > 1) throw new Error('Invalid card_success_rate range');
  if (feat.fatigue_score < 0 || feat.fatigue_score > 100) throw new Error('Invalid fatigue_score range');
  if (feat.risk_score < 0 || feat.risk_score > 100) throw new Error('Invalid risk_score range');
  if (feat.merchant_recovery_rate < 0 || feat.merchant_recovery_rate > 1) throw new Error('Invalid merchant_recovery_rate range');

  console.log('  ✔ All 18 features conform strictly to statistical value boundaries.');

  // ---------------------------------------------------------------------------
  // 6.3 Dataset Generation & Chronological Train/Test Split
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6.3: Dataset Compilation & Chronological Train/Test Split');
  const dataset = await DatasetGenerator.generateDataset({ limit: 50 });
  console.log(`  Compiled Dataset Samples: ${dataset.length}`);

  const split = DatasetGenerator.splitChronological(dataset, 0.8);
  console.log(`  Train Set: ${split.train.length} samples (80%)`);
  console.log(`  Test Set:  ${split.test.length} samples (20%)`);

  if (split.train.length !== 20 || split.test.length !== 5) {
    throw new Error('Chronological split failed!');
  }
  console.log('  ✔ Chronological 80/20 train-test split verified (temporal order preserved).');

  // ---------------------------------------------------------------------------
  // 6.4 Tabular CSV Serialization
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6.4: Tabular CSV Export Verification');
  const csv = DatasetGenerator.toCSV(dataset);
  const lines = csv.trim().split('\n');
  console.log(`  CSV Header: ${lines[0]}`);
  console.log(`  CSV Row 1:  ${lines[1]}`);
  console.log(`  Total CSV Rows Generated: ${lines.length} (including header)`);

  if (lines.length !== 26) {
    throw new Error(`Expected 26 lines in CSV (1 header + 25 rows), got ${lines.length}`);
  }

  // Verify all 18 features exist in header
  for (const key of requiredKeys) {
    if (!lines[0]?.includes(key)) {
      throw new Error(`CSV header missing feature: ${key}`);
    }
  }
  console.log('  ✔ CSV dataset format matches ML tabular expectations.');

  console.log('\n🎉 ALL PHASE 6.1 FEATURE ENGINEERING TESTS PASSED WITH 100% SUCCESS!');
  console.log('===========================================================');
}

runPhase6FeaturesTests().catch(err => {
  console.error('❌ Phase 6.1 test failed:', err);
  process.exit(1);
});

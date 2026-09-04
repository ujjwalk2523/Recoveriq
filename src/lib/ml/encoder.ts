import { FeatureRecord, TransactionFeatureVector } from './feature-types';

export class FeatureEncoder {
  private categoricalVocab = {
    payment_method: [] as string[],
    failure_category: [] as string[],
    failure_code: [] as string[],
  };

  private numericalStats = {
    mean: {} as Record<string, number>,
    std: {} as Record<string, number>,
  };

  private featureNames: string[] = [];
  private isFitted = false;

  private static NUMERICAL_KEYS: (keyof TransactionFeatureVector)[] = [
    'amount',
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

  /**
   * Fits vocabularies and z-score statistics strictly from the training partition
   */
  fit(trainingRecords: FeatureRecord[]): void {
    if (trainingRecords.length === 0) {
      throw new Error('Cannot fit FeatureEncoder on an empty dataset.');
    }

    // 1. Extract Unique Categorical Vocabularies
    const methods = new Set<string>();
    const categories = new Set<string>();
    const codes = new Set<string>();

    for (const r of trainingRecords) {
      if (r.features.payment_method) methods.add(r.features.payment_method);
      if (r.features.failure_category) categories.add(r.features.failure_category);
      if (r.features.failure_code) codes.add(r.features.failure_code);
    }

    this.categoricalVocab = {
      payment_method: Array.from(methods).sort(),
      failure_category: Array.from(categories).sort(),
      failure_code: Array.from(codes).sort(),
    };

    // 2. Compute Mean and Standard Deviation for Numerical Features
    const means: Record<string, number> = {};
    const stds: Record<string, number> = {};

    for (const key of FeatureEncoder.NUMERICAL_KEYS) {
      const values = trainingRecords.map(r => Number(r.features[key] ?? 0));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      means[key] = mean;
      stds[key] = std > 1e-6 ? std : 1.0; // avoid division by zero
    }

    this.numericalStats = { mean: means, std: stds };

    // 3. Assemble Ordered Feature Names
    const names: string[] = [];

    // Numerical standardized feature names
    for (const key of FeatureEncoder.NUMERICAL_KEYS) {
      names.push(`num_${key}`);
    }

    // Categorical One-Hot names (including __OTHER__)
    for (const m of this.categoricalVocab.payment_method) {
      names.push(`ohe_method_${m}`);
    }
    names.push('ohe_method___OTHER__');

    for (const c of this.categoricalVocab.failure_category) {
      names.push(`ohe_cat_${c}`);
    }
    names.push('ohe_cat___OTHER__');

    for (const code of this.categoricalVocab.failure_code) {
      names.push(`ohe_code_${code}`);
    }
    names.push('ohe_code___OTHER__');

    this.featureNames = names;
    this.isFitted = true;
  }

  /**
   * Transforms a single feature record into a numerical vector x in R^D
   */
  transform(record: FeatureRecord): number[] {
    if (!this.isFitted) {
      throw new Error('FeatureEncoder must be fitted before calling transform().');
    }

    const vector: number[] = [];
    const f = record.features;

    // 1. Numerical Z-Score Scaling
    for (const key of FeatureEncoder.NUMERICAL_KEYS) {
      const rawVal = Number(f[key] ?? 0);
      const mean = this.numericalStats.mean[key] ?? 0;
      const std = this.numericalStats.std[key] ?? 1.0;
      const zScore = (rawVal - mean) / std;
      vector.push(Number(zScore.toFixed(6)));
    }

    // 2. One-Hot Encode payment_method
    let methodMatched = false;
    for (const m of this.categoricalVocab.payment_method) {
      if (f.payment_method === m) {
        vector.push(1);
        methodMatched = true;
      } else {
        vector.push(0);
      }
    }
    vector.push(methodMatched ? 0 : 1); // __OTHER__

    // 3. One-Hot Encode failure_category
    let catMatched = false;
    for (const c of this.categoricalVocab.failure_category) {
      if (f.failure_category === c) {
        vector.push(1);
        catMatched = true;
      } else {
        vector.push(0);
      }
    }
    vector.push(catMatched ? 0 : 1); // __OTHER__

    // 4. One-Hot Encode failure_code
    let codeMatched = false;
    for (const code of this.categoricalVocab.failure_code) {
      if (f.failure_code === code) {
        vector.push(1);
        codeMatched = true;
      } else {
        vector.push(0);
      }
    }
    vector.push(codeMatched ? 0 : 1); // __OTHER__

    return vector;
  }

  /**
   * Batch transformation helper
   */
  fitTransform(trainingRecords: FeatureRecord[]): number[][] {
    this.fit(trainingRecords);
    return trainingRecords.map(r => this.transform(r));
  }

  getFeatureNames(): string[] {
    return [...this.featureNames];
  }

  exportVocab(): typeof this.categoricalVocab {
    return JSON.parse(JSON.stringify(this.categoricalVocab));
  }

  exportStats(): typeof this.numericalStats {
    return JSON.parse(JSON.stringify(this.numericalStats));
  }

  loadState(
    vocab: typeof this.categoricalVocab,
    stats: typeof this.numericalStats,
    featureNames: string[]
  ): void {
    this.categoricalVocab = JSON.parse(JSON.stringify(vocab));
    this.numericalStats = JSON.parse(JSON.stringify(stats));
    this.featureNames = [...featureNames];
    this.isFitted = true;
  }
}

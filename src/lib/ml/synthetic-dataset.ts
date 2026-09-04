import { FeatureRecord, TransactionFeatureVector } from './feature-types';

export interface SyntheticDatasetOptions {
  sampleCount?: number;
  noiseLevel?: number;
  seed?: number;
}

export class SyntheticDatasetGenerator {
  /**
   * Generates a statistically correlated synthetic dataset (>= 10,000 samples)
   * explicitly marked as synthetic development data
   */
  static generate(options?: SyntheticDatasetOptions): {
    records: FeatureRecord[];
    isSyntheticDevelopmentData: true;
    metadata: {
      generatedAt: string;
      sampleCount: number;
      recoveryRate: number;
    };
  } {
    const N = Math.max(10000, options?.sampleCount ?? 10000);
    const records: FeatureRecord[] = new Array(N);

    const methods = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
    const methodWeights = [0.65, 0.20, 0.10, 0.05]; // 65% UPI, 20% Card, 10% Netbanking, 5% Wallet

    const categories = [
      'TECHNICAL',
      'INSUFFICIENT_FUNDS',
      'USER_AUTHENTICATION',
      'GATEWAY_DOWNTIME',
      'RISK_AND_FRAUD',
    ];
    const categoryWeights = [0.45, 0.30, 0.15, 0.08, 0.02];

    const failureCodes: Record<string, string[]> = {
      TECHNICAL: ['BAD_REQUEST_PAYMENT_TIMED_OUT', 'NPCI_SWITCH_UNAVAILABLE', 'INTERNAL_SERVER_ERROR'],
      INSUFFICIENT_FUNDS: ['PAYMENT_FAILED_INSUFFICIENT_BALANCE', 'LIMIT_EXCEEDED'],
      USER_AUTHENTICATION: ['AUTH_FAILED_OTP_TIMEOUT', '3DS_VERIFICATION_FAILED'],
      GATEWAY_DOWNTIME: ['GATEWAY_DOWNTIME_503', 'BANK_CIRCUIT_BREAKER'],
      RISK_AND_FRAUD: ['FRAUD_SUSPECTED_VELOCITY_TRIGGER', 'BLACKLISTED_CARD'],
    };

    let totalRecovered = 0;
    const baseTimestamp = Date.now() - 30 * 24 * 3600 * 1000; // start 30 days ago for temporal progression

    // Pseudo-random deterministic function
    let currentSeed = options?.seed ?? 42;
    const random = () => {
      currentSeed = (currentSeed * 16807) % 2147483647;
      return (currentSeed - 1) / 2147483646;
    };

    const chooseWeighted = (items: string[], weights: number[]): string => {
      const r = random();
      let cumulative = 0;
      for (let i = 0; i < items.length; i++) {
        cumulative += weights[i]!;
        if (r <= cumulative) return items[i]!;
      }
      return items[items.length - 1]!;
    };

    for (let i = 0; i < N; i++) {
      // 1. Transaction Features
      const paymentMethod = chooseWeighted(methods, methodWeights);
      const failureCategory = chooseWeighted(categories, categoryWeights);
      const possibleCodes = failureCodes[failureCategory] || ['GENERIC_ERROR'];
      const failureCode = possibleCodes[Math.floor(random() * possibleCodes.length)]!;

      // Amount distribution: log-normal shape between ₹200 and ₹90,000
      const isHighTicket = random() < 0.10;
      const amount = isHighTicket
        ? Math.round(15000 + random() * 75000)
        : Math.round(200 + Math.pow(random(), 1.5) * 8000);

      // Temporal: Chronological step forward
      const createdAtMs = baseTimestamp + (i / N) * (30 * 24 * 3600 * 1000);
      const createdDate = new Date(createdAtMs);
      const hour = createdDate.getHours();
      const dayOfWeek = createdDate.getDay();
      const timeSinceLastPaymentMinutes = random() < 0.15 ? -1 : Math.round(60 + random() * 43200);

      // 2. Customer Features
      const customerTxnCount = Math.max(1, Math.round(1 + random() * 25));
      const customerSuccessRate = Number((0.40 + random() * 0.58).toFixed(4));
      const customerRecoveryRate = Number((0.25 + random() * 0.70).toFixed(4));
      const upiSuccessRate = Number((0.50 + random() * 0.48).toFixed(4));
      const cardSuccessRate = Number((0.45 + random() * 0.50).toFixed(4));
      const avgRecoveryDelayMinutes = Number((5 + random() * 45).toFixed(2));
      const previousRetryCount = Math.floor(random() * 4);
      const previousRecoveryCount = Math.floor(customerTxnCount * customerRecoveryRate * 0.4);

      // Fatigue & Risk
      const fatigueScore = Math.min(100, Math.round(previousRetryCount * 22 + random() * 25));
      const isFraudCat = failureCategory === 'RISK_AND_FRAUD';
      const riskScore = isFraudCat ? Math.round(75 + random() * 25) : Math.round(random() * 35);

      // Merchant platform baseline
      const merchantRecoveryRate = Number((0.68 + (random() - 0.5) * 0.12).toFixed(4));

      // 3. Realistic Latent Recovery Probability Model (Ground-Truth Logit)
      // Positive contributors:
      // + Technical failure (+1.4)
      // + UPI rail (+0.6)
      // + High customer past recovery rate (+1.8 * rate)
      // + High customer success rate (+0.9 * rate)
      // + Business hours 10am-8pm (+0.35)
      // Negative contributors:
      // - Risk and fraud (-4.5)
      // - High ticket size (-0.7 per 10k)
      // - Excessive prior retries (-0.55 * count)
      // - High customer fatigue (-0.02 * fatigue)
      // - High risk score (-0.03 * risk)

      let logit = 0.2; // base intercept

      // Failure category impact
      if (failureCategory === 'TECHNICAL') logit += 1.4;
      else if (failureCategory === 'GATEWAY_DOWNTIME') logit += 1.1;
      else if (failureCategory === 'USER_AUTHENTICATION') logit += 0.5;
      else if (failureCategory === 'INSUFFICIENT_FUNDS') logit += 0.1;
      else if (failureCategory === 'RISK_AND_FRAUD') logit -= 4.5;

      // Payment method impact
      if (paymentMethod === 'UPI') logit += 0.6;
      else if (paymentMethod === 'CARD') logit += 0.2;
      else if (paymentMethod === 'NETBANKING') logit -= 0.4;

      // Amount penalty (higher tickets harder to recover)
      logit -= Math.min(2.5, (amount / 10000) * 0.45);

      // Customer history impact
      logit += customerRecoveryRate * 1.8;
      logit += customerSuccessRate * 0.8;

      // Retries & Fatigue penalty
      logit -= previousRetryCount * 0.55;
      logit -= (fatigueScore / 100) * 1.2;
      logit -= (riskScore / 100) * 2.0;

      // Peak hour boost
      if (hour >= 10 && hour <= 20) logit += 0.35;

      // Latent true probability via sigmoid
      const trueProb = 1.0 / (1.0 + Math.exp(-logit));

      // Realistic stochastic outcome with noise
      const noise = (random() - 0.5) * 0.15;
      const effectiveProb = Math.max(0.01, Math.min(0.99, trueProb + noise));
      const targetRecovered = random() < effectiveProb ? 1 : 0;

      if (targetRecovered === 1) totalRecovered++;

      const winningChannel = targetRecovered === 1
        ? (paymentMethod === 'UPI' ? 'GATEWAY_RETRY' : (random() < 0.6 ? 'PAYMENT_LINK' : 'WHATSAPP'))
        : undefined;

      const targetTimeToRecover = targetRecovered === 1
        ? Number((avgRecoveryDelayMinutes * (0.6 + random() * 0.8)).toFixed(2))
        : undefined;

      const features: TransactionFeatureVector = {
        amount,
        payment_method: paymentMethod,
        failure_category: failureCategory,
        failure_code: failureCode,
        hour,
        day_of_week: dayOfWeek,
        time_since_last_payment_minutes: timeSinceLastPaymentMinutes,
        customer_transaction_count: customerTxnCount,
        customer_success_rate: customerSuccessRate,
        customer_recovery_rate: customerRecoveryRate,
        upi_success_rate: upiSuccessRate,
        card_success_rate: cardSuccessRate,
        avg_recovery_delay_minutes: avgRecoveryDelayMinutes,
        previous_retry_count: previousRetryCount,
        previous_recovery_count: previousRecoveryCount,
        fatigue_score: fatigueScore,
        risk_score: riskScore,
        merchant_recovery_rate: merchantRecoveryRate,
        target_recovered: targetRecovered,
        target_recovery_channel: winningChannel,
        target_time_to_recover_minutes: targetTimeToRecover,
      };

      records[i] = {
        metadata: {
          transactionId: `txn_syn_${String(i).padStart(6, '0')}`,
          customerId: `cust_syn_${String(i % 1500).padStart(4, '0')}`,
          merchantId: `mer_saasify_syn_${i % 5}`,
          extractedAt: createdDate.toISOString(),
          isFallback: false,
        },
        features,
      };
    }

    return {
      records,
      isSyntheticDevelopmentData: true,
      metadata: {
        generatedAt: new Date().toISOString(),
        sampleCount: N,
        recoveryRate: Number((totalRecovered / N).toFixed(4)),
      },
    };
  }
}

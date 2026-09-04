import { FeatureRecord, TransactionFeatureVector } from '../feature-types';
import { RecoveryStrategyClass } from '../models/model-types';
import { ALL_TIME_BUCKETS, TimeBucket } from './timing-types';

export interface TimingTrainingSample {
  record: FeatureRecord;
  recoveryProbability: number; // Phase 6.2 predicted recovery probability
  strategy: RecoveryStrategyClass; // Phase 6.3 predicted top strategy
  targetTimeBucket: TimeBucket;
  isSyntheticDevelopmentData: true;
}

export class TimingDatasetGenerator {
  /**
   * Generates >= 10,000 synthetic timing samples with realistic temporal correlations
   * and strict anti-leakage quarantine
   */
  static generate(options?: { sampleCount?: number; seed?: number }): {
    samples: TimingTrainingSample[];
    isSyntheticDevelopmentData: true;
    metadata: {
      sampleCount: number;
      bucketDistribution: Record<TimeBucket, number>;
      generatedAt: string;
    };
  } {
    const N = Math.max(10000, options?.sampleCount ?? 10000);
    const samples: TimingTrainingSample[] = new Array(N);

    let seed = options?.seed ?? 4242;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
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

    const methods = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
    const methodWeights = [0.65, 0.20, 0.10, 0.05];

    const categories = [
      'TECHNICAL',
      'INSUFFICIENT_FUNDS',
      'USER_AUTHENTICATION',
      'GATEWAY_DOWNTIME',
      'RISK_AND_FRAUD',
    ];
    const categoryWeights = [0.42, 0.30, 0.16, 0.08, 0.04];

    const failureCodes: Record<string, string[]> = {
      TECHNICAL: ['BAD_REQUEST_PAYMENT_TIMED_OUT', 'NPCI_SWITCH_UNAVAILABLE'],
      INSUFFICIENT_FUNDS: ['PAYMENT_FAILED_INSUFFICIENT_BALANCE', 'LIMIT_EXCEEDED'],
      USER_AUTHENTICATION: ['AUTH_FAILED_OTP_TIMEOUT', '3DS_VERIFICATION_FAILED'],
      GATEWAY_DOWNTIME: ['GATEWAY_DOWNTIME_503', 'BANK_CIRCUIT_BREAKER'],
      RISK_AND_FRAUD: ['FRAUD_SUSPECTED_VELOCITY_TRIGGER', 'BLACKLISTED_CARD'],
    };

    const bucketDistribution: Record<TimeBucket, number> = {
      IMMEDIATE: 0,
      VERY_SOON: 0,
      SHORT_DELAY: 0,
      MEDIUM_DELAY: 0,
      LONG_DELAY: 0,
      NEXT_DAY: 0,
      DO_NOT_CONTACT: 0,
    };

    const baseTimestamp = Date.now() - 30 * 24 * 3600 * 1000;

    for (let i = 0; i < N; i++) {
      const paymentMethod = chooseWeighted(methods, methodWeights);
      const failureCategory = chooseWeighted(categories, categoryWeights);
      const possibleCodes = failureCodes[failureCategory] || ['GENERIC_ERROR'];
      const failureCode = possibleCodes[Math.floor(random() * possibleCodes.length)]!;

      const isVipOrHighTicket = random() < 0.07;
      const amount = isVipOrHighTicket
        ? Math.round(25000 + random() * 65000)
        : Math.round(200 + Math.pow(random(), 1.5) * 8000);

      const createdAtMs = baseTimestamp + (i / N) * (30 * 24 * 3600 * 1000);
      const createdDate = new Date(createdAtMs);
      const hour = createdDate.getHours();
      const dayOfWeek = createdDate.getDay();
      const timeSinceLastPaymentMinutes = random() < 0.12 ? -1 : Math.round(30 + random() * 40000);

      const customerTxnCount = Math.max(1, Math.round(1 + random() * 20));
      const customerSuccessRate = Number((0.45 + random() * 0.52).toFixed(4));
      const customerRecoveryRate = Number((0.30 + random() * 0.65).toFixed(4));
      const upiSuccessRate = Number((0.55 + random() * 0.43).toFixed(4));
      const cardSuccessRate = Number((0.50 + random() * 0.45).toFixed(4));
      const avgRecoveryDelayMinutes = Number((5 + random() * 40).toFixed(2));
      const previousRetryCount = Math.floor(random() * 4);
      const previousRecoveryCount = Math.floor(customerTxnCount * customerRecoveryRate * 0.4);

      const fatigueScore = Math.min(100, Math.round(previousRetryCount * 22 + random() * 22));
      const isFraudCat = failureCategory === 'RISK_AND_FRAUD';
      const riskScore = isFraudCat ? Math.round(75 + random() * 25) : Math.round(random() * 32);
      const merchantRecoveryRate = Number((0.68 + (random() - 0.5) * 0.10).toFixed(4));

      // Phase 6.2 baseline recovery probability estimate
      let logit = 0.4;
      if (failureCategory === 'TECHNICAL') logit += 1.3;
      else if (failureCategory === 'GATEWAY_DOWNTIME') logit += 1.0;
      else if (failureCategory === 'USER_AUTHENTICATION') logit += 0.4;
      else if (failureCategory === 'RISK_AND_FRAUD') logit -= 4.0;
      if (paymentMethod === 'UPI') logit += 0.5;
      logit -= Math.min(2.0, (amount / 10000) * 0.4);
      logit -= (fatigueScore / 100) * 1.5;
      const recoveryProbability = Number((1.0 / (1.0 + Math.exp(-logit))).toFixed(4));

      // Phase 6.3 top strategy determination (decision time)
      let strategy: RecoveryStrategyClass;
      if (isFraudCat || riskScore >= 75 || fatigueScore >= 70) {
        strategy = 'DO_NOT_RECOVER';
      } else if (isVipOrHighTicket || amount >= 30000) {
        strategy = 'HUMAN_ESCALATION';
      } else if (failureCategory === 'TECHNICAL' && previousRetryCount === 0 && paymentMethod === 'UPI') {
        strategy = 'IMMEDIATE_RETRY';
      } else if (failureCategory === 'INSUFFICIENT_FUNDS') {
        strategy = 'OPTIMAL_DELAYED_RETRY';
      } else if (failureCategory === 'USER_AUTHENTICATION') {
        strategy = 'WHATSAPP_NUDGE';
      } else {
        strategy = 'PAYMENT_LINK';
      }

      // -----------------------------------------------------------------------
      // Temporal Ground-Truth Assignment (Optimal Intervention Window)
      // -----------------------------------------------------------------------
      let targetTimeBucket: TimeBucket;

      const isNightTime = hour >= 22 || hour < 7;

      if (strategy === 'DO_NOT_RECOVER' || riskScore >= 75 || fatigueScore >= 75) {
        targetTimeBucket = 'DO_NOT_CONTACT';
      } else if (isNightTime && strategy !== 'IMMEDIATE_RETRY') {
        // Respect customer sleep window -> reschedule for next morning
        targetTimeBucket = 'NEXT_DAY';
      } else if (strategy === 'IMMEDIATE_RETRY') {
        targetTimeBucket = 'IMMEDIATE';
      } else if (isVipOrHighTicket || strategy === 'HUMAN_ESCALATION') {
        targetTimeBucket = 'VERY_SOON';
      } else if (strategy === 'WHATSAPP_NUDGE' || failureCategory === 'USER_AUTHENTICATION') {
        targetTimeBucket = 'SHORT_DELAY';
      } else if (failureCategory === 'INSUFFICIENT_FUNDS') {
        targetTimeBucket = hour < 14 ? 'MEDIUM_DELAY' : 'LONG_DELAY';
      } else if (failureCategory === 'GATEWAY_DOWNTIME') {
        targetTimeBucket = 'MEDIUM_DELAY';
      } else {
        targetTimeBucket = 'SHORT_DELAY';
      }

      bucketDistribution[targetTimeBucket]++;

      // -----------------------------------------------------------------------
      // Anti-Leakage Feature Vector (Strictly Decision-Time)
      // -----------------------------------------------------------------------
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
        // Post-decision variables explicitly excluded:
        target_recovered: undefined,
        target_recovery_channel: undefined,
        target_time_to_recover_minutes: undefined,
      };

      const record: FeatureRecord = {
        metadata: {
          transactionId: `txn_time_${String(i).padStart(6, '0')}`,
          customerId: `cust_time_${String(i % 1200).padStart(4, '0')}`,
          merchantId: `mer_saasify_blr`,
          extractedAt: createdDate.toISOString(),
          isFallback: false,
        },
        features,
      };

      samples[i] = {
        record,
        recoveryProbability,
        strategy,
        targetTimeBucket,
        isSyntheticDevelopmentData: true,
      };
    }

    return {
      samples,
      isSyntheticDevelopmentData: true,
      metadata: {
        sampleCount: N,
        bucketDistribution,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

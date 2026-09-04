import { FeatureRecord, TransactionFeatureVector } from '../feature-types';
import { ALL_STRATEGY_CLASSES, RecoveryStrategyClass } from '../models/model-types';

export interface StrategyTrainingSample {
  record: FeatureRecord;
  recoveryProbability: number; // Phase 6.2 predicted recovery probability
  targetStrategy: RecoveryStrategyClass;
  isSyntheticDevelopmentData: true;
}

export class StrategyDatasetGenerator {
  /**
   * Generates >= 10,000 synthetic strategy samples with realistic domain relationships
   * and strict anti-leakage quarantine (no post-decision outcomes)
   */
  static generate(options?: { sampleCount?: number; seed?: number }): {
    samples: StrategyTrainingSample[];
    isSyntheticDevelopmentData: true;
    metadata: {
      sampleCount: number;
      classDistribution: Record<RecoveryStrategyClass, number>;
      generatedAt: string;
    };
  } {
    const N = Math.max(10000, options?.sampleCount ?? 10000);
    const samples: StrategyTrainingSample[] = new Array(N);

    let seed = options?.seed ?? 1337;
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

    const classDistribution: Record<RecoveryStrategyClass, number> = {
      IMMEDIATE_RETRY: 0,
      OPTIMAL_DELAYED_RETRY: 0,
      PAYMENT_LINK: 0,
      WHATSAPP_NUDGE: 0,
      MANDATE_UPDATE: 0,
      HUMAN_ESCALATION: 0,
      DO_NOT_RECOVER: 0,
    };

    const baseTimestamp = Date.now() - 30 * 24 * 3600 * 1000;

    for (let i = 0; i < N; i++) {
      const paymentMethod = chooseWeighted(methods, methodWeights);
      const failureCategory = chooseWeighted(categories, categoryWeights);
      const possibleCodes = failureCodes[failureCategory] || ['GENERIC_ERROR'];
      const failureCode = possibleCodes[Math.floor(random() * possibleCodes.length)]!;

      const isVipOrHighTicket = random() < 0.08;
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

      // Phase 6.2 baseline recovery probability estimate (pre-decision feature)
      let logit = 0.4;
      if (failureCategory === 'TECHNICAL') logit += 1.3;
      else if (failureCategory === 'GATEWAY_DOWNTIME') logit += 1.0;
      else if (failureCategory === 'USER_AUTHENTICATION') logit += 0.4;
      else if (failureCategory === 'RISK_AND_FRAUD') logit -= 4.0;
      if (paymentMethod === 'UPI') logit += 0.5;
      logit -= Math.min(2.0, (amount / 10000) * 0.4);
      logit -= (fatigueScore / 100) * 1.5;
      const recoveryProbability = Number((1.0 / (1.0 + Math.exp(-logit))).toFixed(4));

      // -----------------------------------------------------------------------
      // Ground-Truth Strategy Label Assignment (Decision-Time Logic)
      // -----------------------------------------------------------------------
      let targetStrategy: RecoveryStrategyClass;

      if (isFraudCat || riskScore >= 75 || fatigueScore >= 70) {
        targetStrategy = 'DO_NOT_RECOVER';
      } else if (isVipOrHighTicket || amount >= 30000) {
        targetStrategy = 'HUMAN_ESCALATION';
      } else if (failureCategory === 'TECHNICAL' && previousRetryCount === 0 && paymentMethod === 'UPI') {
        targetStrategy = 'IMMEDIATE_RETRY';
      } else if (failureCategory === 'INSUFFICIENT_FUNDS' || (failureCategory === 'TECHNICAL' && previousRetryCount > 0)) {
        targetStrategy = 'OPTIMAL_DELAYED_RETRY';
      } else if (failureCategory === 'USER_AUTHENTICATION' && (paymentMethod === 'UPI' || random() < 0.45)) {
        targetStrategy = 'WHATSAPP_NUDGE';
      } else if (failureCode.includes('MANDATE') || (random() < 0.05 && paymentMethod === 'CARD')) {
        targetStrategy = 'MANDATE_UPDATE';
      } else {
        targetStrategy = 'PAYMENT_LINK';
      }

      classDistribution[targetStrategy]++;

      // -----------------------------------------------------------------------
      // Strict Anti-Leakage Feature Vector
      // NOTE: target_recovered and target_time_to_recover_minutes are strictly
      // excluded from input features to prevent future-outcome leakage!
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
        // Post-decision labels strictly undefined to prevent leakage:
        target_recovered: undefined,
        target_recovery_channel: undefined,
        target_time_to_recover_minutes: undefined,
      };

      const record: FeatureRecord = {
        metadata: {
          transactionId: `txn_strat_${String(i).padStart(6, '0')}`,
          customerId: `cust_strat_${String(i % 1200).padStart(4, '0')}`,
          merchantId: `mer_saasify_blr`,
          extractedAt: createdDate.toISOString(),
          isFallback: false,
        },
        features,
      };

      samples[i] = {
        record,
        recoveryProbability,
        targetStrategy,
        isSyntheticDevelopmentData: true,
      };
    }

    return {
      samples,
      isSyntheticDevelopmentData: true,
      metadata: {
        sampleCount: N,
        classDistribution,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

import { FailureCategory, PaymentMethod, RecoveryActionType } from './types';
import { FailureSeverity, RecoverabilityLevel } from './classifier';

export interface RecoveryPredictionFeatures {
  amount: number;
  paymentMethod: PaymentMethod;
  failureCategory: FailureCategory;
  failureCode: string;
  severity: FailureSeverity;
  recoverability: RecoverabilityLevel;
  actionType: RecoveryActionType;
  attemptNumber: number;
  hourOfDay: number; // 0 - 23
  customerSegment: 'VIP' | 'ENTERPRISE' | 'SMB' | 'CONSUMER';
  customerRecoveryRate: number; // 0 - 100
  customerFatigueScore: number; // 0 - 100
  customerRiskScore: number; // 0 - 100
}

export interface RecoveryPredictionResult {
  probability: number; // 0.00 - 1.00
  confidenceScore: number; // 0 - 100
  modelSource: string;
  featureImportance: Record<string, number>;
}

export class RecoveryProbabilityService {
  private static MODEL_VERSION = 'RecoverIQ-ProbabilityEngine-v3.1-HeuristicBandit';

  /**
   * Predicts recovery probability for a given strategy and feature set.
   * Built as an isolated interface ready for Phase 6 Machine Learning drop-in.
   */
  static predict(features: RecoveryPredictionFeatures): RecoveryPredictionResult {
    const {
      amount,
      paymentMethod,
      failureCategory,
      recoverability,
      actionType,
      attemptNumber,
      hourOfDay,
      customerSegment,
      customerRecoveryRate,
      customerFatigueScore,
      customerRiskScore,
    } = features;

    // Hard block for suppressions, extreme fraud, or zero recoverability
    if (actionType === 'DO_NOT_RECOVER' || recoverability === 'ZERO' || customerRiskScore >= 80) {
      return {
        probability: 0.0,
        confidenceScore: 99,
        modelSource: this.MODEL_VERSION,
        featureImportance: { fraud_or_suppression_flag: 1.0 },
      };
    }

    // 1. Base Prior Probability from Recoverability Rating (narrowed to HIGH | MEDIUM | LOW)
    let basePrior = 0.50;
    switch (recoverability) {
      case 'HIGH':
        basePrior = 0.78;
        break;
      case 'MEDIUM':
        basePrior = 0.60;
        break;
      case 'LOW':
        basePrior = 0.35;
        break;
      default:
        basePrior = 0.50;
    }

    // 2. Channel & Action Affinity
    let actionAffinity = 0.0;
    if (failureCategory === 'TECHNICAL') {
      if (actionType === 'IMMEDIATE_RETRY') actionAffinity = 0.08;
      else if (actionType === 'OPTIMAL_DELAYED_RETRY') actionAffinity = 0.06;
      else if (actionType === 'WHATSAPP_NUDGE') actionAffinity = -0.15; // Unnecessary customer interruption
    } else if (failureCategory === 'INSUFFICIENT_FUNDS') {
      if (actionType === 'OPTIMAL_DELAYED_RETRY') actionAffinity = 0.12;
      else if (actionType === 'WHATSAPP_NUDGE' || actionType === 'PAYMENT_LINK') actionAffinity = 0.08;
      else if (actionType === 'IMMEDIATE_RETRY') actionAffinity = -0.40; // Immediate retrying dry account is ineffective
    } else if (failureCategory === 'AUTHENTICATION' || failureCategory === 'CUSTOMER_DROPOUT') {
      if (actionType === 'WHATSAPP_NUDGE') actionAffinity = 0.16;
      else if (actionType === 'PAYMENT_LINK') actionAffinity = 0.12;
      else if (actionType === 'IMMEDIATE_RETRY') actionAffinity = -0.55; // Cannot silently retry without 3DS OTP
    } else if (failureCategory === 'MANDATE_ISSUE') {
      if (actionType === 'MANDATE_UPDATE') actionAffinity = 0.18;
      else if (actionType === 'PAYMENT_LINK') actionAffinity = 0.10;
      else if (actionType === 'IMMEDIATE_RETRY') actionAffinity = -0.60;
    }

    // 3. Customer Loyalty & Segment Affinity
    let customerWeight = 0.0;
    if (customerSegment === 'VIP' || customerSegment === 'ENTERPRISE') {
      customerWeight += 0.06;
    }
    if (customerRecoveryRate >= 75) {
      customerWeight += 0.07;
    } else if (customerRecoveryRate < 40) {
      customerWeight -= 0.10;
    }

    // 4. Diurnal Hour Impact (Active hours 09:00 - 21:00 yield higher engagement)
    let timingMultiplier = 1.0;
    if (hourOfDay >= 10 && hourOfDay <= 20) {
      timingMultiplier = 1.05; // Peak engagement window
    } else if (hourOfDay >= 22 || hourOfDay <= 6) {
      timingMultiplier = actionType === 'IMMEDIATE_RETRY' ? 0.95 : 0.60; // Quiet night hours penalty for customer messages
    }

    // 5. Attempt Number Attenuation (Diminishing returns)
    let attemptDecay = 1.0;
    if (attemptNumber === 2) attemptDecay = 0.82;
    else if (attemptNumber === 3) attemptDecay = 0.55;
    else if (attemptNumber >= 4) attemptDecay = 0.28;

    // 6. Fatigue Penalty Discount
    const fatigueDiscount = (customerFatigueScore / 100) * 0.20;

    // 7. Calculate Final Probability
    const rawProbability = (basePrior + actionAffinity + customerWeight - fatigueDiscount) * timingMultiplier * attemptDecay;
    const finalProbability = Math.min(0.96, Math.max(0.02, Math.round(rawProbability * 100) / 100));

    // 8. Confidence Score (0 - 100)
    let confidence = 85;
    if (customerSegment === 'VIP') confidence += 5;
    if (attemptNumber > 2) confidence -= 10;
    if (customerRiskScore > 40) confidence -= 12;
    confidence = Math.min(99, Math.max(45, confidence));

    return {
      probability: finalProbability,
      confidenceScore: confidence,
      modelSource: this.MODEL_VERSION,
      featureImportance: {
        base_prior: Math.round(basePrior * 100) / 100,
        action_affinity: Math.round(actionAffinity * 100) / 100,
        customer_history_weight: Math.round(customerWeight * 100) / 100,
        attempt_decay_multiplier: Math.round(attemptDecay * 100) / 100,
        fatigue_discount: Math.round(fatigueDiscount * 100) / 100,
      },
    };
  }
}

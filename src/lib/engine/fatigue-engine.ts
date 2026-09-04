import { RecoveryActionType } from './types';

export interface FatigueEvaluationResult {
  previousFatigueScore: number;
  newFatigueScore: number;
  fatiguePenaltyINR: number;
  isFatigueThresholdExceeded: boolean;
  shouldStopRecovery: boolean;
  channelIntrusionWeight: number;
  exhaustionReason?: string;
}

// Channel intrusion weights (0 - 50)
export const CHANNEL_INTRUSION_LEVELS: Record<RecoveryActionType, number> = {
  IMMEDIATE_RETRY: 0, // Silent backend retry
  OPTIMAL_DELAYED_RETRY: 0, // Silent backend retry
  PAYMENT_LINK: 12, // SMS / Email notification
  WHATSAPP_NUDGE: 22, // Direct WhatsApp message notification
  MANDATE_UPDATE: 15, // Mandate re-auth prompt
  HUMAN_ESCALATION: 35, // High-touch phone outreach
  DO_NOT_RECOVER: 0,
};

export class FatigueEngine {
  /**
   * Evaluates the fatigue impact and monetary churn penalty of a proposed recovery attempt
   */
  static evaluate(params: {
    currentFatigueScore: number; // 0 - 100
    actionType: RecoveryActionType;
    attemptNumber: number;
    customerLTV: number;
    maxFatigueThreshold?: number; // e.g. 70
  }): FatigueEvaluationResult {
    const {
      currentFatigueScore,
      actionType,
      attemptNumber,
      customerLTV,
      maxFatigueThreshold = 70,
    } = params;

    const intrusion = CHANNEL_INTRUSION_LEVELS[actionType] || 0;

    // 1. Exponential Attempt Escalation Multiplier
    let attemptMultiplier = 1.0;
    if (attemptNumber === 2) attemptMultiplier = 1.6;
    else if (attemptNumber === 3) attemptMultiplier = 2.8;
    else if (attemptNumber >= 4) attemptMultiplier = 4.5;

    // 2. Incremental Fatigue
    const fatigueDelta = Math.round(intrusion * attemptMultiplier * 0.4);
    const newFatigueScore = Math.min(100, currentFatigueScore + fatigueDelta);

    // 3. Monetary Fatigue Penalty (Estimates customer churn risk against LTV)
    // Higher LTV customers incur higher churn penalty when annoyed
    const ltvWeight = Math.max(50, Math.min(1000, customerLTV * 0.003));
    const fatiguePenaltyINR = Math.round(
      (newFatigueScore / 100) * ltvWeight * (intrusion > 0 ? 1.5 : 0.2)
    );

    // 4. "More attempts ≠ more revenue" rules:
    // Attempt 4+ on customer-facing channels warrants immediate termination
    const isExceeded = newFatigueScore >= maxFatigueThreshold;
    let shouldStopRecovery = false;
    let exhaustionReason: string | undefined;

    if (attemptNumber >= 4) {
      shouldStopRecovery = true;
      exhaustionReason = `Max attempt limit reached (Attempt #${attemptNumber}). Terminating interventions to protect customer lifetime value.`;
    } else if (isExceeded && intrusion > 0) {
      shouldStopRecovery = true;
      exhaustionReason = `Customer fatigue score (${newFatigueScore}/100) exceeds tolerance threshold (${maxFatigueThreshold}). Suppressing further interactive nudges.`;
    }

    return {
      previousFatigueScore: currentFatigueScore,
      newFatigueScore,
      fatiguePenaltyINR,
      isFatigueThresholdExceeded: isExceeded,
      shouldStopRecovery,
      channelIntrusionWeight: intrusion,
      exhaustionReason,
    };
  }
}

import { CustomerProfile, EVBreakdown, FailureCategory, PaymentMethod, RecoveryActionType } from './types';

export const INTERVENTION_COSTS: Record<RecoveryActionType, number> = {
  IMMEDIATE_RETRY: 0.10, // gateway network retry ping
  OPTIMAL_DELAYED_RETRY: 0.25, // queueing & scheduler
  WHATSAPP_NUDGE: 1.50, // WhatsApp Business API conversation cost
  PAYMENT_LINK: 3.20, // SMS + Web Link checkout session
  MANDATE_UPDATE: 2.00, // Mandate re-auth routing
  HUMAN_ESCALATION: 30.00, // Support desk triage cost
  DO_NOT_RECOVER: 0.00,
};

export interface ExpectedNetRecoveryParams {
  amount: number;
  probability: number;
  actionType: RecoveryActionType;
  interventionCost?: number;
  fatiguePenaltyINR?: number;
  riskPenaltyINR?: number;
  confidenceScore?: number;
}

/**
 * Calculates Expected Net Recovery using the formal formula:
 * Expected Net Recovery = (Probability of Recovery * Recoverable Amount)
 *                         - Recovery Cost
 *                         - Fatigue Penalty
 *                         - Risk Penalty
 */
export function calculateExpectedNetRecovery(params: ExpectedNetRecoveryParams): EVBreakdown {
  const {
    amount,
    probability,
    actionType,
    interventionCost = INTERVENTION_COSTS[actionType] ?? 0.50,
    fatiguePenaltyINR = 0,
    riskPenaltyINR = 0,
    confidenceScore = 85,
  } = params;

  if (actionType === 'DO_NOT_RECOVER' || probability <= 0) {
    return {
      expectedValue: 0,
      successProbability: 0,
      grossPotential: 0,
      interventionCost: 0,
      fatiguePenaltyCost: 0,
      netEV: 0,
      confidenceScore: 99,
    };
  }

  // 1. Gross Potential
  const grossPotential = Math.round(amount * probability);

  // 2. Total Deductions
  const totalDeductions = interventionCost + fatiguePenaltyINR + riskPenaltyINR;

  // 3. Expected Net Recovery (Cannot be negative)
  const netRecovery = Math.max(0, Math.round((grossPotential - totalDeductions) * 100) / 100);

  return {
    expectedValue: netRecovery,
    successProbability: probability,
    grossPotential,
    interventionCost,
    fatiguePenaltyCost: fatiguePenaltyINR,
    netEV: netRecovery,
    confidenceScore,
  };
}

// Backwards-compatible calculation function
export function calculateExpectedRecoveryValue(
  amount: number,
  action?: RecoveryActionType,
  failureCategory?: FailureCategory,
  paymentMethod?: PaymentMethod,
  customer?: CustomerProfile,
  hourOfDay?: number
): EVBreakdown {
  const actionToUse = action || 'OPTIMAL_DELAYED_RETRY';
  const prob = actionToUse === 'DO_NOT_RECOVER' ? 0 : 0.76;

  return calculateExpectedNetRecovery({
    amount,
    probability: prob,
    actionType: actionToUse,
    interventionCost: INTERVENTION_COSTS[actionToUse] || 1.0,
    fatiguePenaltyINR: customer ? Math.round(customer.fatigueScore * 0.4) : 10,
    riskPenaltyINR: customer && customer.riskScore > 50 ? 50 : 0,
    confidenceScore: 82,
  });
}

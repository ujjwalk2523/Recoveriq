import { CustomerProfile, EVBreakdown, FailureCategory, PaymentMethod, RecoveryActionType } from './types';

export interface ChannelCostMap {
  [key: string]: number;
}

export const INTERVENTION_COSTS: Record<RecoveryActionType, number> = {
  IMMEDIATE_RETRY: 0.10, // gateway network retry ping
  OPTIMAL_DELAYED_RETRY: 0.25, // queueing & scheduler
  WHATSAPP_NUDGE: 1.50, // WhatsApp Business API conversation cost
  PAYMENT_LINK: 3.20, // SMS + Web Link checkout session
  MANDATE_UPDATE: 2.00, // Mandate re-auth routing
  HUMAN_ESCALATION: 30.00, // Support desk triage cost
  DO_NOT_RECOVER: 0.00,
};

export function calculateExpectedRecoveryValue(
  amount: number,
  action: RecoveryActionType,
  failureCategory: FailureCategory,
  paymentMethod: PaymentMethod,
  customer: CustomerProfile,
  hourOfDay: number = new Date().getHours()
): EVBreakdown {
  // 1. Base probability from failure category
  let probability = 0.50;

  switch (failureCategory) {
    case 'TECHNICAL':
      probability = action === 'IMMEDIATE_RETRY' ? 0.84 : 0.72;
      break;
    case 'INSUFFICIENT_FUNDS':
      // Delayed retry or morning window yields higher recovery
      if (action === 'OPTIMAL_DELAYED_RETRY') {
        probability = 0.74;
      } else if (action === 'WHATSAPP_NUDGE') {
        probability = 0.68;
      } else if (action === 'IMMEDIATE_RETRY') {
        probability = 0.22; // Immediate retry on low balance usually fails again!
      } else {
        probability = 0.50;
      }
      break;
    case 'AUTHENTICATION':
      if (action === 'WHATSAPP_NUDGE') {
        probability = 0.86;
      } else if (action === 'PAYMENT_LINK') {
        probability = 0.78;
      } else if (action === 'IMMEDIATE_RETRY') {
        probability = 0.05; // Can't retry 3DS without customer OTP!
      } else {
        probability = 0.40;
      }
      break;
    case 'CUSTOMER_DROPOUT':
      if (action === 'WHATSAPP_NUDGE') {
        probability = 0.82;
      } else if (action === 'PAYMENT_LINK') {
        probability = 0.75;
      } else {
        probability = 0.15;
      }
      break;
    case 'MANDATE_ISSUE':
      if (action === 'MANDATE_UPDATE') {
        probability = 0.79;
      } else if (action === 'PAYMENT_LINK') {
        probability = 0.71;
      } else if (action === 'IMMEDIATE_RETRY') {
        probability = 0.02; // Inactive mandate will always fail
      } else {
        probability = 0.30;
      }
      break;
    case 'EXPIRED_OR_INVALID':
      if (action === 'PAYMENT_LINK' || action === 'WHATSAPP_NUDGE') {
        probability = 0.65;
      } else {
        probability = 0.02;
      }
      break;
    case 'RISK_AND_FRAUD':
      // Should never recover fraud
      probability = 0.01;
      break;
    default:
      probability = 0.50;
  }

  // 2. Adjust for Customer Segment & Loyalty History
  if (customer.segment === 'VIP' || customer.segment === 'ENTERPRISE') {
    probability += 0.08;
  }
  if (customer.pastRecoveries > 2) {
    probability += 0.05;
  }
  if (customer.riskScore > 60) {
    probability -= 0.25;
  }

  // 3. Adjust for Payment Method nuances in India
  if (paymentMethod === 'UPI' && (action === 'WHATSAPP_NUDGE' || action === 'PAYMENT_LINK')) {
    probability += 0.06; // High 1-tap intent in India
  }

  // 4. Bound probability [0.01, 0.98]
  if (action === 'DO_NOT_RECOVER') {
    probability = 0.00;
  } else {
    probability = Math.min(0.98, Math.max(0.01, probability));
  }

  // 5. Intervention Cost
  const interventionCost = INTERVENTION_COSTS[action] || 0.0;

  // 6. Fatigue Penalty Calculation
  // If customer is already fatigued, retrying aggressively risks churn
  let fatigueSensitivity = 0.03;
  if (customer.segment === 'VIP') fatigueSensitivity = 0.08;
  if (customer.segment === 'ENTERPRISE') fatigueSensitivity = 0.06;
  
  // Exponential fatigue penalty if score > 50
  const fatigueRatio = customer.fatigueScore / 100;
  const fatiguePenaltyCost = action === 'DO_NOT_RECOVER' 
    ? 0 
    : Math.round(amount * (fatigueRatio ** 1.5) * fatigueSensitivity * 100) / 100;

  // 7. Gross Potential & Net Expected Recovery Value
  const grossPotential = Math.round(amount * probability * 100) / 100;
  const netEV = action === 'DO_NOT_RECOVER' 
    ? 0 
    : Math.round((grossPotential - interventionCost - fatiguePenaltyCost) * 100) / 100;

  // 8. Confidence Score (0-100)
  let confidenceScore = 85;
  if (failureCategory === 'RISK_AND_FRAUD') confidenceScore = 98;
  if (customer.totalTransactions > 5) confidenceScore += 8;
  if (customer.fatigueScore > 75) confidenceScore += 5;
  confidenceScore = Math.min(99, Math.max(55, confidenceScore));

  return {
    expectedValue: netEV,
    successProbability: Math.round(probability * 100) / 100,
    grossPotential,
    interventionCost,
    fatiguePenaltyCost,
    netEV,
    confidenceScore,
  };
}

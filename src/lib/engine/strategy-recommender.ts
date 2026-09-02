import { CustomerProfile, FailureCategory, PaymentMethod, RecoveryActionType, StrategyYield, Transaction } from './types';
import { calculateExpectedRecoveryValue } from './ev-calculator';

export interface StrategyRecommendationResult {
  recommendedAction: RecoveryActionType;
  actionConfidence: number;
  expectedRecoveryValue: number;
  recoveryProbability: number;
  aiRationale: string;
  whyNotRationale?: string;
  strategyYields: StrategyYield[];
  isSuppressionRecommended: boolean;
}

const STRATEGY_DEFINITIONS: {
  type: RecoveryActionType;
  title: string;
  timeHours: number;
  baseRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}[] = [
  { type: 'IMMEDIATE_RETRY', title: 'Zero-Delay Gateway Retry', timeHours: 0.1, baseRisk: 'LOW' },
  { type: 'OPTIMAL_DELAYED_RETRY', title: 'Optimal Window Delayed Retry (4-8h)', timeHours: 6.0, baseRisk: 'LOW' },
  { type: 'WHATSAPP_NUDGE', title: 'Interactive WhatsApp 1-Tap Link', timeHours: 1.5, baseRisk: 'LOW' },
  { type: 'PAYMENT_LINK', title: 'Multi-Rail SMS / Email Payment Link', timeHours: 3.0, baseRisk: 'MEDIUM' },
  { type: 'MANDATE_UPDATE', title: 'Automated Mandate Update Routing', timeHours: 12.0, baseRisk: 'LOW' },
  { type: 'HUMAN_ESCALATION', title: 'VIP Account Manager High-Touch Outreach', timeHours: 24.0, baseRisk: 'HIGH' },
  { type: 'DO_NOT_RECOVER', title: 'Intelligent Suppression (Do Not Recover)', timeHours: 0.0, baseRisk: 'LOW' },
];

export function evaluateRecoveryStrategies(
  amount: number,
  failureCategory: FailureCategory,
  failureCode: string,
  paymentMethod: PaymentMethod,
  customer: CustomerProfile
): StrategyRecommendationResult {
  // 1. Check for HARD SUPPRESSION ("Why NOT Recover?")
  // Cases: Fraud, Card Stolen, Customer Max Fatigue, Churn Risk
  if (failureCategory === 'RISK_AND_FRAUD' || failureCode === 'HIGH_RISK_SUSPECTED' || failureCode === 'CARD_REPORTED_LOST_STOLEN') {
    const yields: StrategyYield[] = STRATEGY_DEFINITIONS.map(def => ({
      actionType: def.type,
      actionTitle: def.title,
      successProbability: def.type === 'DO_NOT_RECOVER' ? 1.0 : 0.01,
      expectedValue: 0,
      interventionCost: 0,
      timeToRecoverHours: def.timeHours,
      riskLevel: def.type === 'DO_NOT_RECOVER' ? 'LOW' : 'HIGH',
      isRecommended: def.type === 'DO_NOT_RECOVER',
      whyNotReason: def.type === 'DO_NOT_RECOVER' ? undefined : 'High risk of dispute/chargeback and issuer penalty.',
    }));

    return {
      recommendedAction: 'DO_NOT_RECOVER',
      actionConfidence: 99,
      expectedRecoveryValue: 0,
      recoveryProbability: 0.0,
      aiRationale: 'Transaction was flagged by issuer security switch as potential card theft or dispute risk. Recovering this payment exposes the merchant to a ₹1,500 dispute penalty and gateway reputation degradation.',
      whyNotRationale: 'Immediate suppression triggered. Card flagged for high fraud probability. Interventions would result in negative expected value due to 100% dispute probability.',
      strategyYields: yields,
      isSuppressionRecommended: true,
    };
  }

  if (customer.fatigueScore >= 85) {
    const yields: StrategyYield[] = STRATEGY_DEFINITIONS.map(def => ({
      actionType: def.type,
      actionTitle: def.title,
      successProbability: def.type === 'DO_NOT_RECOVER' ? 1.0 : 0.08,
      expectedValue: 0,
      interventionCost: 0,
      timeToRecoverHours: def.timeHours,
      riskLevel: 'HIGH',
      isRecommended: def.type === 'DO_NOT_RECOVER',
      whyNotReason: def.type === 'DO_NOT_RECOVER' ? undefined : 'Customer fatigue threshold (85+) reached. Additional nudges will trigger unsubscribes.',
    }));

    return {
      recommendedAction: 'DO_NOT_RECOVER',
      actionConfidence: 94,
      expectedRecoveryValue: 0,
      recoveryProbability: 0.0,
      aiRationale: `Customer ${customer.name} has experienced 4+ failed interactions this week (Fatigue Score: ${customer.fatigueScore}/100). Sending another automated nudge is projected to increase lifetime churn probability by 42%.`,
      whyNotRationale: 'Customer relationship protection rule activated. Fatigue score exceeds safety threshold. Suppressing communication to preserve customer lifetime value (₹' + (customer.lifetimeValue || 15000).toLocaleString('en-IN') + ').',
      strategyYields: yields,
      isSuppressionRecommended: true,
    };
  }

  // 2. Compute EV across all actionable strategies
  const yields: StrategyYield[] = STRATEGY_DEFINITIONS.filter(d => d.type !== 'DO_NOT_RECOVER').map(def => {
    const ev = calculateExpectedRecoveryValue(amount, def.type, failureCategory, paymentMethod, customer);
    
    // Generate explanation for why or why not
    let whyNot: string | undefined = undefined;
    if (def.type === 'IMMEDIATE_RETRY' && (failureCategory === 'INSUFFICIENT_FUNDS' || failureCategory === 'AUTHENTICATION')) {
      whyNot = 'Immediate retry has only 12% success on low funds/auth errors and exhausts retry quotas.';
    } else if (def.type === 'HUMAN_ESCALATION' && amount < 15000) {
      whyNot = `High intervention cost (₹30) exceeds reasonable unit economics for ticket size of ₹${amount.toLocaleString('en-IN')}.`;
    } else if (def.type === 'MANDATE_UPDATE' && paymentMethod !== 'MANDATE') {
      whyNot = 'Not applicable for non-mandate payment rails.';
    }

    return {
      actionType: def.type,
      actionTitle: def.title,
      successProbability: ev.successProbability,
      expectedValue: ev.expectedValue,
      interventionCost: ev.interventionCost,
      timeToRecoverHours: def.timeHours,
      riskLevel: def.baseRisk,
      isRecommended: false,
      whyNotReason: whyNot,
    };
  });

  // 3. Select strategy with HIGHEST Positive Expected Value
  let bestYield = yields[0];
  for (const y of yields) {
    if (y.expectedValue > bestYield.expectedValue) {
      bestYield = y;
    }
  }

  // If even the best yield is negative or zero, fallback to DO_NOT_RECOVER
  if (bestYield.expectedValue <= 0) {
    return {
      recommendedAction: 'DO_NOT_RECOVER',
      actionConfidence: 88,
      expectedRecoveryValue: 0,
      recoveryProbability: 0.0,
      aiRationale: 'All intervention channels yield negative Expected Recovery Value after factoring channel costs and customer friction.',
      whyNotRationale: 'Intervention costs exceed gross recovery potential.',
      strategyYields: yields,
      isSuppressionRecommended: true,
    };
  }

  bestYield.isRecommended = true;

  // 4. Generate contextual AI rationale
  let rationale = '';
  if (bestYield.actionType === 'WHATSAPP_NUDGE') {
    rationale = `Detected ${failureCategory.replace(/_/g, ' ')} on ${paymentMethod}. WhatsApp 1-tap payment link yields highest recovery probability (${Math.round(bestYield.successProbability * 100)}%) with ₹${bestYield.expectedValue.toLocaleString('en-IN')} Expected Value at minimal friction.`;
  } else if (bestYield.actionType === 'OPTIMAL_DELAYED_RETRY') {
    rationale = `Failure caused by transient balance/network conditions. Scheduling delayed retry in optimal 4-6h window yields ${Math.round(bestYield.successProbability * 100)}% recovery without disturbing the customer.`;
  } else if (bestYield.actionType === 'IMMEDIATE_RETRY') {
    rationale = `Transient banking switch timeout confirmed. Zero-delay retry has ${Math.round(bestYield.successProbability * 100)}% success rate with zero customer friction and negligible cost (₹${bestYield.interventionCost}).`;
  } else if (bestYield.actionType === 'PAYMENT_LINK') {
    rationale = `Instrument invalid or expired. Generating multi-rail dynamic payment link enables customer to complete checkout using alternate UPI or Credit Card.`;
  } else if (bestYield.actionType === 'MANDATE_UPDATE') {
    rationale = `Auto-debit recurring mandate revoked. Initiating streamlined mandate re-registration flow preserves ongoing recurring billing cycle.`;
  } else if (bestYield.actionType === 'HUMAN_ESCALATION') {
    rationale = `High-ticket VIP transaction (₹${amount.toLocaleString('en-IN')}). Dedicated account manager escalation recommended for white-glove recovery.`;
  }

  return {
    recommendedAction: bestYield.actionType,
    actionConfidence: Math.min(98, Math.max(72, Math.round(bestYield.successProbability * 100) + 10)),
    expectedRecoveryValue: bestYield.expectedValue,
    recoveryProbability: bestYield.successProbability,
    aiRationale: rationale,
    strategyYields: yields,
    isSuppressionRecommended: false,
  };
}

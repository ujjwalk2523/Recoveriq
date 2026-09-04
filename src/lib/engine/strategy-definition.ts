import { FailureCategory, RecoveryActionType } from './types';

export type SequenceStopCondition = 
  | 'PAID'
  | 'MAX_ATTEMPTS_REACHED'
  | 'FATIGUE_EXCEEDED'
  | 'EXPIRED'
  | 'OPERATOR_REJECTED'
  | 'FRAUD_DETECTED'
  | 'MANUAL_OVERRIDE';

export interface StrategyStepBlueprint {
  stepNumber: number;
  actionType: RecoveryActionType;
  channel: string;
  delayMinutes: number; // Cooling interval before dispatching this step
  rationale: string;
}

export interface RecoveryStrategyDefinition {
  id: string;
  name: string;
  description: string;
  failureCategories: FailureCategory[];
  targetSegments: ('VIP' | 'ENTERPRISE' | 'SMB' | 'CONSUMER')[];
  maxAttempts: number;
  defaultSteps: StrategyStepBlueprint[];
  stopConditions: SequenceStopCondition[];
}

export const STRATEGY_CATALOG: Record<string, RecoveryStrategyDefinition> = {
  STRAT_TECH_RAPID_CASCADE: {
    id: 'STRAT_TECH_RAPID_CASCADE',
    name: 'Technical Switch Rapid Cascade',
    description: '3-tier cascade optimized for banking switch timeouts and network drops: Immediate retry -> Delayed retry -> Multi-rail link.',
    failureCategories: ['TECHNICAL'],
    targetSegments: ['CONSUMER', 'SMB', 'ENTERPRISE', 'VIP'],
    maxAttempts: 3,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'IMMEDIATE_RETRY',
        channel: 'GATEWAY_RETRY',
        delayMinutes: 0,
        rationale: 'Zero-delay switch retry to catch transient NPCI / CBS network packet drops.',
      },
      {
        stepNumber: 2,
        actionType: 'OPTIMAL_DELAYED_RETRY',
        channel: 'GATEWAY_RETRY',
        delayMinutes: 15,
        rationale: 'Cooling period of 15 min allowing issuer switch buffer queues to clear.',
      },
      {
        stepNumber: 3,
        actionType: 'PAYMENT_LINK',
        channel: 'PAYMENT_LINK',
        delayMinutes: 45,
        rationale: 'Switch remained unresponsive; offering customer alternative payment rails via link.',
      },
    ],
    stopConditions: ['PAID', 'MAX_ATTEMPTS_REACHED', 'FATIGUE_EXCEEDED'],
  },

  STRAT_LOW_BALANCE_PAYDAY: {
    id: 'STRAT_LOW_BALANCE_PAYDAY',
    name: 'Smart Liquidity & Balance Realignment',
    description: 'Staggered recovery aligned with customer balance replenishment; avoids aggressive immediate retries.',
    failureCategories: ['INSUFFICIENT_FUNDS'],
    targetSegments: ['CONSUMER', 'SMB'],
    maxAttempts: 3,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'OPTIMAL_DELAYED_RETRY',
        channel: 'GATEWAY_RETRY',
        delayMinutes: 240, // 4 hours
        rationale: 'Deferred retry to allow customer account top-up or salary credit.',
      },
      {
        stepNumber: 2,
        actionType: 'PAYMENT_LINK',
        channel: 'PAYMENT_LINK',
        delayMinutes: 720, // 12 hours
        rationale: 'Provide customer choice to debit an alternate bank account or credit card.',
      },
      {
        stepNumber: 3,
        actionType: 'WHATSAPP_NUDGE',
        channel: 'WHATSAPP',
        delayMinutes: 1440, // 24 hours
        rationale: 'Gentle conversational reminder with 1-tap UPI payment prompt.',
      },
    ],
    stopConditions: ['PAID', 'MAX_ATTEMPTS_REACHED', 'FATIGUE_EXCEEDED'],
  },

  STRAT_3DS_INTERACTIVE_NUDGE: {
    id: 'STRAT_3DS_INTERACTIVE_NUDGE',
    name: 'Interactive Checkout & OTP Rescue',
    description: 'Instant customer-facing re-engagement for dropped 3DS OTPs and checkout dropoffs.',
    failureCategories: ['AUTHENTICATION', 'CUSTOMER_DROPOUT'],
    targetSegments: ['CONSUMER', 'SMB', 'ENTERPRISE', 'VIP'],
    maxAttempts: 2,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'WHATSAPP_NUDGE',
        channel: 'WHATSAPP',
        delayMinutes: 5,
        rationale: 'High-intent rescue: WhatsApp message delivered within 5 minutes while transaction intent is peak.',
      },
      {
        stepNumber: 2,
        actionType: 'PAYMENT_LINK',
        channel: 'PAYMENT_LINK',
        delayMinutes: 60,
        rationale: 'Omnichannel SMS/Email payment link if WhatsApp was unread.',
      },
    ],
    stopConditions: ['PAID', 'MAX_ATTEMPTS_REACHED', 'FATIGUE_EXCEEDED'],
  },

  STRAT_MANDATE_REAUTHORIZE: {
    id: 'STRAT_MANDATE_REAUTHORIZE',
    name: 'Mandate & Recurring Lifecycle Renewal',
    description: 'Automated mandate re-authorization routing with fallback payment links.',
    failureCategories: ['MANDATE_ISSUE', 'EXPIRED_OR_INVALID'],
    targetSegments: ['CONSUMER', 'SMB', 'ENTERPRISE'],
    maxAttempts: 2,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'MANDATE_UPDATE',
        channel: 'MANDATE_UPDATE',
        delayMinutes: 30,
        rationale: 'Prompt customer to refresh standing instruction or update UPI Autopay / eNACH limit.',
      },
      {
        stepNumber: 2,
        actionType: 'PAYMENT_LINK',
        channel: 'PAYMENT_LINK',
        delayMinutes: 360,
        rationale: 'Manual one-time payment link to prevent subscription cancellation while mandate is pending.',
      },
    ],
    stopConditions: ['PAID', 'MAX_ATTEMPTS_REACHED', 'FATIGUE_EXCEEDED'],
  },

  STRAT_HIGH_TICKET_VIP_CONCIERGE: {
    id: 'STRAT_HIGH_TICKET_VIP_CONCIERGE',
    name: 'VIP High-Ticket Concierge Recovery',
    description: 'High-touch outreach for high transaction amounts (>= ₹25,000) or enterprise tier accounts.',
    failureCategories: ['TECHNICAL', 'INSUFFICIENT_FUNDS', 'AUTHENTICATION'],
    targetSegments: ['VIP', 'ENTERPRISE'],
    maxAttempts: 2,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'PAYMENT_LINK',
        channel: 'PAYMENT_LINK',
        delayMinutes: 15,
        rationale: 'Personalized branded checkout session supporting Corporate Cards and RTGS/NEFT.',
      },
      {
        stepNumber: 2,
        actionType: 'HUMAN_ESCALATION',
        channel: 'HUMAN_ESCALATION',
        delayMinutes: 120,
        rationale: 'Relationship manager account executive high-touch outreach for VIP retention.',
      },
    ],
    stopConditions: ['PAID', 'MAX_ATTEMPTS_REACHED', 'OPERATOR_REJECTED'],
  },

  STRAT_FRAUD_HARD_SUPPRESSION: {
    id: 'STRAT_FRAUD_HARD_SUPPRESSION',
    name: 'Hard Risk & Fraud Suppression',
    description: 'Zero-touch suppression strategy for hotlisted cards, stolen credentials, and issuer fraud switches.',
    failureCategories: ['RISK_AND_FRAUD'],
    targetSegments: ['CONSUMER', 'SMB', 'ENTERPRISE', 'VIP'],
    maxAttempts: 0,
    defaultSteps: [
      {
        stepNumber: 1,
        actionType: 'DO_NOT_RECOVER',
        channel: 'DO_NOT_RECOVER',
        delayMinutes: 0,
        rationale: 'Hard suppression enforced: Interventions prohibited to eliminate dispute chargebacks.',
      },
    ],
    stopConditions: ['FRAUD_DETECTED'],
  },
};

/**
 * Selects the optimal recovery strategy definition based on failure diagnosis, customer tier, and amount
 */
export function resolveOptimalStrategy(params: {
  failureCategory: FailureCategory;
  customerSegment?: 'VIP' | 'ENTERPRISE' | 'SMB' | 'CONSUMER';
  amount: number;
  isFraudOrHotlisted?: boolean;
}): RecoveryStrategyDefinition {
  const { failureCategory, customerSegment = 'CONSUMER', amount, isFraudOrHotlisted } = params;

  // 1. Hard suppression for fraud
  if (isFraudOrHotlisted || failureCategory === 'RISK_AND_FRAUD') {
    return STRATEGY_CATALOG.STRAT_FRAUD_HARD_SUPPRESSION;
  }

  // 2. High-ticket VIP concierge strategy
  if (amount >= 30000 || customerSegment === 'VIP') {
    return STRATEGY_CATALOG.STRAT_HIGH_TICKET_VIP_CONCIERGE;
  }

  // 3. Category matching
  switch (failureCategory) {
    case 'TECHNICAL':
      return STRATEGY_CATALOG.STRAT_TECH_RAPID_CASCADE;
    case 'INSUFFICIENT_FUNDS':
      return STRATEGY_CATALOG.STRAT_LOW_BALANCE_PAYDAY;
    case 'AUTHENTICATION':
    case 'CUSTOMER_DROPOUT':
      return STRATEGY_CATALOG.STRAT_3DS_INTERACTIVE_NUDGE;
    case 'MANDATE_ISSUE':
    case 'EXPIRED_OR_INVALID':
      return STRATEGY_CATALOG.STRAT_MANDATE_REAUTHORIZE;
    default:
      return STRATEGY_CATALOG.STRAT_TECH_RAPID_CASCADE;
  }
}

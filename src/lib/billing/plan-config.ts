import { Feature, PlanCode, PlanDefinition, OveragePolicy } from './billing-types';

export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_PLAN_CODE = PlanCode.STARTER;

export const PLANS_CONFIG: Record<PlanCode, PlanDefinition> = {
  [PlanCode.STARTER]: {
    code: PlanCode.STARTER,
    name: 'Starter',
    description: 'Autonomous payment recovery for growing startups and early-stage merchants.',
    monthlyPriceMinor: 199900, // INR 1,999 in paise
    annualPriceMinor: 1999000, // INR 19,990 (2 months free)
    currency: 'INR',
    includedTransactions: 5000,
    includedRecoveryAttempts: 10000,
    includedApiRequests: 10000,
    includedMembers: 5,
    includedTeams: 2,
    features: {
      [Feature.BASIC_ANALYTICS]: true,
      [Feature.AUTONOMOUS_RECOVERY]: true,
      [Feature.ML_OPTIMIZATION]: false,
      [Feature.CONTEXTUAL_BANDIT]: false,
      [Feature.EXPERIMENTS]: false,
      [Feature.API_ACCESS]: true,
      [Feature.ADVANCED_INTELLIGENCE]: false,
      [Feature.CUSTOM_POLICIES]: false,
      [Feature.TEAM_MANAGEMENT]: false,
      [Feature.PRIORITY_SUPPORT]: false,
      [Feature.ENTERPRISE_CONTROLS]: false,
    },
    overagePolicy: OveragePolicy.BLOCK,
    overageRates: {
      transactionsPerUnitMinor: 0,
      recoveryAttemptsPerUnitMinor: 0,
      apiRequestsPerUnitMinor: 0,
    },
    trialEligibility: true,
    active: true,
  },
  [PlanCode.GROWTH]: {
    code: PlanCode.GROWTH,
    name: 'Growth',
    description: 'Full ML-powered recovery intelligence, contextual bandit routing, and A/B experiments.',
    monthlyPriceMinor: 799900, // INR 7,999 in paise
    annualPriceMinor: 7999000, // INR 79,990 (2 months free)
    currency: 'INR',
    includedTransactions: 50000,
    includedRecoveryAttempts: 100000,
    includedApiRequests: 100000,
    includedMembers: 20,
    includedTeams: 5,
    features: {
      [Feature.BASIC_ANALYTICS]: true,
      [Feature.AUTONOMOUS_RECOVERY]: true,
      [Feature.ML_OPTIMIZATION]: true,
      [Feature.CONTEXTUAL_BANDIT]: true,
      [Feature.EXPERIMENTS]: true,
      [Feature.API_ACCESS]: true,
      [Feature.ADVANCED_INTELLIGENCE]: true,
      [Feature.CUSTOM_POLICIES]: true,
      [Feature.TEAM_MANAGEMENT]: false,
      [Feature.PRIORITY_SUPPORT]: false,
      [Feature.ENTERPRISE_CONTROLS]: false,
    },
    overagePolicy: OveragePolicy.ALLOW_WITH_OVERAGE,
    overageRates: {
      transactionsPerUnitMinor: 50, // ₹0.50 per excess txn
      recoveryAttemptsPerUnitMinor: 100, // ₹1.00 per excess attempt
      apiRequestsPerUnitMinor: 10, // ₹0.10 per excess API call
    },
    trialEligibility: false,
    active: true,
  },
  [PlanCode.SCALE]: {
    code: PlanCode.SCALE,
    name: 'Scale',
    description: 'High-volume recovery infrastructure with priority execution, multi-team RBAC, and dedicated support.',
    monthlyPriceMinor: 2499900, // INR 24,999 in paise
    annualPriceMinor: 24999000, // INR 2,49,990 (2 months free)
    currency: 'INR',
    includedTransactions: 250000,
    includedRecoveryAttempts: 500000,
    includedApiRequests: 1000000,
    includedMembers: 100,
    includedTeams: 20,
    features: {
      [Feature.BASIC_ANALYTICS]: true,
      [Feature.AUTONOMOUS_RECOVERY]: true,
      [Feature.ML_OPTIMIZATION]: true,
      [Feature.CONTEXTUAL_BANDIT]: true,
      [Feature.EXPERIMENTS]: true,
      [Feature.API_ACCESS]: true,
      [Feature.ADVANCED_INTELLIGENCE]: true,
      [Feature.CUSTOM_POLICIES]: true,
      [Feature.TEAM_MANAGEMENT]: true,
      [Feature.PRIORITY_SUPPORT]: true,
      [Feature.ENTERPRISE_CONTROLS]: false,
    },
    overagePolicy: OveragePolicy.ALLOW_WITH_OVERAGE,
    overageRates: {
      transactionsPerUnitMinor: 30, // ₹0.30 per excess txn
      recoveryAttemptsPerUnitMinor: 80, // ₹0.80 per excess attempt
      apiRequestsPerUnitMinor: 5, // ₹0.05 per excess API call
    },
    trialEligibility: false,
    active: true,
  },
  [PlanCode.ENTERPRISE]: {
    code: PlanCode.ENTERPRISE,
    name: 'Enterprise',
    description: 'Bespoke high-volume SLA, custom guardrail configurations, enterprise audit trails, and dedicated compliance controls.',
    monthlyPriceMinor: -1, // Custom / Contact Sales
    annualPriceMinor: -1,
    currency: 'INR',
    includedTransactions: -1, // Unlimited
    includedRecoveryAttempts: -1, // Unlimited
    includedApiRequests: -1, // Unlimited
    includedMembers: -1,
    includedTeams: -1,
    features: {
      [Feature.BASIC_ANALYTICS]: true,
      [Feature.AUTONOMOUS_RECOVERY]: true,
      [Feature.ML_OPTIMIZATION]: true,
      [Feature.CONTEXTUAL_BANDIT]: true,
      [Feature.EXPERIMENTS]: true,
      [Feature.API_ACCESS]: true,
      [Feature.ADVANCED_INTELLIGENCE]: true,
      [Feature.CUSTOM_POLICIES]: true,
      [Feature.TEAM_MANAGEMENT]: true,
      [Feature.PRIORITY_SUPPORT]: true,
      [Feature.ENTERPRISE_CONTROLS]: true,
    },
    overagePolicy: OveragePolicy.ALLOW_UNTIL_HARD_LIMIT,
    overageRates: {
      transactionsPerUnitMinor: 20,
      recoveryAttemptsPerUnitMinor: 50,
      apiRequestsPerUnitMinor: 2,
    },
    trialEligibility: false,
    active: true,
  },
};

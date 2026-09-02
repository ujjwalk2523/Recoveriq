import { CustomerProfile, PolicyGuardrails, RecoveryActionType } from './types';

export const DEFAULT_POLICY_GUARDRAILS: PolicyGuardrails = {
  id: 'policy_default_in',
  autoApproveMaxAmount: 15000, // INR ₹15,000
  minConfidenceForAutoApprove: 80, // 80%
  maxCustomerFatigueThreshold: 70, // 70/100
  maxRetriesPerCustomerPerWeek: 3,
  disputeRiskBlockThreshold: 60,
  allowAutomatedWhatsAppNudges: true,
  allowAutomatedPaymentLinks: true,
  humanApprovalForVIPs: true,
  nightHoursRetrySilence: true,
};

export interface PolicyCheckResult {
  requiresHumanApproval: boolean;
  approvalReasons: string[];
  passedPolicies: string[];
  isBlockedByPolicy: boolean;
  blockReason?: string;
}

export function evaluatePolicyGuardrails(
  amount: number,
  action: RecoveryActionType,
  confidence: number,
  customer: CustomerProfile,
  policies: PolicyGuardrails = DEFAULT_POLICY_GUARDRAILS
): PolicyCheckResult {
  const approvalReasons: string[] = [];
  const passedPolicies: string[] = [];

  // 1. Check Hard Blockades
  if (customer.riskScore >= policies.disputeRiskBlockThreshold) {
    return {
      requiresHumanApproval: false,
      approvalReasons: [],
      passedPolicies: [],
      isBlockedByPolicy: true,
      blockReason: `Blocked by Policy: Customer dispute risk score (${customer.riskScore}) exceeds safe threshold (${policies.disputeRiskBlockThreshold}).`,
    };
  }

  // 2. Suppressed actions do not need approval
  if (action === 'DO_NOT_RECOVER') {
    return {
      requiresHumanApproval: false,
      approvalReasons: [],
      passedPolicies: ['Policy rule: Low-confidence or high-risk payments are suppressed without merchant intervention.'],
      isBlockedByPolicy: false,
    };
  }

  // 3. Amount Threshold Check
  if (amount > policies.autoApproveMaxAmount) {
    approvalReasons.push(`High transaction value (₹${amount.toLocaleString('en-IN')}) exceeds auto-recovery limit of ₹${policies.autoApproveMaxAmount.toLocaleString('en-IN')}.`);
  } else {
    passedPolicies.push(`Transaction amount (₹${amount.toLocaleString('en-IN')}) is within auto-approval ceiling (₹${policies.autoApproveMaxAmount.toLocaleString('en-IN')}).`);
  }

  // 4. AI Confidence Check
  if (confidence < policies.minConfidenceForAutoApprove) {
    approvalReasons.push(`AI recommendation confidence (${confidence}%) is below minimum auto-execution threshold (${policies.minConfidenceForAutoApprove}%).`);
  } else {
    passedPolicies.push(`AI confidence score (${confidence}%) meets or exceeds auto-execution standard (${policies.minConfidenceForAutoApprove}%).`);
  }

  // 5. VIP Customer Check
  if (customer.segment === 'VIP' && policies.humanApprovalForVIPs) {
    approvalReasons.push('Customer is tagged as VIP. Policy requires human confirmation before outbound communications.');
  }

  // 6. Fatigue Threshold Check
  if (customer.fatigueScore >= policies.maxCustomerFatigueThreshold) {
    approvalReasons.push(`Customer fatigue score (${customer.fatigueScore}) is elevated. Review recommended to prevent relationship damage.`);
  }

  // 7. Human Escalation actions always require review
  if (action === 'HUMAN_ESCALATION') {
    approvalReasons.push('Strategy is designated as Human Escalation. Requires merchant representative assignment.');
  }

  const requiresHumanApproval = approvalReasons.length > 0;

  return {
    requiresHumanApproval,
    approvalReasons,
    passedPolicies,
    isBlockedByPolicy: false,
  };
}

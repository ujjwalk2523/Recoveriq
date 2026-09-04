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

export type PolicyAuthorizationStatus = 'AUTO_APPROVED' | 'NEEDS_APPROVAL' | 'BLOCK_SUPPRESS';

export interface PolicyCheckResult {
  status: PolicyAuthorizationStatus;
  requiresHumanApproval: boolean;
  isBlockedByPolicy: boolean;
  approvalReasons: string[];
  passedPolicies: string[];
  blockReason?: string;
  evaluatedPoliciesCount: number;
}

/**
 * Policy Authorization Engine
 * Principle: AI/ML Recommends. Policy Authorizes.
 */
export function evaluatePolicyGuardrails(
  amount: number,
  action: RecoveryActionType,
  confidence: number,
  customer: CustomerProfile,
  policies: PolicyGuardrails = DEFAULT_POLICY_GUARDRAILS,
  hourOfDay: number = new Date().getHours()
): PolicyCheckResult {
  const approvalReasons: string[] = [];
  const passedPolicies: string[] = [];
  let isBlockedByPolicy = false;
  let blockReason: string | undefined;

  // 1. Check Hard Dispute / Fraud Blockade
  if (customer.riskScore >= policies.disputeRiskBlockThreshold) {
    return {
      status: 'BLOCK_SUPPRESS',
      requiresHumanApproval: false,
      isBlockedByPolicy: true,
      blockReason: `Hard block: Customer dispute risk score (${customer.riskScore}) exceeds safe threshold (${policies.disputeRiskBlockThreshold}).`,
      approvalReasons: [],
      passedPolicies: [],
      evaluatedPoliciesCount: 1,
    };
  }

  // 2. Action: DO_NOT_RECOVER requires no authorization
  if (action === 'DO_NOT_RECOVER') {
    return {
      status: 'AUTO_APPROVED',
      requiresHumanApproval: false,
      isBlockedByPolicy: false,
      approvalReasons: [],
      passedPolicies: ['Policy rule: Low-confidence or high-risk payments are suppressed without merchant intervention.'],
      evaluatedPoliciesCount: 2,
    };
  }

  // 3. Amount Ceiling Check
  if (amount > policies.autoApproveMaxAmount) {
    approvalReasons.push(`High transaction value (₹${amount.toLocaleString('en-IN')}) exceeds auto-approval ceiling of ₹${policies.autoApproveMaxAmount.toLocaleString('en-IN')}.`);
  } else {
    passedPolicies.push(`Transaction amount (₹${amount.toLocaleString('en-IN')}) is within auto-approval ceiling.`);
  }

  // 4. Minimum Confidence Floor Check
  if (confidence < policies.minConfidenceForAutoApprove) {
    approvalReasons.push(`AI confidence score (${confidence}%) is below auto-approval threshold (${policies.minConfidenceForAutoApprove}%).`);
  } else {
    passedPolicies.push(`AI prediction confidence (${confidence}%) meets auto-approval criteria.`);
  }

  // 5. Customer Fatigue Ceiling
  if (customer.fatigueScore >= policies.maxCustomerFatigueThreshold) {
    approvalReasons.push(`Customer fatigue level (${customer.fatigueScore}/100) exceeds tolerance ceiling (${policies.maxCustomerFatigueThreshold}).`);
  } else {
    passedPolicies.push(`Customer fatigue level (${customer.fatigueScore}/100) is within acceptable bounds.`);
  }

  // 6. VIP Segment Human Sign-off Policy
  if (policies.humanApprovalForVIPs && (customer.segment === 'VIP' || customer.segment === 'ENTERPRISE')) {
    approvalReasons.push(`Merchant policy mandates manual sign-off for ${customer.segment} accounts.`);
  } else {
    passedPolicies.push(`Customer tier (${customer.segment}) cleared for automated recovery workflow.`);
  }

  // 7. Channel Specific Enablement Guardrails
  if (action === 'WHATSAPP_NUDGE' && !policies.allowAutomatedWhatsAppNudges) {
    approvalReasons.push('Automated WhatsApp messaging is currently disabled by merchant policy.');
  }
  if (action === 'PAYMENT_LINK' && !policies.allowAutomatedPaymentLinks) {
    approvalReasons.push('Automated payment link generation is disabled by merchant policy.');
  }

  // 8. Quiet Night Hours Retry Silence (10 PM to 8 AM)
  const isNightHour = hourOfDay >= 22 || hourOfDay < 8;
  const isCustomerFacingAction = action === 'WHATSAPP_NUDGE' || action === 'PAYMENT_LINK' || action === 'HUMAN_ESCALATION';

  if (policies.nightHoursRetrySilence && isNightHour && isCustomerFacingAction) {
    approvalReasons.push(`Quiet night hours policy (10 PM - 8 AM IST): Interactive outreach (${action}) requires operator approval or queueing for morning window.`);
  } else {
    passedPolicies.push('Quiet hours compliance verified.');
  }

  const requiresHumanApproval = approvalReasons.length > 0;
  const status: PolicyAuthorizationStatus = requiresHumanApproval ? 'NEEDS_APPROVAL' : 'AUTO_APPROVED';

  return {
    status,
    requiresHumanApproval,
    isBlockedByPolicy,
    approvalReasons,
    passedPolicies,
    blockReason,
    evaluatedPoliciesCount: 8,
  };
}

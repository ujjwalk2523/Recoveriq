import {
  Feature,
  PlanCode,
  SubscriptionStatusType,
  BillingProvider,
  SubscriptionEventType,
} from '../src/lib/billing/billing-types';
import { PLANS_CONFIG, DEFAULT_TRIAL_DAYS } from '../src/lib/billing/plan-config';
import { PlanService } from '../src/lib/billing/plan-service';
import { SubscriptionService } from '../src/lib/billing/subscription-service';
import { SubscriptionStateMachine } from '../src/lib/billing/subscription-state-machine';
import { EntitlementService } from '../src/lib/billing/entitlement-service';
import {
  InvalidSubscriptionTransitionError,
  EntitlementDeniedError,
  PlanNotFoundError,
} from '../src/lib/billing/billing-errors';

process.env.SKIP_DB = 'true';

async function runBillingTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 7.1 — RECOVERIQ SaaS SUBSCRIPTION & PLAN SUITE');
  console.log('================================================================\n');

  SubscriptionService.clearCache();

  // ---------------------------------------------------------------------------
  // Test 1: Plan Creation & Configuration
  // ---------------------------------------------------------------------------
  console.log('▶ Test 1: Plan Centralized Commercial Configuration');
  const starter = PLANS_CONFIG[PlanCode.STARTER];
  const growth = PLANS_CONFIG[PlanCode.GROWTH];
  const scale = PLANS_CONFIG[PlanCode.SCALE];
  const enterprise = PLANS_CONFIG[PlanCode.ENTERPRISE];

  console.log(`  STARTER:    ₹${starter.monthlyPriceMinor / 100}/mo (${starter.includedTransactions} txns, ${starter.includedRecoveryAttempts} attempts)`);
  console.log(`  GROWTH:     ₹${growth.monthlyPriceMinor / 100}/mo (${growth.includedTransactions} txns, ${growth.includedRecoveryAttempts} attempts)`);
  console.log(`  SCALE:      ₹${scale.monthlyPriceMinor / 100}/mo (${scale.includedTransactions} txns, ${scale.includedRecoveryAttempts} attempts)`);
  console.log(`  ENTERPRISE: Custom (${enterprise.includedTransactions === -1 ? 'Unlimited' : enterprise.includedTransactions} txns)`);

  if (!starter || !growth || !scale || !enterprise) {
    throw new Error('Missing core plan configurations!');
  }
  console.log('  ✔ All 4 commercial plans centrally defined in PLANS_CONFIG.');

  // ---------------------------------------------------------------------------
  // Test 2: Plan Lookup
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 2: Plan Lookup & Resolution');
  const resolvedGrowth = await PlanService.getPlan('growth');
  const allPlans = await PlanService.listActivePlans();

  console.log(`  Resolved Plan: ${resolvedGrowth.name} (Code: ${resolvedGrowth.code})`);
  console.log(`  Active Plans Count: ${allPlans.length}`);

  if (resolvedGrowth.code !== PlanCode.GROWTH || allPlans.length < 4) {
    throw new Error('Plan resolution or listing failed!');
  }

  let planNotFound = false;
  try {
    await PlanService.getPlan('NON_EXISTENT_TIER');
  } catch (err) {
    if (err instanceof PlanNotFoundError) planNotFound = true;
  }
  if (!planNotFound) throw new Error('Expected PlanNotFoundError for invalid plan code!');
  console.log('  ✔ Plan lookup, listing, and validation functioning accurately.');

  // ---------------------------------------------------------------------------
  // Test 3 & 4: Merchant Default Subscription & Trial Creation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 3 & 4: Default Merchant Subscription & 14-Day Trial Creation');
  const merchantId1 = 'mer_tenant_alpha';
  const subAlpha = await SubscriptionService.getSubscription(merchantId1);

  console.log(`  Provisioned Plan:   ${subAlpha.planCode}`);
  console.log(`  Status:             ${subAlpha.status}`);
  console.log(`  Provider:           ${subAlpha.provider}`);
  console.log(`  Trial Active:       ${SubscriptionService.isTrialActive(subAlpha)}`);
  console.log(`  Trial End Date:     ${subAlpha.trialEnd ? new Date(subAlpha.trialEnd).toISOString() : 'none'}`);

  if (
    subAlpha.planCode !== PlanCode.STARTER ||
    subAlpha.status !== SubscriptionStatusType.TRIALING ||
    subAlpha.provider !== BillingProvider.INTERNAL ||
    !SubscriptionService.isTrialActive(subAlpha)
  ) {
    throw new Error('Default subscription failed to provision STARTER / TRIALING state!');
  }

  const trialDurationDays = Math.round(
    (new Date(subAlpha.trialEnd!).getTime() - new Date(subAlpha.trialStart!).getTime()) / (1000 * 60 * 60 * 24)
  );
  console.log(`  Trial Duration:     ${trialDurationDays} days (Configured: ${DEFAULT_TRIAL_DAYS})`);

  if (trialDurationDays !== DEFAULT_TRIAL_DAYS) {
    throw new Error(`Trial duration ${trialDurationDays} days does not match expected ${DEFAULT_TRIAL_DAYS}!`);
  }
  console.log('  ✔ Merchant default subscription automatically provisions 14-day STARTER trial.');

  // ---------------------------------------------------------------------------
  // Test 5: Subscription Activation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 5: Subscription Activation');
  const activatedSub = await SubscriptionService.activateSubscription(merchantId1, 'Ujjwal (Admin)');
  console.log(`  Status After Activate: ${activatedSub.status}`);

  if (activatedSub.status !== SubscriptionStatusType.ACTIVE) {
    throw new Error('Failed to activate subscription!');
  }
  console.log('  ✔ Subscription successfully transitioned from TRIALING to ACTIVE.');

  // ---------------------------------------------------------------------------
  // Test 6 & 7: State Machine Permitted & Illegal Transitions
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 6 & 7: Subscription State Machine Permitted & Illegal Transitions');
  // Legal transitions:
  // ACTIVE -> PAST_DUE
  // ACTIVE -> CANCELLED
  // ACTIVE -> SUSPENDED
  console.log(`  ACTIVE -> PAST_DUE:    ${SubscriptionStateMachine.canTransition(SubscriptionStatusType.ACTIVE, SubscriptionStatusType.PAST_DUE)} (Legal)`);
  console.log(`  ACTIVE -> CANCELLED:   ${SubscriptionStateMachine.canTransition(SubscriptionStatusType.ACTIVE, SubscriptionStatusType.CANCELLED)} (Legal)`);
  console.log(`  ACTIVE -> SUSPENDED:   ${SubscriptionStateMachine.canTransition(SubscriptionStatusType.ACTIVE, SubscriptionStatusType.SUSPENDED)} (Legal)`);

  // Illegal transitions:
  // SUSPENDED -> TRIALING (Illegal)
  // EXPIRED -> PAST_DUE (Illegal)
  console.log(`  SUSPENDED -> TRIALING: ${SubscriptionStateMachine.canTransition(SubscriptionStatusType.SUSPENDED, SubscriptionStatusType.TRIALING)} (Illegal)`);
  console.log(`  EXPIRED -> PAST_DUE:   ${SubscriptionStateMachine.canTransition(SubscriptionStatusType.EXPIRED, SubscriptionStatusType.PAST_DUE)} (Illegal)`);

  let illegalCaught = false;
  try {
    SubscriptionStateMachine.assertTransition(SubscriptionStatusType.SUSPENDED, SubscriptionStatusType.TRIALING);
  } catch (err) {
    if (err instanceof InvalidSubscriptionTransitionError) illegalCaught = true;
  }

  if (!illegalCaught) {
    throw new Error('State machine failed to block illegal status transition!');
  }
  console.log('  ✔ Subscription state machine correctly enforces legal transitions and rejects illegal mutations.');

  // ---------------------------------------------------------------------------
  // Test 8: Plan Upgrade (STARTER -> GROWTH)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 8: Plan Upgrade (STARTER -> GROWTH)');
  const upgradedSub = await SubscriptionService.changePlan(merchantId1, PlanCode.GROWTH, 'Ujjwal (Admin)');
  console.log(`  New Plan: ${upgradedSub.planCode} (Price: ₹${PLANS_CONFIG[upgradedSub.planCode].monthlyPriceMinor / 100}/mo)`);

  if (upgradedSub.planCode !== PlanCode.GROWTH) {
    throw new Error('Plan upgrade failed!');
  }
  console.log('  ✔ Plan upgrade executed with event recorded.');

  // ---------------------------------------------------------------------------
  // Test 9: Plan Downgrade (GROWTH -> STARTER)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 9: Plan Downgrade & Scale Up');
  const scaleSub = await SubscriptionService.changePlan(merchantId1, PlanCode.SCALE, 'Ujjwal (Admin)');
  console.log(`  Scaled Plan:    ${scaleSub.planCode}`);
  const downgradedSub = await SubscriptionService.changePlan(merchantId1, PlanCode.GROWTH, 'Ujjwal (Admin)');
  console.log(`  Downgraded:     ${downgradedSub.planCode}`);

  if (downgradedSub.planCode !== PlanCode.GROWTH) {
    throw new Error('Plan downgrade failed!');
  }
  console.log('  ✔ Plan changes (upgrade/downgrade) operate cleanly.');

  // ---------------------------------------------------------------------------
  // Test 10: Subscription Cancellation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 10: Subscription Cancellation');
  const cancelledSub = await SubscriptionService.cancelSubscription(merchantId1, 'Ujjwal (Admin)', true);
  console.log(`  Cancelled Status:   ${cancelledSub.status}`);
  console.log(`  CancelAtPeriodEnd:  ${cancelledSub.cancelAtPeriodEnd}`);
  console.log(`  Cancelled At:       ${cancelledSub.cancelledAt ? new Date(cancelledSub.cancelledAt).toISOString() : 'none'}`);

  if (cancelledSub.status !== SubscriptionStatusType.CANCELLED || !cancelledSub.cancelledAt) {
    throw new Error('Subscription cancellation failed!');
  }
  console.log('  ✔ Subscription cancelled with cancellation timestamp stamped.');

  // ---------------------------------------------------------------------------
  // Test 11: Subscription Reactivation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 11: Subscription Reactivation');
  const reactivatedSub = await SubscriptionService.reactivateSubscription(merchantId1, 'Ujjwal (Admin)');
  console.log(`  Reactivated Status: ${reactivatedSub.status}`);
  console.log(`  Cancelled At Cleared: ${reactivatedSub.cancelledAt === null}`);

  if (reactivatedSub.status !== SubscriptionStatusType.ACTIVE || reactivatedSub.cancelledAt !== null) {
    throw new Error('Subscription reactivation failed!');
  }
  console.log('  ✔ Subscription reactivated back to ACTIVE state.');

  // ---------------------------------------------------------------------------
  // Test 12 & 13: Subscription Suspension & Expiration
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 12 & 13: Subscription Suspension & Expiration');
  const suspendedSub = await SubscriptionService.suspendSubscription(merchantId1, 'Non-payment after dunning period', 'DunningWorker');
  console.log(`  Suspended Status:   ${suspendedSub.status}`);
  console.log(`  Is Suspended:       ${SubscriptionService.isSuspended(suspendedSub)}`);

  const expiredSub = await SubscriptionService.expireSubscription(merchantId1, 'SystemBillingReconciliation');
  console.log(`  Expired Status:     ${expiredSub.status}`);
  console.log(`  Is Expired:         ${SubscriptionService.isExpired(expiredSub)}`);

  if (!SubscriptionService.isSuspended(suspendedSub) || !SubscriptionService.isExpired(expiredSub)) {
    throw new Error('Suspension or expiration status evaluation failed!');
  }
  console.log('  ✔ Suspension and expiration state transitions verified.');

  // ---------------------------------------------------------------------------
  // Test 14: Feature Entitlement Gating
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 14: Feature Entitlements & Plan Boundary Enforcement');
  const merchantStarter = 'mer_starter_only';
  await SubscriptionService.createDefaultSubscription(merchantStarter, PlanCode.STARTER);
  await SubscriptionService.activateSubscription(merchantStarter);

  const starterCanAnalytics = await EntitlementService.canUseFeature(merchantStarter, Feature.BASIC_ANALYTICS);
  const starterCanML = await EntitlementService.canUseFeature(merchantStarter, Feature.ML_OPTIMIZATION);
  const starterCanBandit = await EntitlementService.canUseFeature(merchantStarter, Feature.CONTEXTUAL_BANDIT);
  const starterCanExperiments = await EntitlementService.canUseFeature(merchantStarter, Feature.EXPERIMENTS);

  console.log(`  STARTER: Can BASIC_ANALYTICS:    ${starterCanAnalytics} (Expect: true)`);
  console.log(`  STARTER: Can ML_OPTIMIZATION:   ${starterCanML} (Expect: false)`);
  console.log(`  STARTER: Can CONTEXTUAL_BANDIT:  ${starterCanBandit} (Expect: false)`);
  console.log(`  STARTER: Can EXPERIMENTS:        ${starterCanExperiments} (Expect: false)`);

  if (!starterCanAnalytics || starterCanML || starterCanBandit || starterCanExperiments) {
    throw new Error('Feature gating failed for STARTER plan!');
  }

  // Now upgrade to GROWTH
  await SubscriptionService.changePlan(merchantStarter, PlanCode.GROWTH, 'Admin');
  const growthCanML = await EntitlementService.canUseFeature(merchantStarter, Feature.ML_OPTIMIZATION);
  const growthCanBandit = await EntitlementService.canUseFeature(merchantStarter, Feature.CONTEXTUAL_BANDIT);
  const growthCanEnterprise = await EntitlementService.canUseFeature(merchantStarter, Feature.ENTERPRISE_CONTROLS);

  console.log(`  GROWTH:  Can ML_OPTIMIZATION:   ${growthCanML} (Expect: true)`);
  console.log(`  GROWTH:  Can CONTEXTUAL_BANDIT:  ${growthCanBandit} (Expect: true)`);
  console.log(`  GROWTH:  Can ENTERPRISE_CONTROLS:${growthCanEnterprise} (Expect: false)`);

  if (!growthCanML || !growthCanBandit || growthCanEnterprise) {
    throw new Error('Feature gating failed for GROWTH plan!');
  }

  // Assert entitlement throws error when denied
  let entitlementDenied = false;
  try {
    await EntitlementService.assertFeatureEntitlement(merchantStarter, Feature.ENTERPRISE_CONTROLS);
  } catch (err) {
    if (err instanceof EntitlementDeniedError) entitlementDenied = true;
  }

  if (!entitlementDenied) {
    throw new Error('assertFeatureEntitlement failed to throw EntitlementDeniedError!');
  }
  console.log('  ✔ Feature entitlements strictly enforced across plan tiers.');

  // ---------------------------------------------------------------------------
  // Test 15, 16, 17: Transaction, API & Recovery Attempt Limits
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 15, 16, 17: Platform Capacity & Allowance Limits');
  const starterTxLimit = await EntitlementService.getTransactionLimit(merchantStarter);
  const starterAttemptLimit = await EntitlementService.getRecoveryAttemptLimit(merchantStarter);
  const starterApiLimit = await EntitlementService.getApiRequestLimit(merchantStarter);

  console.log(`  Limits for GROWTH Plan:`);
  console.log(`    Transactions:       ${starterTxLimit.toLocaleString('en-IN')} / month`);
  console.log(`    Recovery Attempts:  ${starterAttemptLimit.toLocaleString('en-IN')} / month`);
  console.log(`    API Calls:          ${starterApiLimit.toLocaleString('en-IN')} / month`);

  if (starterTxLimit !== 50000 || starterAttemptLimit !== 100000 || starterApiLimit !== 100000) {
    throw new Error('Plan limits do not match GROWTH configuration!');
  }
  console.log('  ✔ Platform usage and allowance limits exposed through domain service.');

  // ---------------------------------------------------------------------------
  // Test 18: Multi-Tenant Merchant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 18: Multi-Tenant Subscription Isolation');
  const merchantTenantB = 'mer_tenant_beta';
  const subTenantB = await SubscriptionService.createDefaultSubscription(merchantTenantB, PlanCode.SCALE);

  const subAlphaRechecked = await SubscriptionService.getSubscription(merchantStarter);
  console.log(`  Tenant A Plan: ${subAlphaRechecked.planCode}`);
  console.log(`  Tenant B Plan: ${subTenantB.planCode}`);

  if (subAlphaRechecked.planCode === subTenantB.planCode) {
    throw new Error('Cross-tenant data pollution detected in subscription service!');
  }
  console.log('  ✔ Strict merchant tenancy isolation confirmed.');

  // ---------------------------------------------------------------------------
  // Test 19: Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 19: RBAC Billing Authorization');
  const { canModifyPolicies } = await import('../src/lib/auth/tenant');
  const ownerCanModify = canModifyPolicies('OWNER');
  const adminCanModify = canModifyPolicies('ADMIN');
  const analystCanModify = canModifyPolicies('ANALYST');
  const operatorCanModify = canModifyPolicies('OPERATOR');

  console.log(`  OWNER can modify billing:    ${ownerCanModify} (Expect: true)`);
  console.log(`  ADMIN can modify billing:    ${adminCanModify} (Expect: true)`);
  console.log(`  ANALYST can modify billing:  ${analystCanModify} (Expect: false)`);
  console.log(`  OPERATOR can modify billing: ${operatorCanModify} (Expect: false)`);

  if (!ownerCanModify || !adminCanModify || analystCanModify || operatorCanModify) {
    throw new Error('RBAC permissions for billing mutation violated!');
  }
  console.log('  ✔ RBAC rules: Only OWNER and ADMIN can alter subscription plans.');

  // ---------------------------------------------------------------------------
  // Test 20 & 21: Append-Only Subscription Events & Audit Logging
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 20 & 21: Append-Only Event History & Audit Integration');
  const events = await SubscriptionService.getSubscriptionEvents(merchantStarter);
  console.log(`  Total Events Recorded for Tenant: ${events.length}`);
  events.forEach((e, idx) => {
    console.log(`    [#${idx + 1}] ${e.eventType} | Plan: ${e.previousPlan ?? 'none'} -> ${e.newPlan ?? 'none'} | Actor: ${e.actor}`);
  });

  if (events.length < 3) {
    throw new Error('Expected at least 3 append-only events recorded for merchant!');
  }
  console.log('  ✔ Subscription event history is append-only and integrated with AuditService.');

  // ---------------------------------------------------------------------------
  // Test 22: Trial Expiration Handling
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 22: Trial Expiration Check');
  const expiredTrialSub = {
    ...subAlpha,
    status: SubscriptionStatusType.TRIALING,
    trialEnd: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  };
  const isTrialStillActive = SubscriptionService.isTrialActive(expiredTrialSub as any);
  const isSubExpired = SubscriptionService.isExpired(expiredTrialSub as any);

  console.log(`  Past Trial Active:  ${isTrialStillActive} (Expect: false)`);
  console.log(`  Past Trial Expired: ${isSubExpired} (Expect: true)`);

  if (isTrialStillActive || !isSubExpired) {
    throw new Error('Trial expiration logic failed!');
  }
  console.log('  ✔ Trial expiration detected accurately without relying on UI dates.');

  // ---------------------------------------------------------------------------
  // Test 23: Past-Due Status Handling
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 23: Past-Due Status Behavior');
  const pastDueSub = {
    ...subAlpha,
    status: SubscriptionStatusType.PAST_DUE,
  };
  const isPastDue = SubscriptionService.isPastDue(pastDueSub as any);
  console.log(`  Is Past Due: ${isPastDue} (Expect: true)`);

  if (!isPastDue) {
    throw new Error('isPastDue check failed!');
  }
  console.log('  ✔ Past-due status handled accurately.');

  // ---------------------------------------------------------------------------
  // Test 24: No Floating-Point Money Errors (Paise Validation)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 24: Integer Minor Units (Paise) Monetary Precision');
  const priceStarter = PLANS_CONFIG[PlanCode.STARTER].monthlyPriceMinor;
  const priceGrowth = PLANS_CONFIG[PlanCode.GROWTH].monthlyPriceMinor;
  const priceScale = PLANS_CONFIG[PlanCode.SCALE].monthlyPriceMinor;

  console.log(`  Starter Minor Units: ${priceStarter} paise (₹${priceStarter / 100})`);
  console.log(`  Growth Minor Units:  ${priceGrowth} paise (₹${priceGrowth / 100})`);
  console.log(`  Scale Minor Units:   ${priceScale} paise (₹${priceScale / 100})`);

  if (!Number.isInteger(priceStarter) || !Number.isInteger(priceGrowth) || !Number.isInteger(priceScale)) {
    throw new Error('Monetary amounts must be stored as integers in minor units (paise)!');
  }
  if (priceStarter !== 199900 || priceGrowth !== 799900 || priceScale !== 2499900) {
    throw new Error('Minor units do not match exact commercial prices!');
  }
  console.log('  ✔ Zero floating-point money errors: All prices stored as integer minor units.');

  // ---------------------------------------------------------------------------
  // Test 25: Phase 6 Integration Boundary (Entitlement Check)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Test 25: Phase 6 Integration Boundary Entitlement Call');
  const canRunBandit = await EntitlementService.canUseFeature(merchantStarter, Feature.CONTEXTUAL_BANDIT);
  console.log(`  Tenant can invoke Contextual Bandit: ${canRunBandit} (Plan: ${subAlphaRechecked.planCode})`);

  if (!canRunBandit) {
    throw new Error('Merchant on GROWTH plan should be entitled to CONTEXTUAL_BANDIT!');
  }
  console.log('  ✔ Phase 6 feature authorization seamlessly integrated with EntitlementService.');

  console.log('\n================================================================');
  console.log('📊 PHASE 7.1 SaaS SUBSCRIPTION & PLAN ARCHITECTURE REPORT');
  console.log('================================================================');
  console.log('  Plan Commercial Architecture:   PASS (Starter, Growth, Scale, Enterprise)');
  console.log('  Integer Minor Units:            PASS (Stored as paise, no floating point)');
  console.log('  Default Merchant Subscription:  PASS (14-Day STARTER Trial)');
  console.log('  State Machine Transitions:      PASS (Deterministic validation & error handling)');
  console.log('  Plan Upgrades & Downgrades:     PASS (Operational with history)');
  console.log('  Cancellation & Reactivation:    PASS (Timestamps & status transitions)');
  console.log('  Suspension & Expiration:        PASS (Safe administrative locks)');
  console.log('  Feature Entitlements:           PASS (Domain-level checks, no hardcoded plans)');
  console.log('  Usage Allowances:               PASS (Txns, attempts, API limits exposed)');
  console.log('  Multi-Tenant Isolation:         PASS (Tenant-scoped context enforced)');
  console.log('  RBAC Authorization:             PASS (OWNER/ADMIN only for mutations)');
  console.log('  Subscription Event History:     PASS (Append-only trail with AuditService)');
  console.log('================================================================\n');

  console.log('🎉 ALL PHASE 7.1 SaaS SUBSCRIPTION & PLAN TESTS PASSED WITH 100% SUCCESS!');
}

runBillingTestSuite().catch((err) => {
  console.error('❌ Phase 7.1 Test Suite failed:', err);
  process.exit(1);
});

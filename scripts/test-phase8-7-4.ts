/**
 * Phase 8.7.4 — Enterprise Governance Policies & Preventive Controls Test Suite
 *
 * Verifies:
 * 1. Policy CRUD & Immutable History Snapshots (GovernancePolicyService)
 * 2. Condition AST & Operator Evaluation (EQUALS, IN, BETWEEN, GREATER_THAN, etc.)
 * 3. Deterministic Precedence Resolution (DENY > REQUIRE_STEP_UP > REQUIRE_APPROVAL > ALLOW)
 * 4. Fail-Closed Behavior for Critical Admin Actions
 * 5. RBAC Primacy Invariant (Governance policies can never override RBAC denial)
 * 6. Simulation Mode & Non-Execution Invariant (Zero audit events, zero side effects)
 * 7. Multi-Tenant Isolation & Zero Cross-Tenant Leakage
 * 8. Adversarial & Security Robustness (ReDoS bounds, prototype safety, malformed AST)
 * 9. Performance Benchmark (100 policies evaluation latency)
 */

process.env.SKIP_DB = 'true';

import { GovernancePolicyEngine, CRITICAL_ADMIN_ACTIONS } from '../src/lib/governance/governance-policy-engine';
import { GovernancePolicyService } from '../src/lib/governance/governance-policy-service';
import {
  GovernancePolicyRecord,
  GovernanceEvaluationContext,
  GovernanceConditions,
} from '../src/lib/governance/governance-types';
import { IN_MEMORY_AUDIT_LEDGER } from '../src/lib/audit/audit-repository';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runPhase874Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.7.4 — GOVERNANCE POLICY ENGINE VERIFICATION');
  console.log('================================================================\n');

  GovernancePolicyService.clearMemoryForTesting();
  IN_MEMORY_AUDIT_LEDGER.length = 0;

  const orgAlpha = 'org_enterprise_alpha';
  const orgBeta = 'org_enterprise_beta';

  // ---------------------------------------------------------------------------
  // DOMAIN 1: Policy CRUD & Immutable History Snapshots
  // ---------------------------------------------------------------------------
  console.log('--- Domain 1: Policy CRUD & Version History Snapshots ---');

  const policy1 = await GovernancePolicyService.createPolicy({
    organizationId: orgAlpha,
    name: 'Require Step-Up For Production Mutations',
    description: 'Enforces MFA step-up when modifying production resources',
    category: 'SECURITY',
    status: 'ACTIVE',
    priority: 50,
    effect: 'REQUIRE_STEP_UP',
    conditions: {
      all: [
        { field: 'environment', operator: 'EQUALS', value: 'production' },
        { field: 'mfaAge', operator: 'GREATER_THAN', value: 300 }, // MFA older than 5 mins
      ],
    },
    createdBy: 'usr_admin_1',
  });

  assert(policy1.id.startsWith('pol_'), 'Policy ID generated with pol_ prefix');
  assert(policy1.version === 1, 'Initial policy version is 1');
  assert(policy1.status === 'ACTIVE', 'Initial policy status is ACTIVE');
  assert(policy1.effect === 'REQUIRE_STEP_UP', 'Policy effect is REQUIRE_STEP_UP');

  // Verify Audit Log entry for creation
  const createAuditEvent = IN_MEMORY_AUDIT_LEDGER.find(
    e => e.action === 'GOVERNANCE_POLICY_CREATED' && (e.resource as any)?.id === policy1.id
  );
  assert(createAuditEvent !== undefined, 'Audit event recorded for policy creation');

  // Update policy: Modify description, change effect to DENY, priority to 10
  const updatedPolicy1 = await GovernancePolicyService.updatePolicy({
    policyId: policy1.id,
    organizationId: orgAlpha,
    effect: 'DENY',
    priority: 10,
    description: 'Strict deny for production mutations without recent MFA',
    updatedBy: 'usr_admin_2',
    changeReason: 'Hardened security posture per SOC2 compliance review',
  });

  assert(updatedPolicy1.version === 2, 'Updated policy version incremented to 2');
  assert(updatedPolicy1.effect === 'DENY', 'Updated policy effect changed to DENY');
  assert(updatedPolicy1.priority === 10, 'Updated policy priority changed to 10');

  // Fetch with history
  const fetched = await GovernancePolicyService.getPolicy(policy1.id, orgAlpha);
  assert(fetched !== null, 'Fetched updated policy from service');
  assert(fetched?.history?.length === 1, 'Policy has exactly 1 historical snapshot');
  const snapshot = fetched!.history![0];
  assert(snapshot.version === 1, 'Historical snapshot is version 1');
  assert(snapshot.effect === 'REQUIRE_STEP_UP', 'Historical snapshot preserved previous effect REQUIRE_STEP_UP');
  assert(snapshot.changeReason === 'Hardened security posture per SOC2 compliance review', 'Change reason recorded in history');

  // Lifecycle transitions: Pause, Resume, Archive
  const pausedPolicy = await GovernancePolicyService.updatePolicyStatus({
    policyId: policy1.id,
    organizationId: orgAlpha,
    status: 'PAUSED',
    updatedBy: 'usr_admin_1',
    reason: 'Temporary maintenance pause',
  });
  assert(pausedPolicy.status === 'PAUSED', 'Policy successfully transitioned to PAUSED');

  const resumedPolicy = await GovernancePolicyService.updatePolicyStatus({
    policyId: policy1.id,
    organizationId: orgAlpha,
    status: 'ACTIVE',
    updatedBy: 'usr_admin_1',
    reason: 'Maintenance complete',
  });
  assert(resumedPolicy.status === 'ACTIVE', 'Policy successfully resumed to ACTIVE');
  assert(resumedPolicy.version === 4, 'Policy version incremented on each status change');

  // ---------------------------------------------------------------------------
  // DOMAIN 2: Condition AST & Operator Evaluation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 2: Condition AST & Operator Evaluation ---');

  const testContext: GovernanceEvaluationContext = {
    organizationId: orgAlpha,
    actorId: 'usr_analyst',
    actorType: 'USER',
    role: 'ANALYST',
    action: 'DATA_EXPORT',
    resourceType: 'FINANCIAL_REPORT',
    resourceId: 'rep_456',
    severity: 'HIGH',
    environment: 'production',
    mfaAge: 600, // 10 mins
    teamIds: ['team_finance', 'team_analytics'],
    timestamp: new Date('2026-09-04T14:30:00Z'), // Friday 14:30 UTC
  };

  // EQUALS & NOT_EQUALS
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'actorRole', operator: 'EQUALS', value: 'ANALYST' },
      testContext
    ) === true,
    'EQUALS operator matches correctly'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'actorRole', operator: 'NOT_EQUALS', value: 'ADMIN' },
      testContext
    ) === true,
    'NOT_EQUALS operator matches correctly'
  );

  // IN & NOT_IN with arrays
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'action', operator: 'IN', value: ['DATA_EXPORT', 'REPORT_VIEW'] },
      testContext
    ) === true,
    'IN operator matches item in array'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'teamIds', operator: 'IN', value: ['team_finance'] },
      testContext
    ) === true,
    'IN operator matches element in context array'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'action', operator: 'NOT_IN', value: ['USER_DELETE', 'API_KEY_REVOKE'] },
      testContext
    ) === true,
    'NOT_IN operator passes when item is absent'
  );

  // Numeric comparisons: GREATER_THAN, LESS_THAN, BETWEEN
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'mfaAge', operator: 'GREATER_THAN', value: 300 },
      testContext
    ) === true,
    'GREATER_THAN operator works for numeric mfaAge'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'mfaAge', operator: 'LESS_THAN_OR_EQUAL', value: 600 },
      testContext
    ) === true,
    'LESS_THAN_OR_EQUAL operator works for numeric mfaAge'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(
      { field: 'timeOfDay', operator: 'BETWEEN', value: [12, 16] },
      testContext
    ) === true,
    'BETWEEN operator matches 14:00 within range [12, 16]'
  );

  // Compound Conditions: ALL (AND) and ANY (OR)
  const compoundCond1: GovernanceConditions = {
    all: [
      { field: 'actorRole', operator: 'EQUALS', value: 'ANALYST' },
      { field: 'environment', operator: 'EQUALS', value: 'production' },
    ],
    any: [
      { field: 'action', operator: 'EQUALS', value: 'DATA_EXPORT' },
      { field: 'action', operator: 'EQUALS', value: 'SYSTEM_REBOOT' },
    ],
  };
  assert(
    GovernancePolicyEngine.evaluateConditions(compoundCond1, testContext) === true,
    'Compound conditions (ALL + ANY) evaluated successfully'
  );

  const compoundCondFail: GovernanceConditions = {
    all: [
      { field: 'actorRole', operator: 'EQUALS', value: 'ADMIN' }, // Fails
      { field: 'environment', operator: 'EQUALS', value: 'production' },
    ],
  };
  assert(
    GovernancePolicyEngine.evaluateConditions(compoundCondFail, testContext) === false,
    'Compound conditions fail immediately when one ALL condition fails'
  );

  // ---------------------------------------------------------------------------
  // DOMAIN 3: Precedence Resolution & Conflict Resolution
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 3: Precedence Order (DENY > REQUIRE_STEP_UP > REQUIRE_APPROVAL > ALLOW) ---');

  const basePolicy = {
    organizationId: orgAlpha,
    status: 'ACTIVE' as const,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    conditions: {
      all: [{ field: 'action', operator: 'EQUALS', value: 'PAYMENT_CAPTURE' }],
    } as GovernanceConditions,
  };

  const pAllow: GovernancePolicyRecord = {
    ...basePolicy,
    id: 'p_allow',
    name: 'Allow Policy',
    description: 'Allow rule',
    category: 'PAYMENT',
    priority: 10,
    effect: 'ALLOW',
  };

  const pApproval: GovernancePolicyRecord = {
    ...basePolicy,
    id: 'p_approval',
    name: 'Require Approval Policy',
    description: 'Approval rule',
    category: 'PAYMENT',
    priority: 20,
    effect: 'REQUIRE_APPROVAL',
  };

  const pStepUp: GovernancePolicyRecord = {
    ...basePolicy,
    id: 'p_stepup',
    name: 'Step-Up Policy',
    description: 'Step-up rule',
    category: 'PAYMENT',
    priority: 30,
    effect: 'REQUIRE_STEP_UP',
  };

  const pDeny: GovernancePolicyRecord = {
    ...basePolicy,
    id: 'p_deny',
    name: 'Deny Policy',
    description: 'Deny rule',
    category: 'PAYMENT',
    priority: 40,
    effect: 'DENY',
  };

  const paymentContext: GovernanceEvaluationContext = {
    organizationId: orgAlpha,
    actorId: 'usr_ops',
    actorType: 'USER',
    action: 'PAYMENT_CAPTURE',
    resourceType: 'PAYMENT',
    environment: 'production',
  };

  // Test 1: All 4 match -> DENY wins
  const decisionAll = GovernancePolicyEngine.evaluate(
    [pAllow, pApproval, pStepUp, pDeny],
    paymentContext
  );
  assert(decisionAll.effect === 'DENY', 'DENY wins when all 4 effects match');
  assert(decisionAll.allowed === false, 'Decision allowed is false on DENY');
  assert(decisionAll.conflicts.length === 3, 'Recorded 3 conflicts overridden by DENY');

  // Test 2: ALLOW, REQUIRE_APPROVAL, REQUIRE_STEP_UP -> REQUIRE_STEP_UP wins
  const decisionNoDeny = GovernancePolicyEngine.evaluate(
    [pAllow, pApproval, pStepUp],
    paymentContext
  );
  assert(decisionNoDeny.effect === 'REQUIRE_STEP_UP', 'REQUIRE_STEP_UP wins over APPROVAL and ALLOW');
  assert(decisionNoDeny.requiresStepUp === true, 'Decision requiresStepUp is true');

  // Test 3: ALLOW, REQUIRE_APPROVAL -> REQUIRE_APPROVAL wins
  const decisionApproval = GovernancePolicyEngine.evaluate(
    [pAllow, pApproval],
    paymentContext
  );
  assert(decisionApproval.effect === 'REQUIRE_APPROVAL', 'REQUIRE_APPROVAL wins over ALLOW');
  assert(decisionApproval.requiresApproval === true, 'Decision requiresApproval is true');

  // Test 4: Only ALLOW -> ALLOW wins
  const decisionAllow = GovernancePolicyEngine.evaluate([pAllow], paymentContext);
  assert(decisionAllow.effect === 'ALLOW', 'ALLOW wins when only ALLOW matches');
  assert(decisionAllow.allowed === true, 'Decision allowed is true');

  // ---------------------------------------------------------------------------
  // DOMAIN 4: Fail-Closed on Critical Admin Actions
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 4: Fail-Closed Critical Actions ---');

  for (const critAction of CRITICAL_ADMIN_ACTIONS) {
    assert(typeof critAction === 'string', `Critical admin action identified: ${critAction}`);
  }

  // Create an intentional error state during evaluation of a critical admin action
  const criticalContext: GovernanceEvaluationContext = {
    organizationId: orgAlpha,
    actorId: 'usr_attacker',
    actorType: 'USER',
    action: 'ORG_OWNER_TRANSFERRED', // Critical action
    resourceType: 'ORGANIZATION',
    isPrivilegedAdminAction: true,
  };

  // Malformed policy that triggers exception inside evaluate
  const malformedPolicy: any = {
    id: 'p_bad',
    organizationId: orgAlpha,
    status: 'ACTIVE',
    conditions: {
      get all(): any {
        throw new Error('Simulated runtime condition crash');
      },
    },
  };

  const failClosedDecision = GovernancePolicyEngine.evaluate([malformedPolicy], criticalContext);
  assert(failClosedDecision.effect === 'DENY', 'Fail-closed posture enforces DENY on critical admin action crash');
  assert(failClosedDecision.allowed === false, 'Access denied on critical admin action failure');
  assert(failClosedDecision.reason.includes('Fail-Closed'), 'Reason identifies Fail-Closed guard');

  // Non-critical action error fails safe
  const nonCriticalContext: GovernanceEvaluationContext = {
    organizationId: orgAlpha,
    actorId: 'usr_guest',
    actorType: 'USER',
    action: 'VIEW_DOCUMENTATION',
    resourceType: 'DOC',
    isPrivilegedAdminAction: false,
  };
  const failSafeDecision = GovernancePolicyEngine.evaluate([malformedPolicy], nonCriticalContext);
  assert(failSafeDecision.effect === 'ALLOW', 'Fail-safe posture enforces ALLOW on non-critical action crash');
  assert(failSafeDecision.allowed === true, 'Access allowed on non-critical failure with warning');

  // ---------------------------------------------------------------------------
  // DOMAIN 5: RBAC Primacy Invariant
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 5: RBAC Primacy Invariant ---');

  // Test: RBAC Denies, Governance Allows -> MUST DENY
  const rbacDeniedResult = GovernancePolicyEngine.composeRbacAndGovernance(false, decisionAllow);
  assert(rbacDeniedResult.allowed === false, 'RBAC DENY overrides Governance ALLOW');
  assert(
    rbacDeniedResult.reason.includes('RBAC'),
    'Reason correctly notes denial due to RBAC primacy'
  );

  // Test: RBAC Denies, Governance Requires Step-Up -> MUST DENY
  const rbacDeniedStepUp = GovernancePolicyEngine.composeRbacAndGovernance(false, decisionNoDeny);
  assert(rbacDeniedStepUp.allowed === false, 'RBAC DENY overrides Governance REQUIRE_STEP_UP');

  // Test: RBAC Allows, Governance Denies -> MUST DENY
  const rbacAllowedGovDenied = GovernancePolicyEngine.composeRbacAndGovernance(true, decisionAll);
  assert(rbacAllowedGovDenied.allowed === false, 'Governance DENY restricts RBAC ALLOW');

  // Test: RBAC Allows, Governance Allows -> ALLOW
  const rbacAllowedGovAllowed = GovernancePolicyEngine.composeRbacAndGovernance(true, decisionAllow);
  assert(rbacAllowedGovAllowed.allowed === true, 'Both RBAC and Governance allow -> ALLOW');

  // ---------------------------------------------------------------------------
  // DOMAIN 6: Simulation Mode & Non-Execution Invariant
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 6: Simulation Mode & Zero Side Effects ---');

  const auditCountBefore = IN_MEMORY_AUDIT_LEDGER.length;

  const simResult = await GovernancePolicyService.simulateEvaluation({
    organizationId: orgAlpha,
    context: {
      organizationId: orgAlpha,
      actorId: 'usr_sim_tester',
      actorType: 'USER',
      role: 'ADMIN',
      action: 'API_KEY_ROTATED',
      resourceType: 'API_KEY',
      environment: 'production',
      mfaAge: 10,
    },
  });

  const auditCountAfter = IN_MEMORY_AUDIT_LEDGER.length;
  assert(auditCountBefore === auditCountAfter, 'Simulation mode emitted ZERO audit ledger events');
  assert(typeof simResult.decision.effect === 'string', 'Simulation returned valid decision effect');
  assert(
    simResult.simulationDisclaimer.includes('simulation only'),
    'Simulation returns mandatory regulatory disclaimer'
  );

  // ---------------------------------------------------------------------------
  // DOMAIN 7: Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 7: Multi-Tenant Isolation ---');

  // Create policy in Org Beta
  const betaPolicy = await GovernancePolicyService.createPolicy({
    organizationId: orgBeta,
    name: 'Org Beta Strict Policy',
    description: 'Denies everything in Org Beta',
    category: 'SECURITY',
    status: 'ACTIVE',
    priority: 1,
    effect: 'DENY',
    conditions: {
      all: [{ field: 'environment', operator: 'EQUALS', value: 'production' }],
    },
    createdBy: 'usr_beta_admin',
  });

  // Query Org Alpha policies -> should NOT contain Beta's policy
  const alphaPolicies = await GovernancePolicyService.listPolicies({ organizationId: orgAlpha });
  assert(
    !alphaPolicies.some(p => p.id === betaPolicy.id),
    'Org Alpha policy list does NOT contain Org Beta policy'
  );

  // Cross-tenant getPolicy check
  const crossTenantGet = await GovernancePolicyService.getPolicy(betaPolicy.id, orgAlpha);
  assert(crossTenantGet === null, 'Cross-tenant getPolicy returns null');

  // Cross-tenant update check
  let crossTenantUpdateError = false;
  try {
    await GovernancePolicyService.updatePolicy({
      policyId: betaPolicy.id,
      organizationId: orgAlpha,
      updatedBy: 'attacker',
    });
  } catch {
    crossTenantUpdateError = true;
  }
  assert(crossTenantUpdateError, 'Cross-tenant update policy threw unauthorized exception');

  // ---------------------------------------------------------------------------
  // DOMAIN 8: Adversarial & Security Robustness
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 8: Adversarial & Security Robustness ---');

  // 1. Prototype pollution attempt in condition field
  const protoCondition: any = {
    field: '__proto__',
    operator: 'EQUALS',
    value: 'polluted',
  };
  const protoResult = GovernancePolicyEngine.evaluateSimpleCondition(protoCondition, testContext);
  assert(protoResult === false, 'Prototype pollution condition safely evaluates to false');
  assert(({} as any).polluted === undefined, 'Global prototype was NOT polluted');

  // 2. Maximum condition limit per policy (> 25 conditions skipped to guard against ReDoS/DoS)
  const excessiveConditions: any[] = [];
  for (let i = 0; i < 30; i++) {
    excessiveConditions.push({
      field: 'actorRole',
      operator: 'EQUALS',
      value: `ROLE_${i}`,
    });
  }

  const excessivePolicy: GovernancePolicyRecord = {
    ...basePolicy,
    id: 'p_excessive',
    name: 'Excessive Policy',
    description: 'Has 30 conditions',
    category: 'SECURITY',
    priority: 1,
    effect: 'DENY',
    conditions: { all: excessiveConditions },
  };

  const evalExcessive = GovernancePolicyEngine.evaluate([excessivePolicy], testContext);
  assert(
    !evalExcessive.matchedPolicies.some(m => m.id === 'p_excessive'),
    'Policy exceeding maximum 25 condition limit is safely skipped'
  );

  // 3. Null / undefined / empty AST handling
  assert(
    GovernancePolicyEngine.evaluateConditions(null as any, testContext) === false,
    'Null conditions safely return false'
  );
  assert(
    GovernancePolicyEngine.evaluateSimpleCondition(undefined as any, testContext) === false,
    'Undefined simple condition safely returns false'
  );

  // ---------------------------------------------------------------------------
  // DOMAIN 9: Performance Benchmark (100 Policies Evaluation)
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 9: Performance Benchmark (100 Policies) ---');

  const benchmarkPolicies: GovernancePolicyRecord[] = [];
  for (let i = 0; i < 100; i++) {
    benchmarkPolicies.push({
      id: `p_bench_${i}`,
      organizationId: 'org_benchmark',
      name: `Benchmark Policy #${i}`,
      description: `Evaluates condition ruleset #${i}`,
      category: 'SECURITY',
      status: 'ACTIVE',
      priority: i + 1,
      effect: i === 99 ? 'REQUIRE_STEP_UP' : 'ALLOW',
      conditions: {
        all: [
          { field: 'environment', operator: 'EQUALS', value: 'production' },
          { field: 'mfaAge', operator: 'GREATER_THAN', value: 300 },
        ],
        any: [
          { field: 'action', operator: 'EQUALS', value: `ACTION_${i}` },
          { field: 'action', operator: 'EQUALS', value: 'BENCHMARK_ACTION' },
        ],
      },
      version: 1,
      createdBy: 'benchmarker',
      updatedBy: 'benchmarker',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const benchContext: GovernanceEvaluationContext = {
    organizationId: 'org_benchmark',
    actorId: 'usr_bench',
    actorType: 'USER',
    action: 'BENCHMARK_ACTION',
    resourceType: 'BENCH_RESOURCE',
    environment: 'production',
    mfaAge: 500,
  };

  const ITERATIONS = 1000;
  const startBench = Date.now();
  for (let i = 0; i < ITERATIONS; i++) {
    GovernancePolicyEngine.evaluate(benchmarkPolicies, benchContext);
  }
  const endBench = Date.now();
  const totalElapsedMs = endBench - startBench;
  const avgLatencyUs = (totalElapsedMs / ITERATIONS) * 1000; // microseconds

  console.log(`  Evaluated ${ITERATIONS} runs across 100 policies in ${totalElapsedMs}ms`);
  console.log(`  Average latency per 100-policy evaluation: ${(totalElapsedMs / ITERATIONS).toFixed(3)}ms (${avgLatencyUs.toFixed(1)} µs)`);

  assert(
    totalElapsedMs / ITERATIONS < 5,
    `100-policy evaluation latency under 5ms (Actual: ${(totalElapsedMs / ITERATIONS).toFixed(3)}ms)`
  );

  console.log('\n================================================================');
  console.log('✅ ALL PHASE 8.7.4 GOVERNANCE ENGINE TESTS PASSED (100% SUCCESS)');
  console.log('================================================================\n');
}

runPhase874Tests().catch(err => {
  console.error('Fatal error in Phase 8.7.4 test suite:', err);
  process.exit(1);
});

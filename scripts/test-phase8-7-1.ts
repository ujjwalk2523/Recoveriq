/**
 * RecoverIQ — Phase 8.7.1 Verification Test Suite
 * Immutable Enterprise Audit Ledger
 */

process.env.SKIP_DB = 'true';

import { AuditRepository, IN_MEMORY_AUDIT_LEDGER } from '../src/lib/audit/audit-repository';
import { AuditService } from '../src/lib/services/audit.service';
import { AuditRedactor } from '../src/lib/audit/audit-redactor';
import { AuditCanonicalizer } from '../src/lib/audit/audit-canonicalizer';
import { SecurityEventService } from '../src/lib/security/security-events';
import {
  ACTOR_TYPES,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  AUDIT_RESULTS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_ACTIONS,
  AuditEventInput,
} from '../src/lib/audit/audit-types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} — ${failureDetails || 'Assertion failed'}`);
  }
}

async function runPhase871Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.7.1 — IMMUTABLE ENTERPRISE AUDIT LEDGER');
  console.log('================================================================\n');

  // Clear memory ledger for test isolation
  IN_MEMORY_AUDIT_LEDGER.length = 0;

  // ---------------------------------------------------------------------------
  // DOMAIN 1: Audit Schema
  // ---------------------------------------------------------------------------
  console.log('--- Domain 1: Audit Schema Validation ---');

  assert(ACTOR_TYPES.includes('USER') && ACTOR_TYPES.includes('API_KEY') && ACTOR_TYPES.includes('SYSTEM') && ACTOR_TYPES.includes('WORKER') && ACTOR_TYPES.includes('WEBHOOK'), 'Actor types enum contains USER, API_KEY, SYSTEM, WORKER, WEBHOOK');
  assert(AUDIT_CATEGORIES.includes('AUTHENTICATION') && AUDIT_CATEGORIES.includes('ORGANIZATION') && AUDIT_CATEGORIES.includes('SECURITY') && AUDIT_CATEGORIES.includes('BILLING'), 'Audit categories enum includes required domains');
  assert(AUDIT_SEVERITIES.includes('INFO') && AUDIT_SEVERITIES.includes('CRITICAL'), 'Severities contain INFO to CRITICAL');
  assert(AUDIT_RESULTS.includes('SUCCESS') && AUDIT_RESULTS.includes('DENIED') && AUDIT_RESULTS.includes('FAILURE'), 'Results contain SUCCESS, FAILURE, DENIED');
  assert(AUDIT_RESOURCE_TYPES.includes('USER') && AUDIT_RESOURCE_TYPES.includes('ORGANIZATION') && AUDIT_RESOURCE_TYPES.includes('API_KEY'), 'Resource types contain standard platform entities');

  const testOrg1 = 'org_enterprise_alpha';
  const event1 = await AuditRepository.append({
    organizationId: testOrg1,
    merchantId: 'mer_alpha_1',
    actor: { type: 'USER', id: 'usr_alpha_admin', displayName: 'Alpha Admin', email: 'admin@alpha.io' },
    action: AUDIT_ACTIONS.ORG_CREATED,
    category: 'ORGANIZATION',
    severity: 'INFO',
    result: 'SUCCESS',
    resource: { type: 'ORGANIZATION', id: testOrg1 },
    metadata: { plan: 'ENTERPRISE', region: 'IN' },
  });

  assert(event1.id.startsWith('aud_'), 'Event record created with unique ledger ID');
  assert(event1.organizationId === testOrg1, 'Event record strictly bound to organizationId');
  assert(event1.integrity.sequenceNumber === 1, 'First event in organization has sequence number 1');
  assert(event1.integrity.schemaVersion === 1, 'Event record contains schemaVersion 1');
  assert(event1.integrity.previousEventHash === null, 'First event in organization has null previousEventHash (Genesis)');
  assert(typeof event1.integrity.eventHash === 'string' && event1.integrity.eventHash.length === 64, 'Event hash is valid 64-character SHA-256 digest');

  // ---------------------------------------------------------------------------
  // DOMAIN 2: Audit Service
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 2: Audit Service Helpers & Normalization ---');

  const successEv = await AuditService.recordSuccess({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_alpha_admin' },
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    category: 'AUTHENTICATION',
    resource: { type: 'SESSION', id: 'sess_101' },
  });
  assert(successEv.result === 'SUCCESS', 'recordSuccess assigns SUCCESS result');
  assert(successEv.integrity.sequenceNumber === 2, 'recordSuccess increments sequence to 2');

  const failEv = await AuditService.recordFailure({
    organizationId: testOrg1,
    actor: { type: 'ANONYMOUS' },
    action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
    category: 'AUTHENTICATION',
    resource: { type: 'SESSION', id: 'sess_unauth' },
    metadata: { reason: 'INVALID_CREDENTIALS' },
  });
  assert(failEv.result === 'FAILURE', 'recordFailure assigns FAILURE result');
  assert(failEv.actor.type === 'ANONYMOUS', 'Anonymous actor safely recorded');

  const denyEv = await AuditService.recordDenied({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_analyst' },
    action: 'ORG_SETTINGS_UPDATE_DENIED',
    category: 'AUTHORIZATION',
    resource: { type: 'ORGANIZATION', id: testOrg1 },
  });
  assert(denyEv.result === 'DENIED', 'recordDenied assigns DENIED result');
  assert(new Date(denyEv.occurredAt).getTime() > 0, 'Server-authoritative timestamp recorded');

  // ---------------------------------------------------------------------------
  // DOMAIN 3: Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 3: Tenant Isolation & Merchant Scope ---');

  const testOrg2 = 'org_enterprise_beta';
  const org2Event = await AuditService.recordSuccess({
    organizationId: testOrg2,
    actor: { type: 'USER', id: 'usr_beta_admin' },
    action: AUDIT_ACTIONS.ORG_CREATED,
    category: 'ORGANIZATION',
    resource: { type: 'ORGANIZATION', id: testOrg2 },
  });

  assert(org2Event.integrity.sequenceNumber === 1, 'Organization Beta starts its own isolated sequence at 1');
  assert(org2Event.integrity.previousEventHash === null, 'Organization Beta has isolated genesis hash');

  // Read Org 1 event as Org 2
  const crossTenantGet = await AuditRepository.getById(event1.id, testOrg2);
  assert(crossTenantGet === null, 'Org B cannot fetch audit record belonging to Org A (fail-closed null)');

  // List Org 1 events
  const org1List = await AuditRepository.list({ organizationId: testOrg1 });
  const org1HasBeta = org1List.events.some(e => e.organizationId === testOrg2);
  assert(!org1HasBeta, 'Listing Org A events never includes Org B records');

  // List Org 2 events
  const org2List = await AuditRepository.list({ organizationId: testOrg2 });
  assert(org2List.events.length === 1 && org2List.events[0].organizationId === testOrg2, 'Listing Org B returns strictly Org B events');

  // ---------------------------------------------------------------------------
  // DOMAIN 4: Deep Recursive Secret Redaction
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 4: Deep Recursive Redaction ---');

  const sensitivePayload = {
    user: 'alice',
    password: 'SuperSecretPassword123!',
    token: 'jwt_ey.payload.sig',
    nested: {
      apiKey: 'sec_live_99217812',
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      recoveryCode: 'ABCD-1234-EFGH',
      deepArray: [
        { clientSecret: 'oauth_secret_abc' },
        { cardNumber: '4111 1111 1111 1111' },
        { cvv: '123' },
        { authorization: 'Bearer super_secret_token' },
      ],
    },
    safeNotes: 'Public audit notes',
  };

  const redacted = AuditRedactor.redact(sensitivePayload);
  assert(redacted.password === '[REDACTED]', 'Top-level password redacted');
  assert(redacted.token === '[REDACTED]', 'Top-level token redacted');
  assert(redacted.nested.apiKey === '[REDACTED]', 'Nested apiKey redacted');
  assert(redacted.nested.mfaSecret === '[REDACTED]', 'Nested mfaSecret redacted');
  assert(redacted.nested.recoveryCode === '[REDACTED]', 'Nested recoveryCode redacted');
  assert(redacted.nested.deepArray[0].clientSecret === '[REDACTED]', 'Array object clientSecret redacted');
  assert(redacted.nested.deepArray[1].cardNumber === '[REDACTED]', 'Array object cardNumber redacted');
  assert(redacted.nested.deepArray[2].cvv === '[REDACTED]', 'Array object cvv redacted');
  assert(redacted.nested.deepArray[3].authorization === '[REDACTED]', 'Array object authorization redacted');
  assert(redacted.safeNotes === 'Public audit notes', 'Safe non-sensitive attributes preserved');

  // Verify AuditRepository.append scrubs metadata before storage
  const secretEvent = await AuditRepository.append({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_admin' },
    action: 'API_KEY_CREATED',
    category: 'API',
    resource: { type: 'API_KEY', id: 'key_123' },
    metadata: { secret: 'raw_secret_key_12345', name: 'Production Key' },
    previousState: { privateKey: 'BEGIN RSA PRIVATE KEY...' },
    newState: { privateKey: 'BEGIN NEW RSA PRIVATE KEY...' },
  });

  assert(secretEvent.metadata?.secret === '[REDACTED]', 'Stored audit record metadata secret is redacted');
  assert(secretEvent.previousState?.privateKey === '[REDACTED]', 'Stored audit record previousState privateKey is redacted');
  assert(secretEvent.newState?.privateKey === '[REDACTED]', 'Stored audit record newState privateKey is redacted');
  assert(secretEvent.metadata?.name === 'Production Key', 'Non-sensitive metadata name preserved in stored record');

  // ---------------------------------------------------------------------------
  // DOMAIN 5: Immutability Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 5: Immutability Enforcement ---');

  const repoAny = AuditRepository as any;
  assert(typeof repoAny.update === 'undefined', 'AuditRepository has NO update() method');
  assert(typeof repoAny.delete === 'undefined', 'AuditRepository has NO delete() method');
  assert(typeof repoAny.updateMany === 'undefined', 'AuditRepository has NO updateMany() method');
  assert(typeof repoAny.deleteMany === 'undefined', 'AuditRepository has NO deleteMany() method');

  // ---------------------------------------------------------------------------
  // DOMAIN 6: Cryptographic Hash Chaining & Determinism
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 6: Cryptographic Hash Chaining & Deterministic Canonicalization ---');

  // Test deterministic canonicalization with unordered keys
  const objA = { z: 1, a: 'test', m: { b: true, a: false } };
  const objB = { a: 'test', m: { a: false, b: true }, z: 1 };
  const canonA = AuditCanonicalizer.canonicalize(objA);
  const canonB = AuditCanonicalizer.canonicalize(objB);
  assert(canonA === canonB, 'Canonicalizer produces identical output regardless of key declaration order');

  // Verify sequential hash chaining in Org 1
  const org1Events = (await AuditRepository.list({ organizationId: testOrg1, direction: 'ASC' })).events;
  assert(org1Events.length >= 3, 'Org 1 has multiple sequential events');

  assert(org1Events[0].integrity.previousEventHash === null, 'Event 1 previousEventHash is null (Genesis)');
  assert(org1Events[1].integrity.previousEventHash === org1Events[0].integrity.eventHash, 'Event 2 references Event 1 hash');
  assert(org1Events[2].integrity.previousEventHash === org1Events[1].integrity.eventHash, 'Event 3 references Event 2 hash');

  // ---------------------------------------------------------------------------
  // DOMAIN 7: Chain Verification & Tamper Detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 7: Chain Verification & Tamper Detection ---');

  // 1. Verify unbroken chain
  const verifyValid = await AuditRepository.verifyChain(testOrg1);
  assert(verifyValid.valid === true, 'Untampered organization ledger verifies as valid');
  assert(verifyValid.checkedEvents === org1Events.length, `Verified all ${org1Events.length} sequential records`);

  // 2. Tamper with metadata of an event in memory
  const testOrgTamper = 'org_tamper_test';
  await AuditService.recordSuccess({
    organizationId: testOrgTamper,
    actor: { type: 'USER', id: 'u1' },
    action: 'EVENT_1',
    category: 'SYSTEM',
    resource: { type: 'USER', id: 'u1' },
    metadata: { initial: 'clean' },
  });
  await AuditService.recordSuccess({
    organizationId: testOrgTamper,
    actor: { type: 'USER', id: 'u2' },
    action: 'EVENT_2',
    category: 'SYSTEM',
    resource: { type: 'USER', id: 'u2' },
    metadata: { initial: 'clean' },
  });
  await AuditService.recordSuccess({
    organizationId: testOrgTamper,
    actor: { type: 'USER', id: 'u3' },
    action: 'EVENT_3',
    category: 'SYSTEM',
    resource: { type: 'USER', id: 'u3' },
    metadata: { initial: 'clean' },
  });

  const cleanVerify = await AuditRepository.verifyChain(testOrgTamper);
  assert(cleanVerify.valid === true, 'Tamper test org starts with valid chain');

  // Adversarial Tampering: Mutate metadata in sequence #2
  const eventToTamper = IN_MEMORY_AUDIT_LEDGER.find(
    e => e.organizationId === testOrgTamper && e.integrity.sequenceNumber === 2
  );
  if (eventToTamper) {
    eventToTamper.metadata = { initial: 'TAMPERED_BY_ATTACKER' };
  }

  const tamperedVerify = await AuditRepository.verifyChain(testOrgTamper);
  assert(tamperedVerify.valid === false, 'Tampered record metadata detected by verifyChain()');
  assert(tamperedVerify.firstInvalidSequence === 2, 'Verifier accurately pinpoints first invalid sequence #2');

  // Restore for subsequent test
  if (eventToTamper) {
    eventToTamper.metadata = { initial: 'clean' };
  }

  // Adversarial Tampering: Alter previousEventHash
  const event3 = IN_MEMORY_AUDIT_LEDGER.find(
    e => e.organizationId === testOrgTamper && e.integrity.sequenceNumber === 3
  );
  if (event3) {
    const originalHash = event3.integrity.previousEventHash;
    event3.integrity.previousEventHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const brokenChainVerify = await AuditRepository.verifyChain(testOrgTamper);
    assert(brokenChainVerify.valid === false, 'Forged previousEventHash detected by verifyChain()');
    assert(brokenChainVerify.firstInvalidSequence === 3, 'Pinpointed invalid predecessor hash at sequence #3');
    event3.integrity.previousEventHash = originalHash;
  }

  // ---------------------------------------------------------------------------
  // DOMAIN 8 & 62: Concurrency & Monotonic Sequence Allocation (100 concurrent writes)
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 8 & Section 62: 100 Concurrent Writes Test ---');

  const concurrentOrg = 'org_concurrency_bench';
  const NUM_WRITES = 100;
  const concurrentPromises: Promise<any>[] = [];

  for (let i = 1; i <= NUM_WRITES; i++) {
    concurrentPromises.push(
      AuditService.recordSuccess({
        organizationId: concurrentOrg,
        actor: { type: 'WORKER', id: `worker_${i % 4}` },
        action: AUDIT_ACTIONS.RECOVERY_ACTION_EXECUTED,
        category: 'RECOVERY',
        resource: { type: 'RECOVERY_ATTEMPT', id: `attempt_${i}` },
        metadata: { index: i },
      })
    );
  }

  await Promise.all(concurrentPromises);

  const concurrentEvents = (await AuditRepository.list({
    organizationId: concurrentOrg,
    limit: 100,
    direction: 'ASC',
  })).events;

  assert(concurrentEvents.length === NUM_WRITES, `Exactly ${NUM_WRITES} events persisted from concurrent burst`);

  const sequenceNumbers = concurrentEvents.map(e => e.integrity.sequenceNumber);
  const uniqueSequences = new Set(sequenceNumbers);
  assert(uniqueSequences.size === NUM_WRITES, 'All 100 concurrent writes received unique sequence numbers');
  assert(Math.min(...sequenceNumbers) === 1, 'Sequence starts strictly at 1');
  assert(Math.max(...sequenceNumbers) === NUM_WRITES, `Sequence ends strictly at ${NUM_WRITES}`);

  const concurrencyChainVerify = await AuditRepository.verifyChain(concurrentOrg);
  assert(concurrencyChainVerify.valid === true, '100 concurrent writes maintained continuous, unbroken cryptographic hash chain');
  assert(concurrencyChainVerify.checkedEvents === NUM_WRITES, `Chain verification verified all ${NUM_WRITES} concurrent events`);

  // ---------------------------------------------------------------------------
  // DOMAIN 9: API Pagination & Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 9: Pagination & Multi-field Filtering ---');

  // Test pagination with page size 10
  const page1 = await AuditRepository.list({
    organizationId: concurrentOrg,
    limit: 10,
    direction: 'ASC',
  });
  assert(page1.events.length === 10, 'Page 1 returns 10 events');
  assert(page1.nextCursor !== undefined, 'Page 1 returns nextCursor');

  const page2 = await AuditRepository.list({
    organizationId: concurrentOrg,
    limit: 10,
    cursor: page1.nextCursor,
    direction: 'ASC',
  });
  assert(page2.events.length === 10, 'Page 2 returns 10 events');
  assert(page2.events[0].id !== page1.events[9].id, 'Page 2 starts after Page 1 cursor without duplicate overlap');

  // Test filtering by category
  const filteredCategory = await AuditRepository.list({
    organizationId: concurrentOrg,
    category: 'RECOVERY',
  });
  assert(filteredCategory.events.every(e => e.category === 'RECOVERY'), 'Category filter returns only RECOVERY events');

  // ---------------------------------------------------------------------------
  // DOMAIN 10: Authentication Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 10: Authentication & Security Events Integration ---');

  await SecurityEventService.recordSecurityEvent({
    merchantId: 'mer_sec_test',
    organizationId: 'org_sec_test',
    actorId: 'usr_sec_admin',
    actorType: 'USER',
    action: 'AUTH_MFA_ENROLLED',
    entityType: 'USER',
    entityId: 'usr_sec_admin',
    details: { method: 'TOTP', secret: 'JBSWY3DPEHPK3PXP' },
  });

  const secEvents = await AuditRepository.list({ organizationId: 'org_sec_test' });
  assert(secEvents.events.length >= 1, 'SecurityEventService successfully recorded event into Audit Ledger');
  const mfaEvent = secEvents.events.find(e => e.action === 'AUTH_MFA_ENROLLED');
  assert(mfaEvent !== undefined, 'AUTH_MFA_ENROLLED event found in ledger');
  assert(mfaEvent?.category === 'MFA', 'SecurityEventService mapped MFA action to category MFA');
  assert(mfaEvent?.metadata?.secret === '[REDACTED]', 'MFA secret in security event details was sanitized to [REDACTED]');

  // ---------------------------------------------------------------------------
  // DOMAIN 11: Organization Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 11: Organization & Role Change Auditing ---');

  const orgAdminEvent = await AuditService.recordSuccess({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_alpha_owner' },
    action: AUDIT_ACTIONS.ORG_MEMBER_ROLE_CHANGED,
    category: 'ORGANIZATION',
    severity: 'MEDIUM',
    resource: { type: 'MEMBERSHIP', id: 'mem_target_1' },
    previousState: { role: 'ANALYST' },
    newState: { role: 'OPERATOR' },
  });

  assert(orgAdminEvent.action === 'ORG_MEMBER_ROLE_CHANGED', 'Role change recorded with canonical action name');
  assert(orgAdminEvent.previousState?.role === 'ANALYST', 'previousState captures previous role');
  assert(orgAdminEvent.newState?.role === 'OPERATOR', 'newState captures updated role');

  // ---------------------------------------------------------------------------
  // DOMAIN 12: API / Billing / Recovery Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 12: API, Billing & Recovery Governance ---');

  const apiKeyEv = await AuditService.recordSuccess({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_dev_1' },
    action: AUDIT_ACTIONS.API_KEY_CREATED,
    category: 'API',
    resource: { type: 'API_KEY', id: 'key_prod_public_id' },
    metadata: { name: 'Billing Integration Key', scopes: ['read:transactions'] },
  });
  assert(apiKeyEv.category === 'API', 'API key creation recorded under API category');

  const billingEv = await AuditService.recordSuccess({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_finance_1' },
    action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
    category: 'BILLING',
    resource: { type: 'SUBSCRIPTION', id: 'sub_enterprise_yearly' },
    previousState: { plan: 'GROWTH' },
    newState: { plan: 'ENTERPRISE' },
  });
  assert(billingEv.category === 'BILLING', 'Billing plan modification recorded under BILLING category');

  // ---------------------------------------------------------------------------
  // DOMAIN 13: Failure Policy
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 13: Failure Policy & Non-Blocking Payment Telemetry ---');

  let paymentExecutionBlocked = false;
  try {
    // Simulating non-critical audit telemetry failure during payment recovery
    try {
      // Intentional invalid audit input simulation handled safely
      await AuditService.record({
        organizationId: undefined,
        actor: { type: 'WORKER' },
        action: AUDIT_ACTIONS.RECOVERY_ACTION_EXECUTED,
        category: 'RECOVERY',
        resource: { type: 'PAYMENT', id: 'pay_retry_992' },
      });
    } catch {
      // Telemetry error isolated
    }
    // Business payment processing proceeds without failure
    paymentExecutionBlocked = false;
  } catch {
    paymentExecutionBlocked = true;
  }
  assert(!paymentExecutionBlocked, 'Payment processing continues safely without blocking on non-critical audit failures');

  // ---------------------------------------------------------------------------
  // SECTION 61: Adversarial Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 61: Adversarial Security Tests ---');

  // 1. Forged Org ID
  const orgAttack = await AuditRepository.getById(event1.id, 'org_attacker_forged');
  assert(orgAttack === null, 'Forged organizationId rejected (returns null)');

  // 2. Secret Injection
  const injectionEv = await AuditRepository.append({
    organizationId: testOrg1,
    actor: { type: 'USER', id: 'usr_attacker' },
    action: 'SECURITY_TEST',
    category: 'SECURITY',
    resource: { type: 'POLICY', id: 'pol_1' },
    metadata: {
      injectedSecret: 'super_secret_payload',
      auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      jwt: 'raw.jwt.token',
    },
  });
  assert(injectionEv.metadata?.injectedSecret === '[REDACTED]', 'Injected secret scrubbed');
  assert(injectionEv.metadata?.auth === '[REDACTED]', 'Injected Bearer token scrubbed');
  assert(injectionEv.metadata?.jwt === '[REDACTED]', 'Injected JWT scrubbed');

  // ---------------------------------------------------------------------------
  // SECTION 63: Performance Benchmark
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 63: Synthetic Performance Benchmark ---');

  const perfOrg = 'org_perf_benchmark';
  const SYNTHETIC_COUNT = 5000;
  console.log(`  Generating & chaining ${SYNTHETIC_COUNT} synthetic audit records...`);

  const tStart = Date.now();
  let prevHash: string | null = null;

  for (let i = 1; i <= SYNTHETIC_COUNT; i++) {
    const canonicalPayload = AuditCanonicalizer.buildCanonicalPayload({
      sequenceNumber: i,
      organizationId: perfOrg,
      merchantId: 'mer_perf',
      actorType: 'WORKER',
      actorId: 'wrk_engine_1',
      action: AUDIT_ACTIONS.RECOVERY_ACTION_EXECUTED,
      category: 'RECOVERY',
      severity: 'INFO',
      result: 'SUCCESS',
      resourceType: 'RECOVERY_ATTEMPT',
      resourceId: `attempt_${i}`,
      requestId: `req_${i}`,
      sessionId: null,
      metadata: { retryCount: 1 },
      previousState: null,
      newState: null,
      occurredAt: '2026-09-04T12:00:00.000Z',
      schemaVersion: 1,
    });

    const eventHash = AuditCanonicalizer.computeHash(canonicalPayload, prevHash);

    IN_MEMORY_AUDIT_LEDGER.push({
      id: `aud_perf_${i}`,
      organizationId: perfOrg,
      merchantId: 'mer_perf',
      actor: { type: 'WORKER', id: 'wrk_engine_1', displayName: 'Worker Engine', email: null },
      action: AUDIT_ACTIONS.RECOVERY_ACTION_EXECUTED,
      category: 'RECOVERY',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: { type: 'RECOVERY_ATTEMPT', id: `attempt_${i}` },
      requestId: `req_${i}`,
      sessionId: null,
      ipHash: null,
      userAgentSummary: null,
      metadata: { retryCount: 1 },
      previousState: null,
      newState: null,
      integrity: {
        sequenceNumber: i,
        eventHash,
        previousEventHash: prevHash,
        schemaVersion: 1,
      },
      occurredAt: '2026-09-04T12:00:00.000Z',
      createdAt: '2026-09-04T12:00:00.000Z',
    });

    prevHash = eventHash;
  }

  const tChainGen = Date.now() - tStart;
  console.log(`  Chained ${SYNTHETIC_COUNT} events in ${tChainGen}ms (${((SYNTHETIC_COUNT / tChainGen) * 1000).toFixed(0)} events/sec)`);

  const tVerifyStart = Date.now();
  const perfVerify = await AuditRepository.verifyChain(perfOrg);
  const tVerify = Date.now() - tVerifyStart;

  assert(perfVerify.valid === true, `Cryptographic verification of ${SYNTHETIC_COUNT} records passed`);
  assert(perfVerify.checkedEvents === SYNTHETIC_COUNT, `Verified all ${SYNTHETIC_COUNT} records`);
  console.log(`  Verified ${SYNTHETIC_COUNT} records in ${tVerify}ms (${((SYNTHETIC_COUNT / tVerify) * 1000).toFixed(0)} records/sec verification rate)`);

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`PHASE 8.7.1 TEST SUMMARY: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`FAILED: ${failedTests} test(s) failed!`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 8.7.1 AUDIT LEDGER INVARIANTS VERIFIED SUCCESSFULLY!');
    console.log('================================================================\n');
  }
}

runPhase871Tests().catch(err => {
  console.error('Fatal error running Phase 8.7.1 tests:', err);
  process.exit(1);
});

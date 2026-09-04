/**
 * RecoverIQ — Phase 8.7.2 Verification Test Suite
 * Enterprise Audit Analytics & Investigation Intelligence
 */

process.env.SKIP_DB = 'true';

import { AuditAnalyticsService } from '../src/lib/audit/audit-analytics-service';
import { AuditAnomalyEngine } from '../src/lib/audit/audit-anomaly-engine';
import { AuditRepository, IN_MEMORY_AUDIT_LEDGER } from '../src/lib/audit/audit-repository';
import { AuditService } from '../src/lib/services/audit.service';
import { AUDIT_ACTIONS, AuditEventRecord } from '../src/lib/audit/audit-types';

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

async function runPhase872Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.7.2 — AUDIT ANALYTICS & INVESTIGATION SUITE');
  console.log('================================================================\n');

  // Reset memory ledger
  IN_MEMORY_AUDIT_LEDGER.length = 0;

  const orgA = 'org_analytics_alpha';
  const orgB = 'org_analytics_beta';

  // ---------------------------------------------------------------------------
  // DOMAIN 1: Time Windows & Range Resolution
  // ---------------------------------------------------------------------------
  console.log('--- Domain 1: Time Windows & Boundary Resolution ---');

  const now = Date.now();
  const w24h = AuditAnalyticsService.resolveTimeRange({ window: 'LAST_24_HOURS' });
  assert(w24h.window === 'LAST_24_HOURS', 'Resolved LAST_24_HOURS window');
  assert(now - w24h.startDate.getTime() >= 23 * 3600000, '24-hour window starts approx 24h ago');

  const w7d = AuditAnalyticsService.resolveTimeRange({ window: 'LAST_7_DAYS' });
  assert(w7d.window === 'LAST_7_DAYS', 'Resolved LAST_7_DAYS window');

  const w30d = AuditAnalyticsService.resolveTimeRange({ window: 'LAST_30_DAYS' });
  assert(w30d.window === 'LAST_30_DAYS', 'Resolved LAST_30_DAYS window');

  const w90d = AuditAnalyticsService.resolveTimeRange({ window: 'LAST_90_DAYS' });
  assert(w90d.window === 'LAST_90_DAYS', 'Resolved LAST_90_DAYS window');

  const customRange = AuditAnalyticsService.resolveTimeRange({
    window: 'CUSTOM',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-01-15T00:00:00Z'),
  });
  assert(customRange.window === 'CUSTOM', 'Resolved valid CUSTOM window');

  let invalidOrderCaught = false;
  try {
    AuditAnalyticsService.resolveTimeRange({
      window: 'CUSTOM',
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-01-01T00:00:00Z'),
    });
  } catch (err: any) {
    invalidOrderCaught = err.code === 'INVALID_TIME_ORDER';
  }
  assert(invalidOrderCaught, 'Rejects custom range where startDate >= endDate');

  let tooLargeCaught = false;
  try {
    AuditAnalyticsService.resolveTimeRange({
      window: 'CUSTOM',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2026-01-01T00:00:00Z'),
    });
  } catch (err: any) {
    tooLargeCaught = err.code === 'TIME_RANGE_TOO_LARGE';
  }
  assert(tooLargeCaught, 'Rejects custom range exceeding maximum 180 days');

  // ---------------------------------------------------------------------------
  // SEED SAMPLE AUDIT DATA FOR ORG A & ORG B
  // ---------------------------------------------------------------------------
  console.log('\n--- Seeding Initial Enterprise Audit Data ---');

  // Org A: 20 historical baseline events over past 10 days
  for (let i = 1; i <= 20; i++) {
    const time = new Date(now - (10 - (i % 8)) * 24 * 3600000 - i * 1800000);
    await AuditRepository.append({
      organizationId: orgA,
      actor: { type: 'USER', id: `usr_agent_${i % 3}`, displayName: `Agent ${i % 3}` },
      action: i % 2 === 0 ? AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS : AUDIT_ACTIONS.RECOVERY_ACTION_EXECUTED,
      category: i % 2 === 0 ? 'AUTHENTICATION' : 'RECOVERY',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: { type: 'TRANSACTION', id: `txn_${i}` },
      requestId: `req_hist_${i}`,
      sessionId: `sess_${i % 2}`,
      metadata: { initial: true, note: 'Normal traffic' },
      occurredAt: time,
    });
  }

  // Org A: Recent sensitive/denied operations in past 1 hour
  for (let i = 1; i <= 6; i++) {
    const recentTime = new Date(now - i * 300000); // within last 30 mins
    await AuditRepository.append({
      organizationId: orgA,
      actor: { type: 'USER', id: 'usr_bad_actor', displayName: 'Suspicious Actor' },
      action: 'ORG_SETTINGS_UPDATE',
      category: 'AUTHORIZATION',
      severity: 'HIGH',
      result: 'DENIED',
      resource: { type: 'ORGANIZATION', id: orgA },
      requestId: 'req_burst_denial',
      sessionId: 'sess_bad_actor',
      occurredAt: recentTime,
    });
  }

  // Org A: Authentication failures
  for (let i = 1; i <= 6; i++) {
    const recentTime = new Date(now - i * 200000);
    await AuditRepository.append({
      organizationId: orgA,
      actor: { type: 'ANONYMOUS' },
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      category: 'AUTHENTICATION',
      severity: 'LOW',
      result: 'FAILURE',
      resource: { type: 'SESSION', id: `sess_failed_${i}` },
      requestId: `req_spray_${i}`,
      occurredAt: recentTime,
    });
  }

  // Org B: 5 isolated events for tenant testing
  for (let i = 1; i <= 5; i++) {
    await AuditRepository.append({
      organizationId: orgB,
      actor: { type: 'USER', id: 'usr_beta_member', displayName: 'Beta Member' },
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      category: 'AUTHENTICATION',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: { type: 'ORGANIZATION', id: orgB },
      requestId: `req_beta_${i}`,
    });
  }

  // ---------------------------------------------------------------------------
  // DOMAIN 2: Activity Analytics & Summaries
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 2: Activity Analytics & Aggregations ---');

  const summaryRes = await AuditAnalyticsService.getActivitySummary({
    organizationId: orgA,
    filter: { window: 'LAST_30_DAYS' },
  });

  assert(summaryRes.summary.totalEvents === 32, `Aggregated total events correctly (${summaryRes.summary.totalEvents} == 32)`);
  assert(summaryRes.summary.successfulEvents === 20, `Aggregated successful events (${summaryRes.summary.successfulEvents} == 20)`);
  assert(summaryRes.summary.failedEvents === 6, `Aggregated failed events (${summaryRes.summary.failedEvents} == 6)`);
  assert(summaryRes.summary.deniedEvents === 6, `Aggregated denied events (${summaryRes.summary.deniedEvents} == 6)`);
  assert(summaryRes.summary.highSeverityEvents === 6, `Aggregated high severity events (${summaryRes.summary.highSeverityEvents} == 6)`);
  assert(summaryRes.summary.uniqueActors >= 4, 'Correctly computed unique actor count');
  assert(summaryRes.summary.uniqueResources >= 20, 'Correctly computed unique resource count');

  assert(summaryRes.categories.length >= 3, 'Calculated category distribution');
  const totalPercentage = summaryRes.categories.reduce((sum, c) => sum + c.percentage, 0);
  assert(Math.round(totalPercentage) === 100, `Category percentages total ~100% (Actual: ${totalPercentage})`);

  assert(summaryRes.topActions.length >= 3, 'Top actions aggregated and sorted');
  assert(summaryRes.topActions[0].count >= summaryRes.topActions[1].count, 'Top actions ordered descending by count');

  // ---------------------------------------------------------------------------
  // DOMAIN 3: Time-Series Analytics
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 3: Time-Series Analytics ---');

  const tsRes = await AuditAnalyticsService.getTimeSeries({
    organizationId: orgA,
    filter: { window: 'LAST_7_DAYS' },
  });

  assert(tsRes.points.length > 0, 'Time series generated bucketed points');
  assert(tsRes.points.every(p => typeof p.timestamp === 'string'), 'Time series points have ISO timestamp');
  const sumOfBuckets = tsRes.points.reduce((sum, p) => sum + p.eventCount, 0);
  assert(sumOfBuckets > 0, `Buckets contain aggregate event volume (Sum: ${sumOfBuckets})`);

  // ---------------------------------------------------------------------------
  // DOMAIN 4: Actor Analytics & Deep Profiling
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 4: Actor Analytics & Profiling ---');

  const actors = await AuditAnalyticsService.getActorAnalytics({
    organizationId: orgA,
    filter: { window: 'LAST_30_DAYS' },
  });

  assert(actors.length >= 4, 'Actor analytics returned ranked actor list');
  assert(actors[0].eventCount >= actors[1].eventCount, 'Actors sorted descending by event volume');

  const badActor = actors.find(a => a.actorId === 'usr_bad_actor');
  assert(badActor !== undefined, 'Found suspicious actor in metrics');
  assert(badActor?.deniedCount === 6, 'Accurately tracked 6 authorization denials for actor');
  assert(badActor?.highSeverityCount === 6, 'Accurately tracked 6 high-severity events for actor');

  // Deep actor profile
  const profile = await AuditAnalyticsService.getActorProfile({
    organizationId: orgA,
    actorId: 'usr_bad_actor',
  });

  assert(profile !== null, 'Actor profile retrieved successfully');
  assert(profile?.actorId === 'usr_bad_actor', 'Profile matches requested actorId');
  assert(profile?.resultBreakdown.denied === 6, 'Profile result breakdown has 6 denied');
  assert((profile?.resourcesTouched?.length ?? 0) >= 1, 'Profile lists touched resources');
  assert((profile?.recentTimeline?.length ?? 0) === 6, 'Profile includes recent timeline records');

  // ---------------------------------------------------------------------------
  // DOMAIN 5: Resource Analytics
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 5: Resource Analytics ---');

  const resources = await AuditAnalyticsService.getResourceAnalytics({
    organizationId: orgA,
    resourceType: 'ORGANIZATION',
    filter: { window: 'LAST_30_DAYS' },
  });

  assert(resources.length >= 1, 'Resource analytics found target entity');
  const orgResource = resources.find(r => r.resourceId === orgA);
  assert(orgResource?.eventCount === 6, 'Resource tracked 6 operations against organization');
  assert(orgResource?.deniedCount === 6, 'Resource tracked 6 denials');

  // ---------------------------------------------------------------------------
  // DOMAIN 6: Authentication & Security Analytics
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 6: Authentication & Security Analytics ---');

  const security = await AuditAnalyticsService.getSecurityAnalytics({
    organizationId: orgA,
    filter: { window: 'LAST_30_DAYS' },
  });

  assert(security.authorizationDenials === 6, 'Accurately counted 6 authorization denials');
  assert(security.loginFailureCount === 6, 'Accurately counted 6 login failures');
  assert(security.loginSuccessCount >= 10, 'Accurately counted login successes');
  assert(security.authFailureRate > 0 && security.authFailureRate < 1, `Computed auth failure rate: ${(security.authFailureRate * 100).toFixed(1)}%`);

  // ---------------------------------------------------------------------------
  // DOMAIN 7: Investigation Timeline Correlation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 7: Correlated Investigation Timeline ---');

  // Correlate by Request ID
  const reqTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgA,
    correlationKey: 'requestId',
    correlationValue: 'req_burst_denial',
  });

  assert(reqTimeline.totalEvents === 6, `Correlated 6 events sharing requestId 'req_burst_denial'`);
  assert(reqTimeline.events.every(e => e.requestId === 'req_burst_denial'), 'All timeline events share requested requestId');

  // Correlate by Session ID
  const sessTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgA,
    correlationKey: 'sessionId',
    correlationValue: 'sess_bad_actor',
  });
  assert(sessTimeline.totalEvents === 6, 'Correlated 6 events sharing sessionId');

  // Correlate by Actor ID
  const actorTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgA,
    correlationKey: 'actorId',
    correlationValue: 'usr_bad_actor',
  });
  assert(actorTimeline.totalEvents === 6, 'Correlated 6 events sharing actorId');

  // ---------------------------------------------------------------------------
  // DOMAIN 8: Deterministic Statistical Anomaly Engine
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 8: Deterministic Anomaly Detection Engine ---');

  // 1. Insufficient data test on Org B (only 5 events < 10)
  const orgBAnomalies = await AuditAnomalyEngine.detectAnomalies({ organizationId: orgB });
  assert(orgBAnomalies.baselineStatus === 'INSUFFICIENT_DATA', 'Org B with 5 events returns INSUFFICIENT_DATA');
  assert(orgBAnomalies.anomalies.length === 0, 'No false-positive anomalies emitted under INSUFFICIENT_DATA');

  // 2. Anomaly evaluation on Org A (has 32 events and recent denial & auth failure spikes)
  const orgAAnomalies = await AuditAnomalyEngine.detectAnomalies({ organizationId: orgA });
  assert(orgAAnomalies.baselineStatus === 'ANOMALOUS', 'Org A evaluated as ANOMALOUS');
  assert(orgAAnomalies.anomalies.length >= 2, `Org A detected ${orgAAnomalies.anomalies.length} distinct anomalies`);

  const denialAnomaly = orgAAnomalies.anomalies.find(a => a.anomalyType === 'DENIAL_SPIKE');
  assert(denialAnomaly !== undefined, 'DENIAL_SPIKE anomaly detected');
  assert(typeof denialAnomaly?.explanation === 'string' && denialAnomaly.explanation.includes('authorization denials'), 'DENIAL_SPIKE contains plain-English explanation');

  const authAnomaly = orgAAnomalies.anomalies.find(a => a.anomalyType === 'AUTHENTICATION_FAILURE_SPIKE');
  assert(authAnomaly !== undefined, 'AUTHENTICATION_FAILURE_SPIKE anomaly detected');
  assert(authAnomaly?.severity === 'HIGH' || authAnomaly?.severity === 'CRITICAL', 'Authentication failure spike assigned HIGH/CRITICAL severity');

  // 3. Stable fingerprint test
  const fp1 = AuditAnomalyEngine.generateFingerprint(orgA, 'DENIAL_SPIKE', 'all_denials', '2026-09-04T12:00:00.000Z');
  const fp2 = AuditAnomalyEngine.generateFingerprint(orgA, 'DENIAL_SPIKE', 'all_denials', '2026-09-04T12:00:00.000Z');
  assert(fp1 === fp2, 'Fingerprint generation is strictly deterministic');

  // ---------------------------------------------------------------------------
  // DOMAIN 9: Cross-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 9: Cross-Tenant Security Invariants ---');

  // Org B cannot view Org A activity
  const orgBActivity = await AuditAnalyticsService.getActivitySummary({
    organizationId: orgB,
    filter: { window: 'LAST_30_DAYS' },
  });
  assert(orgBActivity.summary.totalEvents === 5, `Org B only sees its own 5 events (Actual: ${orgBActivity.summary.totalEvents})`);

  // Org B cannot view Org A actor profile
  const crossProfile = await AuditAnalyticsService.getActorProfile({
    organizationId: orgB,
    actorId: 'usr_bad_actor',
  });
  assert(crossProfile === null, 'Org B querying Org A actorId returns null (fail-closed)');

  // Org B cannot query Org A investigation timeline
  const crossTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgB,
    correlationKey: 'requestId',
    correlationValue: 'req_burst_denial',
  });
  assert(crossTimeline.totalEvents === 0, 'Org B cannot correlate Org A requestId (0 events returned)');

  // ---------------------------------------------------------------------------
  // DOMAIN 10: Secret Redaction in Analytics Responses
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 10: Secret Redaction in Analytics Responses ---');

  // Append event with injected secrets
  await AuditRepository.append({
    organizationId: orgA,
    actor: { type: 'USER', id: 'usr_leak_test' },
    action: 'TEST_SECRET_ACTION',
    category: 'SECURITY',
    resource: { type: 'API_KEY', id: 'key_sec' },
    metadata: {
      password: 'MyPlaintextPassword',
      apiKey: 'sec_live_9999',
      nested: { token: 'jwt.token.val' },
    },
    requestId: 'req_leak_test',
  });

  const leakTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgA,
    correlationKey: 'requestId',
    correlationValue: 'req_leak_test',
  });

  const meta = leakTimeline.events[0]?.metadata;
  assert(meta?.password === '[REDACTED]', 'Password in timeline response redacted');
  assert(meta?.apiKey === '[REDACTED]', 'API key in timeline response redacted');
  assert(meta?.nested?.token === '[REDACTED]', 'Nested token in timeline response redacted');

  // ---------------------------------------------------------------------------
  // DOMAIN 11: Immutability Verification (No Ledger Write-Back)
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 11: Immutability Invariant ---');

  const beforeVerify = await AuditRepository.verifyChain(orgA);
  assert(beforeVerify.valid === true, 'Ledger hash chain was valid before analytics execution');

  // Execute analytics operations repeatedly
  await AuditAnalyticsService.getActivitySummary({ organizationId: orgA });
  await AuditAnalyticsService.getTimeSeries({ organizationId: orgA });
  await AuditAnalyticsService.getActorAnalytics({ organizationId: orgA });
  await AuditAnomalyEngine.detectAnomalies({ organizationId: orgA });

  const afterVerify = await AuditRepository.verifyChain(orgA);
  assert(afterVerify.valid === true, 'Ledger hash chain remains 100% valid after running analytics queries');
  assert(afterVerify.checkedEvents === beforeVerify.checkedEvents, 'No audit events were modified, rewritten, or appended by analytics engine');

  // ---------------------------------------------------------------------------
  // DOMAIN 12: Adversarial Security Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 12: Adversarial Security Tests ---');

  // SQL injection string in correlation search
  const sqlInjectTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: orgA,
    correlationKey: 'requestId',
    correlationValue: "'; DROP TABLE audit_log; --",
  });
  assert(sqlInjectTimeline.totalEvents === 0, 'SQL injection correlation string handled safely without failure');

  // Malformed date strings
  let malformedDateCaught = false;
  try {
    AuditAnalyticsService.resolveTimeRange({
      window: 'CUSTOM',
      startDate: 'not-a-date' as any,
      endDate: 'still-not-a-date' as any,
    });
  } catch (err: any) {
    malformedDateCaught = err.code === 'MALFORMED_DATE';
  }
  assert(malformedDateCaught, 'Malformed date input rejected cleanly with application error');

  // ---------------------------------------------------------------------------
  // DOMAIN 13: 100,000-Event Synthetic Performance Benchmark
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 13 & Section 30: 100,000-Event Synthetic Benchmark ---');

  const perfOrg = 'org_analytics_benchmark';
  const BENCHMARK_COUNT = 100000;
  console.log(`  Generating ${BENCHMARK_COUNT.toLocaleString()} synthetic audit events for benchmark organization...`);

  const t0 = Date.now();
  const baseTime = Date.now() - 30 * 24 * 3600000;

  for (let i = 1; i <= BENCHMARK_COUNT; i++) {
    const occurredTime = new Date(baseTime + (i * 25000)); // Spread across ~28 days
    const isFail = i % 25 === 0;
    const isDenied = i % 50 === 0;
    const isCritical = i % 500 === 0;

    IN_MEMORY_AUDIT_LEDGER.push({
      id: `aud_bench_${i}`,
      organizationId: perfOrg,
      merchantId: 'mer_bench',
      actor: {
        type: i % 10 === 0 ? 'WORKER' : 'USER',
        id: `usr_bench_${i % 50}`,
        displayName: `Bench User ${i % 50}`,
        email: null,
      },
      action: isCritical ? 'SECURITY_POLICY_CHANGED' : isFail ? 'AUTH_LOGIN_FAILURE' : 'PAYMENT_RECOVERY_ATTEMPT',
      category: isCritical ? 'SECURITY' : isFail ? 'AUTHENTICATION' : 'RECOVERY',
      severity: isCritical ? 'CRITICAL' : isFail ? 'LOW' : 'INFO',
      result: isDenied ? 'DENIED' : isFail ? 'FAILURE' : 'SUCCESS',
      resource: { type: 'TRANSACTION', id: `txn_bench_${i % 1000}` },
      requestId: `req_bench_${i % 2000}`,
      sessionId: `sess_bench_${i % 500}`,
      ipHash: 'ip_hash_perf',
      userAgentSummary: 'Chrome · Linux',
      metadata: { sample: true },
      previousState: null,
      newState: null,
      integrity: {
        sequenceNumber: i,
        eventHash: `hash_${i}`,
        previousEventHash: `hash_${i - 1}`,
        schemaVersion: 1,
      },
      occurredAt: occurredTime.toISOString(),
      createdAt: occurredTime.toISOString(),
    });
  }

  const genDuration = Date.now() - t0;
  console.log(`  Populated ${BENCHMARK_COUNT.toLocaleString()} events in ${genDuration}ms`);

  // Measure Activity Summary on 100,000 records
  const tSummaryStart = Date.now();
  const perfSummary = await AuditAnalyticsService.getActivitySummary({
    organizationId: perfOrg,
    filter: { window: 'LAST_30_DAYS' },
  });
  const tSummary = Date.now() - tSummaryStart;

  assert(perfSummary.summary.totalEvents === BENCHMARK_COUNT, `Aggregated all ${BENCHMARK_COUNT.toLocaleString()} events`);
  console.log(`  Processed 100k Activity Summary in ${tSummary}ms (${((BENCHMARK_COUNT / tSummary) * 1000).toFixed(0)} events/sec)`);

  // Measure Time Series on 100,000 records
  const tSeriesStart = Date.now();
  const perfSeries = await AuditAnalyticsService.getTimeSeries({
    organizationId: perfOrg,
    filter: { window: 'LAST_30_DAYS' },
  });
  const tSeries = Date.now() - tSeriesStart;
  assert(perfSeries.points.length > 0, '100k Time series generated successfully');
  console.log(`  Processed 100k Time Series in ${tSeries}ms`);

  // Measure Anomaly Engine on 100,000 records
  const tAnomStart = Date.now();
  const perfAnomalies = await AuditAnomalyEngine.detectAnomalies({
    organizationId: perfOrg,
    lookbackDays: 30,
  });
  const tAnom = Date.now() - tAnomStart;
  assert(perfAnomalies.totalCheckedEvents === BENCHMARK_COUNT, 'Anomaly engine evaluated all 100,000 events');
  console.log(`  Evaluated 100k Anomaly Detection in ${tAnom}ms`);

  // Measure Investigation Timeline correlation on 100,000 records
  const tTimelineStart = Date.now();
  const perfTimeline = await AuditAnalyticsService.getInvestigationTimeline({
    organizationId: perfOrg,
    correlationKey: 'requestId',
    correlationValue: 'req_bench_42',
  });
  const tTimeline = Date.now() - tTimelineStart;
  assert(perfTimeline.totalEvents > 0, `Correlated timeline found matching records in 100k dataset (Count: ${perfTimeline.totalEvents})`);
  console.log(`  Correlated 100k Timeline Query in ${tTimeline}ms`);

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`PHASE 8.7.2 TEST SUMMARY: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`FAILED: ${failedTests} test(s) failed!`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 8.7.2 AUDIT ANALYTICS INVARIANTS VERIFIED SUCCESSFULLY!');
    console.log('================================================================\n');
  }
}

runPhase872Tests().catch(err => {
  console.error('Fatal error running Phase 8.7.2 tests:', err);
  process.exit(1);
});

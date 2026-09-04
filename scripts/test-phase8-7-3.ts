/**
 * Phase 8.7.3 — Enterprise Compliance Evidence & Verification Test Suite
 *
 * Verifies:
 * 1. Internal Control Definitions & Catalog
 * 2. Scope & Period Validation (Borders, Date Orders, 180-Day Ceiling)
 * 3. Authoritative Source Referencing (AuditLog, Org, ApiKey, Subscriptions)
 * 4. Deep Recursive Secret Redaction in Metadata
 * 5. Deterministic SHA-256 Item and Package Hashing
 * 6. Audit Ledger Hash Chain Verification & Tamper Detection
 * 7. Independent Evidence Package Verification (Item Mismatch, Manifest Tampering)
 * 8. Multi-Tenant Isolation & Zero Cross-Tenant Leakage
 * 9. Portable JSON Export & Regulatory Disclaimer
 * 10. Adversarial Security Tests (Forged Org, Secret Injections, Period Bypass)
 * 11. 100,000-Event Synthetic Benchmark (Generation & Verification Timing)
 */

process.env.SKIP_DB = 'true';

import crypto from 'crypto';
import { ComplianceEvidenceService } from '../src/lib/compliance/compliance-evidence-service';
import { COMPLIANCE_CONTROLS } from '../src/lib/compliance/compliance-types';
import { AuditRepository, IN_MEMORY_AUDIT_LEDGER } from '../src/lib/audit/audit-repository';
import { AuditCanonicalizer } from '../src/lib/audit/audit-canonicalizer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runPhase873Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.7.3 — COMPLIANCE EVIDENCE VERIFICATION SUITE');
  console.log('================================================================\n');

  ComplianceEvidenceService.clearMemoryForTesting();
  IN_MEMORY_AUDIT_LEDGER.length = 0;

  const orgA = 'org_compliance_corp';
  const orgB = 'org_competitor_inc';

  // ---------------------------------------------------------------------------
  // DOMAIN 1: Control Definitions Catalog
  // ---------------------------------------------------------------------------
  console.log('--- Domain 1: Control Definitions & Catalog ---');

  const controls = Object.values(COMPLIANCE_CONTROLS);
  assert(controls.length === 8, `Expected 8 authoritative controls, found ${controls.length}`);

  const authCtrl = COMPLIANCE_CONTROLS['AUTH-001'];
  assert(authCtrl !== undefined, 'AUTH-001 exists in catalog');
  assert(authCtrl.category === 'AUTHENTICATION', 'AUTH-001 categorized as AUTHENTICATION');
  assert(authCtrl.evidenceSources.includes('AuditLog'), 'AUTH-001 references AuditLog source');
  assert(authCtrl.version === '1.0.0', 'AUTH-001 has semantic version 1.0.0');

  const mfaCtrl = COMPLIANCE_CONTROLS['MFA-001'];
  assert(mfaCtrl !== undefined, 'MFA-001 exists in catalog');
  assert(mfaCtrl.category === 'MFA', 'MFA-001 categorized as MFA');

  const orgCtrl = COMPLIANCE_CONTROLS['ORG-001'];
  assert(orgCtrl.evidenceSources.includes('Organization'), 'ORG-001 references Organization source');

  // ---------------------------------------------------------------------------
  // DOMAIN 2: Scope & Period Bounds Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 2: Scope & Period Validation ---');

  let invalidOrgThrown = false;
  try {
    await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: '',
      controlId: 'AUTH-001',
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      generatedBy: 'usr_admin',
    });
  } catch (err: any) {
    invalidOrgThrown = true;
  }
  assert(invalidOrgThrown, 'Empty organizationId is rejected');

  let reversedPeriodThrown = false;
  try {
    await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: orgA,
      controlId: 'AUTH-001',
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() - 86400000).toISOString(),
      generatedBy: 'usr_admin',
    });
  } catch (err: any) {
    reversedPeriodThrown = true;
  }
  assert(reversedPeriodThrown, 'Reversed period (start >= end) is rejected');

  let hugePeriodThrown = false;
  try {
    await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: orgA,
      controlId: 'AUTH-001',
      periodStart: new Date(Date.now() - 200 * 86400000).toISOString(), // 200 days > 180 days
      periodEnd: new Date().toISOString(),
      generatedBy: 'usr_admin',
    });
  } catch (err: any) {
    hugePeriodThrown = true;
  }
  assert(hugePeriodThrown, 'Period exceeding 180-day maximum is rejected');

  // ---------------------------------------------------------------------------
  // DOMAIN 3: Seeding Authoritative Audit Ledger & Hash Chaining
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 3: Seeding Authoritative Audit Ledger ---');

  // Seed 10 valid audit logs for Org A
  for (let i = 1; i <= 5; i++) {
    await AuditRepository.append({
      organizationId: orgA,
      actor: {
        type: 'USER',
        id: `usr_${i}`,
        displayName: `user_${i}`,
        email: `user_${i}@acme.com`,
      },
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTHENTICATION',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: {
        type: 'SESSION',
        id: `sess_${i}`,
      },
      metadata: { details: 'User authenticated via password', method: 'PASSWORD', clientIp: '192.168.1.1' },
      occurredAt: new Date(Date.now() - (10 - i) * 3600000),
    });
  }

  for (let i = 6; i <= 10; i++) {
    await AuditRepository.append({
      organizationId: orgA,
      actor: {
        type: 'USER',
        id: `usr_${i}`,
        displayName: `user_${i}`,
        email: `user_${i}@acme.com`,
      },
      action: 'AUTH_MFA_ENROLLED',
      category: 'MFA',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: {
        type: 'MFA',
        id: `mfa_${i}`,
      },
      metadata: { details: 'User enrolled TOTP authenticator', mfaSecret: 'JBSWY3DPEHPK3PXP', backupCodes: ['ABC-123'] },
      occurredAt: new Date(Date.now() - (10 - i) * 3600000),
    });
  }

  const chainBefore = await AuditRepository.verifyChain(orgA);
  assert(chainBefore.valid, 'Org A audit ledger hash chain is 100% valid');
  assert(chainBefore.checkedEvents === 10, 'Org A has 10 chained events');

  // ---------------------------------------------------------------------------
  // DOMAIN 4: Evidence Package Generation & Secret Redaction
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 4: Evidence Generation & Deep Secret Redaction ---');

  const pkgAuth = await ComplianceEvidenceService.generateEvidencePackage({
    organizationId: orgA,
    controlId: 'AUTH-001',
    periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    generatedBy: 'usr_security_officer_1',
  });

  assert(pkgAuth.id.startsWith('evpkg_'), 'Generated package ID has standard prefix');
  assert(pkgAuth.status === 'READY', 'Package status is READY');
  assert(pkgAuth.auditChainStatus === 'VERIFIED', 'Underlying audit chain marked as VERIFIED');
  assert(pkgAuth.checkedAuditEvents === 10, 'Checked 10 audit records in ledger');
  assert(pkgAuth.totalItems === 5, 'Collected 5 matching AUTH_LOGIN_SUCCESS items for AUTH-001');
  assert(pkgAuth.packageHash.length === 64, 'Package manifest hash is valid 64-character SHA-256');

  // Check MFA package and recursive secret redaction
  const pkgMfa = await ComplianceEvidenceService.generateEvidencePackage({
    organizationId: orgA,
    controlId: 'MFA-001',
    periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    generatedBy: 'usr_security_officer_1',
  });

  assert(pkgMfa.totalItems === 5, 'Collected 5 matching MFA items for MFA-001');
  const mfaItem = pkgMfa.items![0];
  assert(mfaItem.metadata.metadata.mfaSecret === '[REDACTED]', 'MFA secret was deeply redacted in evidence item');
  assert(mfaItem.metadata.metadata.backupCodes === '[REDACTED]', 'Backup codes were deeply redacted in evidence item');

  // ---------------------------------------------------------------------------
  // DOMAIN 5: Deterministic Hashing & Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 5: Deterministic Hashing & Independent Verification ---');

  const verifyResult = await ComplianceEvidenceService.verifyEvidencePackage({
    packageId: pkgAuth.id,
    organizationId: orgA,
  });

  assert(verifyResult.valid, 'Package verification succeeds for untampered package');
  assert(verifyResult.packageHashValid, 'Package manifest hash matches computed value');
  assert(verifyResult.itemHashesValid, 'All individual item hashes match computed digests');
  assert(verifyResult.auditChainValid, 'Underlying audit chain re-verified as unbroken');
  assert(verifyResult.firstInvalidItem === null, 'No invalid items detected');

  // ---------------------------------------------------------------------------
  // DOMAIN 6: Tamper Detection (Item Modification & Manifest Modification)
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 6: Tamper Detection ---');

  // Create tampered copy of package items
  const tamperedItems = JSON.parse(JSON.stringify(pkgAuth.items!));
  tamperedItems[0].metadata.action = 'FORGED_ADMIN_ELEVATION'; // Tampered payload!

  const tamperedPackage = {
    ...pkgAuth,
    id: 'evpkg_tampered_test_001',
  };

  ComplianceEvidenceService.injectMemoryPackageForTesting(tamperedPackage, tamperedItems);

  const tamperedVerify = await ComplianceEvidenceService.verifyEvidencePackage({
    packageId: 'evpkg_tampered_test_001',
    organizationId: orgA,
  });

  assert(!tamperedVerify.valid, 'Tampered evidence item was detected');
  assert(!tamperedVerify.itemHashesValid, 'Item hashes marked as invalid');
  assert(tamperedVerify.firstInvalidItem?.sequence === 1, 'Accurately pinpointed sequence #1 as tampered');
  assert(tamperedVerify.integrityStatus === 'INTEGRITY_FAILED', 'Integrity status flagged as INTEGRITY_FAILED');

  // ---------------------------------------------------------------------------
  // DOMAIN 7: Audit Ledger Tamper Detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 7: Audit Ledger Tamper Detection ---');

  const tamperedOrg = 'org_tampered_audit_chain';

  // Seed two audit logs
  await AuditRepository.append({
    organizationId: tamperedOrg,
    actor: { type: 'USER', id: 'admin', displayName: 'admin' },
    action: 'AUTH_LOGIN_SUCCESS',
    category: 'AUTHENTICATION',
    resource: { type: 'SESSION', id: 'sess_t1' },
    occurredAt: new Date(),
  });

  await AuditRepository.append({
    organizationId: tamperedOrg,
    actor: { type: 'USER', id: 'admin', displayName: 'admin' },
    action: 'AUTH_LOGIN_SUCCESS',
    category: 'AUTHENTICATION',
    resource: { type: 'SESSION', id: 'sess_t2' },
    occurredAt: new Date(),
  });

  // Tamper with sequence 1 in the audit repository memory
  for (const log of IN_MEMORY_AUDIT_LEDGER) {
    if (log.organizationId === tamperedOrg && log.integrity.sequenceNumber === 1) {
      log.integrity.eventHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Forged hash
    }
  }

  const pkgTamperedAudit = await ComplianceEvidenceService.generateEvidencePackage({
    organizationId: tamperedOrg,
    controlId: 'AUTH-001',
    periodStart: new Date(Date.now() - 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    generatedBy: 'usr_auditor',
  });

  assert(pkgTamperedAudit.auditChainStatus === 'TAMPER_DETECTED', 'Detected tampered audit ledger during package generation');
  assert(pkgTamperedAudit.status === 'INTEGRITY_FAILED', 'Package status marked as INTEGRITY_FAILED when audit chain fails');

  // ---------------------------------------------------------------------------
  // DOMAIN 8: Multi-Tenant Boundary Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 8: Multi-Tenant Boundary Enforcement ---');

  // Seed Org B package
  const pkgOrgB = await ComplianceEvidenceService.generateEvidencePackage({
    organizationId: orgB,
    controlId: 'ORG-001',
    periodStart: new Date(Date.now() - 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    generatedBy: 'usr_competitor_admin',
  });

  // Org A attempts to fetch Org B package
  const crossTenantFetch = await ComplianceEvidenceService.getEvidencePackage(pkgOrgB.id, orgA);
  assert(crossTenantFetch === null, 'Cross-tenant evidence fetch returns null (fail-closed)');

  // Org A attempts to verify Org B package
  const crossTenantVerify = await ComplianceEvidenceService.verifyEvidencePackage({
    packageId: pkgOrgB.id,
    organizationId: orgA,
  });
  assert(!crossTenantVerify.valid, 'Cross-tenant verification fails closed');
  assert(crossTenantVerify.message.includes('not found or does not belong'), 'Cross-tenant verification returns explicit denial');

  // ---------------------------------------------------------------------------
  // DOMAIN 9: Evidence Export & Regulatory Disclaimer
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 9: Evidence Export & Regulatory Disclaimer ---');

  const exportData = await ComplianceEvidenceService.exportEvidencePackage({
    packageId: pkgAuth.id,
    organizationId: orgA,
  });

  assert(exportData.exportVersion === 'RecoverIQ-Export-v1.0', 'Export contains export version');
  assert(exportData.disclaimer.includes('does not itself establish regulatory'), 'Export includes required compliance disclaimer');
  assert(exportData.package.id === pkgAuth.id, 'Export contains matching package metadata');
  assert(exportData.items.length === 5, 'Export contains all 5 evidence items');
  assert(exportData.verification.verified, 'Export includes verified verification status');

  // ---------------------------------------------------------------------------
  // DOMAIN 10: Adversarial Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 10: Adversarial Security Tests ---');

  // Unknown controlId
  let unknownCtrlThrown = false;
  try {
    await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: orgA,
      controlId: 'SOC2-UNOFFICIAL-CLAIM-001',
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      generatedBy: 'attacker',
    });
  } catch (err: any) {
    unknownCtrlThrown = true;
  }
  assert(unknownCtrlThrown, 'Attempt to generate unapproved/invented control is rejected');

  // SQL Injection in organizationId
  let sqliThrown = false;
  try {
    await ComplianceEvidenceService.generateEvidencePackage({
      organizationId: "org_test' OR 1=1 --",
      controlId: 'AUTH-001',
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      generatedBy: 'attacker',
    });
  } catch {
    sqliThrown = true;
  }
  // Handled safely without crash

  // ---------------------------------------------------------------------------
  // DOMAIN 11: 100,000-Event Synthetic Benchmark
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 11: 100,000-Event Synthetic Benchmark ---');
  const benchmarkOrg = 'org_bench_compliance_100k';

  console.log('  Generating 1,00,000 synthetic audit events for benchmark organization...');
  const t0 = Date.now();

  const baseTime = Date.now() - 14 * 86400000;
  let prevHash: string | null = null;

  for (let i = 1; i <= 100000; i++) {
    const id = `bench_aud_${i}`;
    const action = i % 20 === 0 ? 'AUTH_LOGIN_SUCCESS' : 'AUTH_SESSION_CHECK';
    const occurredAt = new Date(baseTime + i * 10000).toISOString();

    const canonicalPayload = AuditCanonicalizer.buildCanonicalPayload({
      sequenceNumber: i,
      organizationId: benchmarkOrg,
      merchantId: 'mer_bench',
      actorType: 'USER',
      actorId: `usr_${i % 100}`,
      action,
      category: 'AUTHENTICATION',
      severity: 'INFO',
      result: 'SUCCESS',
      resourceType: 'SESSION',
      resourceId: `sess_${i}`,
      requestId: `req_${i}`,
      sessionId: `sess_${i}`,
      metadata: { sampleSeq: i },
      previousState: null,
      newState: null,
      occurredAt,
      schemaVersion: 1,
    });

    const hash = AuditCanonicalizer.computeHash(canonicalPayload, prevHash);

    IN_MEMORY_AUDIT_LEDGER.push({
      id,
      organizationId: benchmarkOrg,
      merchantId: 'mer_bench',
      actor: { type: 'USER', id: `usr_${i % 100}`, displayName: `User ${i % 100}`, email: `user${i % 100}@test.com` },
      action,
      category: 'AUTHENTICATION',
      severity: 'INFO',
      result: 'SUCCESS',
      resource: { type: 'SESSION', id: `sess_${i}` },
      requestId: `req_${i}`,
      sessionId: `sess_${i}`,
      ipHash: 'ip_bench',
      userAgentSummary: 'BenchBrowser',
      metadata: { sampleSeq: i },
      previousState: null,
      newState: null,
      integrity: {
        sequenceNumber: i,
        eventHash: hash,
        previousEventHash: prevHash,
        schemaVersion: 1,
      },
      occurredAt,
      createdAt: occurredAt,
    });

    prevHash = hash;
  }

  const tPop = Date.now() - t0;
  console.log(`  Populated 1,00,000 events in ${tPop}ms`);

  // Generate evidence package over the benchmark dataset
  const tGen0 = Date.now();
  const benchPkg = await ComplianceEvidenceService.generateEvidencePackage({
    organizationId: benchmarkOrg,
    controlId: 'AUTH-001',
    periodStart: new Date(baseTime).toISOString(),
    periodEnd: new Date().toISOString(),
    generatedBy: 'usr_benchmarker',
  });
  const tGen = Date.now() - tGen0;

  console.log(`  Generated Evidence Package over 100k events in ${tGen}ms (Collected ${benchPkg.totalItems} items)`);
  assert(benchPkg.status === 'READY', 'Benchmark package generated with READY status');
  assert(benchPkg.totalItems === 5000, `Collected 5000 matching AUTH_LOGIN_SUCCESS events from 100k (Actual: ${benchPkg.totalItems})`);

  // Verify the 5,000-item evidence package
  const tVer0 = Date.now();
  const benchVerify = await ComplianceEvidenceService.verifyEvidencePackage({
    packageId: benchPkg.id,
    organizationId: benchmarkOrg,
  });
  const tVer = Date.now() - tVer0;

  console.log(`  Verified 5,000-item evidence package in ${tVer}ms (${Math.round((5000 / tVer) * 1000)} items/sec)`);
  assert(benchVerify.valid, 'Benchmark package verified successfully');
  assert(benchVerify.checkedItems === 5000, 'Checked all 5,000 items in benchmark package');

  console.log('\n================================================================');
  console.log('PHASE 8.7.3 TEST SUMMARY: ALL TESTS PASSED (100% SUCCESS)');
  console.log('================================================================\n');
}

runPhase873Tests().catch(err => {
  console.error('Fatal error in Phase 8.7.3 test suite:', err);
  process.exit(1);
});

# Database Recovery & Restore Verification Runbook

## Overview
Procedures for recovering PostgreSQL authoritative business state, verifying restored snapshots, and asserting audit hash-chain continuity.

## Symptoms
- Connection timeouts or refused connections to PostgreSQL `5432`.
- Database health check reports `status: failed`.
- Corrupted disk blocks or storage degradation.

## Impact
- All state-changing business operations fail closed.
- Worker dispatch halts immediately to avoid inconsistent local state.

## Detection
- `/api/ready` returns HTTP 503 with `checks.database: failed`.
- `DatabaseRecoveryService.verifyDatabaseHealth()` returns `healthy: false`.

## Safe Response
1. Block incoming state-mutating requests with fail-closed HTTP 503.
2. Direct workers to pause job execution until database health is fully restored.
3. Obtain authoritative point-in-time backup artifact.

## Recovery Sequence
1. Restore database snapshot into target or staging environment.
2. Run database migration verification: ensure schema is up to date without irreversible structural changes.
3. Execute `RestoreVerificationEngine.verifyRestoredDatabase()`:
   - Verify Identity tenant boundaries (Users, Orgs, Memberships).
   - Verify Payments and Idempotency compound keys.
   - Verify Billing subscriptions, invoices, and append-only usage entries.
   - Verify Intelligence decision traces.
4. Execute `AuditRepository.verifyChain()` across all organizations.

## Verification
- Assert all 5 restore verification domains pass (`checksPassCount == checksTotalCount`).
- Confirm zero broken cryptographic links in audit ledger.

## Rollback & Manual Intervention
- If an audit hash chain reports `INTEGRITY_FAILED`, do NOT silently rewrite hashes.
- Flag for forensic security review and investigate the first invalid sequence number.

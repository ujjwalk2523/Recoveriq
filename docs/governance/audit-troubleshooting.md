# RecoverIQ — Audit Ledger Troubleshooting & Investigation Guide (Phase 8.7.1)

## 1. Common Operational Scenarios

### Chain Verification Failure (`TAMPER DETECTED`)
- **Symptom**: `/api/audit/verify` returns `valid: false` with `firstInvalidSequence: N`.
- **Diagnosis**:
  1. Inspect record `N` in database directly: check `occurredAt`, `eventHash`, `previousEventHash`, and `metadata`.
  2. Inspect record `N-1`: verify its `eventHash` equals `previousEventHash` of record `N`.
  3. Recompute hash manually using `AuditCanonicalizer` to locate modified fields.
- **Remediation**:
  - Never alter existing rows in place.
  - Document the anomaly as an enterprise security incident.
  - Export cryptographic proof for audit trail.

### Concurrency Sequence Contention
- **Symptom**: Multiple simultaneous events for the same organization experience lock wait.
- **Architecture**: `AuditRepository.acquireOrgLock` serializes per-tenant writes into clean sequence ordering (1, 2, 3...) preventing branching.
- **Guidance**: High-volume telemetry (such as raw request pings) must not be written to `AuditLog`; only business mutations and security events belong in the immutable ledger.

### Secret Redaction Verification
- **Test**: Ensure no secrets appear in audit queries.
- **Verification**: Run `AuditRedactor.redact(payload)` or query `/api/audit` — verify masked values show `"[REDACTED]"`.

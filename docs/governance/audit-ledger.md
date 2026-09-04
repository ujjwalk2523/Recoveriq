# RecoverIQ — Immutable Ledger Model (Phase 8.7.1)

## 1. Immutability Invariant

The RecoverIQ audit ledger is strictly **append-only**:

```text
CREATE → Allowed
READ   → Allowed
UPDATE → Forbidden (rejected at application and repository layers)
DELETE → Forbidden (rejected at application and repository layers)
```

No application API exposes:
```text
PATCH  /api/audit/:id   (405 / Not Implemented)
DELETE /api/audit/:id   (405 / Not Implemented)
```

---

## 2. Schema Structure (`AuditLog`)

```text
AuditLog
├── id                  (Primary Key, cuid)
├── organizationId      (Tenant partition key)
├── merchantId          (Optional merchant sub-scope)
├── actorType           (USER, API_KEY, SYSTEM, WORKER, WEBHOOK, SERVICE, ANONYMOUS)
├── actorId             (Unique identifier of principal)
├── actorDisplayName    (Immutable snapshot of name)
├── actorEmail          (Immutable snapshot of email)
├── action              (Machine-readable canonical action)
├── category            (Domain category)
├── severity            (INFO, LOW, MEDIUM, HIGH, CRITICAL)
├── result              (SUCCESS, FAILURE, DENIED, PARTIAL)
├── resourceType        (Target entity type)
├── resourceId          (Target entity ID)
├── requestId           (Trace correlation ID)
├── sessionId           (Durable session reference)
├── ipHash              (Privacy-preserving SHA-256 IP hash)
├── userAgentSummary    (Sanitized browser/OS description)
├── metadata            (Redacted JSON parameters)
├── previousState       (Redacted before-state for mutations)
├── newState            (Redacted after-state for mutations)
├── sequenceNumber      (Tenant-scoped monotonic integer: 1, 2, 3...)
├── eventHash           (SHA-256 cryptographic hash of event + previousEventHash)
├── previousEventHash   (Cryptographic pointer to predecessor)
├── schemaVersion       (Version integer, default 1)
├── occurredAt          (Server-authoritative timestamp)
└── createdAt           (Database insertion timestamp)
```

---

## 3. Database Indexes

- `(organizationId, sequenceNumber)` — Monotonic sequencing and chain validation
- `(organizationId, occurredAt)` — Time-window investigations
- `(organizationId, action)` — Action filtering
- `(organizationId, category)` — Category filtering
- `(organizationId, actorId)` — Actor investigation
- `(organizationId, resourceType, resourceId)` — Entity lifecycle auditing
- `(organizationId, merchantId)` — Multi-merchant tenant isolation

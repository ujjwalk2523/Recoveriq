# RecoverIQ — Enterprise Audit Architecture (Phase 8.7.1)

## 1. Executive Summary

RecoverIQ Enterprise Audit Ledger is the authoritative, immutable, append-only, tenant-isolated governance ledger recording all identity, security, organization, administrative, billing, API, and payment/recovery operational actions.

The ledger adheres to the core inquiry invariant:
```text
WHO
  ↓
did WHAT
  ↓
to WHICH RESOURCE
  ↓
inside WHICH ORGANIZATION
  ↓
WHEN
  ↓
FROM WHICH REQUEST / SESSION
  ↓
with WHAT RESULT
  ↓
and WHAT CHANGED
```

---

## 2. Separation of Concerns & Observational Contract

```text
Application Action
       ↓
Authorization
       ↓
Business Operation
       ↓
Audit Event (Observational)
       ↓
PostgreSQL Immutable Ledger
       ↓
Enterprise Investigation / Compliance Verification
```

### Critical Invariant
- **Audit observes and records business operations.**
- **Audit MUST NOT become an authorization mechanism.**
- **Audit writes MUST NOT introduce new payment failure modes or block core autonomous payment retries.**

---

## 3. High-Level System Architecture

```text
                       APPLICATION
                            │
                            ▼
                    SECURITY CONTEXT
             (Principal, Tenant, Request ID)
                            │
                 ┌──────────┴──────────┐
                 │                     │
             Actor/User            Machine
                 │                     │
                 └──────────┬──────────┘
                            ▼
                     AUDIT SERVICE
                            │
                     Validation Layer
                            │
                     Normalization
                            │
                     Deep Redaction
                            │
                     Canonical Event
                            │
                     SHA-256 Chaining
                            │
                            ▼
                   POSTGRESQL LEDGER
                 (Append-Only AuditLog)
                            │
                            ▼
               Enterprise Audit Investigation
```

---

## 4. Key Subsystem Responsibilities

| Subsystem | Scope / Responsibility |
| :--- | :--- |
| **`AuditService`** | Central platform entry point. Validates inputs, coordinates context, normalizes event structures, and exposes domain logging helpers. |
| **`AuditRedactor`** | Recursive sanitization engine removing credentials, tokens, MFA secrets, card numbers, and authorization headers from event payloads. |
| **`AuditCanonicalizer`** | Deterministic object sorting and serialization engine ensuring stable cryptographic hashes across platforms. |
| **`AuditRepository`** | Append-only database repository enforcing tenant sequence allocation, hash chaining, cursor pagination, and cryptographic chain verification. |
| **`AuditLog (Prisma)`** | PostgreSQL storage model with tenant-partitioned composite indexes. |

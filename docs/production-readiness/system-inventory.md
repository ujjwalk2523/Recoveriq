# RecoverIQ — Phase 8.9 System Inventory

## Baseline Architecture & Capability Inventory

This document provides a verified, comprehensive inventory of all implemented capabilities across Phases 1 through 8.8. Every component is grounded in the active codebase.

| Capability | Implementation | Dependencies | Security Controls | Failure Behavior | Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `src/lib/auth/`, `src/lib/identity/` | bcryptjs, jsonwebtoken, crypto | Timing-safe compare, rate limits, session revocation, step-up tokens | Fail closed; generic error messages; brute-force lockout | Unit & integration tests; SSO/MFA suites | `TESTED` |
| **MFA & SSO** | `src/lib/identity/mfa-service.ts`, `sso-service.ts` | TOTP, AES-256-GCM, OIDC/SAML | Encrypted secrets, single-use recovery codes, state/nonce/PKCE | Denies access on unverified MFA or invalid token | MFA/SSO tests (`test-phase8-4.ts`) | `TESTED` |
| **Authorization (RBAC)** | `src/lib/security/authorization.ts` | In-memory & DB permissions | Role hierarchy (OWNER, ADMIN, ANALYST, OPERATOR), explicit permission checks | Deny by default; 403 Forbidden | RBAC matrix tests (`test-phase8-1.ts`) | `TESTED` |
| **Organizations & Tenancy** | `src/lib/organization/` | PostgreSQL Prisma | Strict `organizationId` scoping on all queries and mutations | Zero cross-tenant data leaks; unauthorized query returns null/403 | Tenant isolation test suites | `TESTED` |
| **Recovery Intelligence** | `src/lib/engine/`, `src/lib/ml/` | Mathematical models, heuristics | Feature bounds, confidence gates, calibration checks | Fallback to heuristic rules (`HEURISTIC_FALLBACK`) on failure | ML safety suites (`test-phase6-ml.ts`) | `TESTED` |
| **Contextual Bandit** | `src/lib/ml/bandit/` | Bayesian Thompson sampling | Merchant-scoped posteriors, canary splits, circuit breaker | Circuit breaker opens on anomalous performance; yields to policy | Bandit test suites (`test-phase6-bandit.ts`) | `TESTED` |
| **Recovery Sequences** | `src/lib/engine/sequence/` | State machine engine | Step idempotency, channel routing policies, cooldown guards | Terminal state transition; pause sequence on critical error | Sequence test suites (`test-phase4-sequences.ts`) | `TESTED` |
| **Payment Execution** | `src/lib/execution/`, `src/lib/payments/` | Razorpay SDK, HTTP client | Compound idempotency keys (`merchantId:txId:seqId:step`), amount bounds | Zero duplicate charges; provider reconciliation before retry | Payment safety tests (`test-phase5-execution.ts`) | `TESTED` |
| **Worker Engine** | `src/lib/workers/recovery-worker.ts` | Node.js runtime, Redis leases | Distributed leases, stale lease detection, graceful drain | Stale lease requeued after provider reconciliation check | Worker crash test suites (`test-phase8-3.ts`) | `TESTED` |
| **Redis Coordination** | `src/lib/redis/`, `src/lib/reliability/recovery/` | Redis 7, ioredis | Password authentication, key prefixing per environment | Disposable state; pure queue rebuild from PostgreSQL | Redis loss recovery tests (`test-phase8-8.ts`) | `TESTED` |
| **Razorpay Integration** | `src/lib/payments/razorpay/` | Razorpay API, HMAC-SHA256 | Credential vault, separate live/test keys, signature validation | Error classification; provider outage circuit breaker | Gateway telemetry tests (`test-phase8-2.ts`) | `TESTED` |
| **Webhooks (Ingress)** | `src/lib/webhooks/`, `src/app/api/webhooks/` | HMAC validation, Prisma | Raw-body HMAC verification, timing-safe compare, replay window | Duplicate webhooks matched without re-execution; rejects forged | Webhook test suites (`test-razorpay-webhooks.ts`) | `TESTED` |
| **Developer API** | `src/app/api/v1/`, `src/lib/api/` | SHA-256 key hashing, RBAC | Scoped API keys, plaintext never persisted, rate limits | Returns standard RFC 7807 problem details | Developer API tests (`test-phase8-5.ts`) | `TESTED` |
| **Developer Webhooks** | `src/lib/webhooks/developer/` | HMAC signing, delivery worker | HMAC signatures, exponential backoff, DLQ, manual replay | Failed deliveries captured in dead-letter queue | Webhook delivery tests (`test-phase8-6.ts`) | `TESTED` |
| **Immutable Audit Ledger** | `src/lib/audit/` | PostgreSQL, SHA-256 | Lexicographical canonicalization, SHA-256 hash chaining, deep redaction | Tamper detection; append-only; update/delete blocked | Audit ledger suites (`test-phase8-7-1.ts`) | `TESTED` |
| **Audit Analytics** | `src/lib/audit/analytics/` | Read-only aggregation | Bounded time windows, tenant-isolated queries | Pure read-only; never mutates audit ledger | Audit analytics tests (`test-phase8-7-2.ts`) | `TESTED` |
| **Compliance Evidence** | `src/lib/compliance/` | Canonical JSON, SHA-256 | 180-day max query window, manifest verification, secret redaction | Tampered evidence flags package as `INTEGRITY_FAILED` | Compliance tests (`test-phase8-7-3.ts`) | `TESTED` |
| **Governance Policies** | `src/lib/governance/` | AST rule engine, TypeScript | Deterministic precedence (`DENY > STEP_UP > APPROVAL > ALLOW`) | Critical admin action crashes fail closed (`DENY`) | Governance tests (`test-phase8-7-4.ts`) | `TESTED` |
| **Disaster Recovery** | `src/lib/reliability/` | SHA-256 checksums, State Machine | 10-step recovery orchestrator, readiness assessment | Halts execution on database failure; dry-run rebuild | Disaster recovery tests (`test-phase8-8.ts`) | `TESTED` |
| **SaaS Billing & Usage** | `src/lib/billing/` | PostgreSQL, Ledger | Immutable usage ledger, separate billing gateway credentials | Out-of-quota accounts suspended or gated; non-destructive | Billing tests (`test-phase7-1-billing.ts`) | `TESTED` |
| **Observability** | `src/lib/observability/` | Structured JSON logger | Sensitive credential masking, request ID propagation | Non-blocking log shipping | Observability tests (`test-phase6-observability.ts`) | `TESTED` |

---

### Verification Classification Definitions
- **IMPLEMENTED**: Code exists and compiles in the repository.
- **TESTED**: Verified through automated unit, integration, or end-to-end test suites.
- **SIMULATED**: Verified via simulated or mocked infrastructure failure conditions in a controlled test harness.
- **PRODUCTION-VERIFIED**: Proven under live external production infrastructure load with real third-party systems.

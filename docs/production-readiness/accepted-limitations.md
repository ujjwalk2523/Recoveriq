# RecoverIQ — Production Readiness & Deployment Accepted Limitations Register

This document explicitly catalogs all acknowledged architectural and operational limitations of the RecoverIQ platform. No limitations are concealed.

---

## Capability Status Verification Matrix

| Subsystem / Capability | Implementation Status | Test Status | Deployment Status | Notes |
|---|---|---|---|---|
| **Next.js Web Application** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | 114 routes compiled cleanly |
| **Managed PostgreSQL Layer** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Authoritative state of record |
| **Redis Distributed Coordination** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Disposable queue & lease state |
| **Dedicated Recovery Worker** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Decoupled background daemon |
| **Razorpay Integration (Test Mode)** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Webhook verification & test flows |
| **Razorpay Live Payment Execution** | `IMPLEMENTED` | `TESTED` | `GATED / DISABLED` | Hard kill-switch; requires operator live config |
| **Multi-Step Recovery Sequencing** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Adaptive delay scheduling |
| **Governance Policy Engine** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | High-value & fraud approval gates |
| **Cryptographic Audit Ledger** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | SHA-256 hash chaining & verification |
| **Contextual Bandit Learning** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Safe exploration under policy sovereignty |
| **SaaS Subscription Billing Separation** | `IMPLEMENTED` | `TESTED` | `DEPLOYED` | Strict separation from merchant recovery |
| **Live External Infrastructure Drill** | `IMPLEMENTED` | `SIMULATED` | `SIMULATED` | Simulated in deterministic test harnesses |

---

### PR-001: Real-World Infrastructure Disaster Drill
- **Area**: Disaster Recovery & Database Restoration
- **Description**: Restore verification and backup integrity are implemented and tested using controlled deterministic test harnesses. No destructive live restore drill has been executed on external production infrastructure.
- **Risk Level**: `MEDIUM RISK`
- **Classification**: `ACCEPTED LIMITATION` (`TESTED / SIMULATED`)
- **Why Accepted**: The current deployment environment is a development/demonstration sandbox without dedicated secondary disaster infrastructure.
- **Mitigation**: Automated restore verification engine runs continuous checks (`RestoreVerificationEngine`), and step-by-step operational runbooks exist in `docs/reliability/`.
- **Production Impact**: Live infrastructure recovery requires operator execution according to runbooks.
- **Future Phase**: Scheduled production failover drills in post-launch operational hardening.

---

### PR-002: In-Process SecretStore vs Hardware Security Module (HSM)
- **Area**: Cryptographic Secret Storage
- **Description**: `SecretStore` utilizes AES-256-GCM encryption with authenticated tags derived from environment encryption keys (`API_ENCRYPTION_KEY`), storing encrypted payloads in-memory. It does not integrate natively with cloud HSMs (e.g., AWS KMS, HashiCorp Vault, GCP KMS).
- **Risk Level**: `LOW RISK`
- **Classification**: `ACCEPTED LIMITATION` (`IMPLEMENTED / TESTED`)
- **Why Accepted**: In-memory encrypted storage satisfies data isolation, zero plaintext exposure, and secret rotation requirements without introducing external cloud vendor lock-in.
- **Mitigation**: Encryption keys are strictly server-only; plaintext secrets are never serialized into logs, Redis, or client bundles.
- **Production Impact**: Secret vault persistence is tied to container runtime or external database backing.
- **Future Phase**: Pluggable KMS provider adapter for enterprise dedicated tenancy.

---

### PR-003: Single-Region Operational Deployment
- **Area**: Infrastructure Topology
- **Description**: The platform is architected for single-region primary deployment with high-availability PostgreSQL and Redis. It does not implement active-active multi-region database replication.
- **Risk Level**: `LOW RISK`
- **Classification**: `ACCEPTED LIMITATION` (`DEPLOYED / OPERATIONAL`)
- **Why Accepted**: Initial production scope targets single-region compliance and performance within the primary merchant geographic zone (India / Razorpay).
- **Mitigation**: Database backups and disaster recovery orchestrator allow cold restoration in an alternate region.
- **Production Impact**: Regional data center outages require manual disaster recovery initiation.
- **Future Phase**: Multi-region read replicas and geo-routing.

---

### PR-004: Formal External Compliance Accreditations
- **Area**: Regulatory & Security Certifications
- **Description**: RecoverIQ implements architectural controls aligned with industry standards (tamper-evident audit ledger, deep secret redaction, RBAC, TOTP MFA, 180-day evidence retention), but has not undergone formal independent third-party certification audits.
- **Risk Level**: `LOW RISK`
- **Classification**: `ACCEPTED LIMITATION` (`IMPLEMENTED / TESTED`)
- **Why Accepted**: Certification bodies require live operational history and external auditing firms.
- **Mitigation**: Compliance evidence packages (`src/lib/compliance/`) deterministically collect and verify evidence to streamline future audit engagements. Strictly non-certification compliant language is used across all documentation.
- **Production Impact**: Marketing and customer agreements must clarify that RecoverIQ is built with enterprise security controls, without claiming formal certification.
- **Future Phase**: Third-party external audit engagements.

---

### PR-005: Declarative Schema Synchronization (`prisma db push`)
- **Area**: Database Schema Management
- **Description**: Database schemas are managed declaratively using `prisma/schema.prisma` and synchronized via `prisma db push` rather than a sequential committed directory of raw SQL migration scripts (`prisma migrate dev`).
- **Risk Level**: `LOW RISK`
- **Classification**: `ACCEPTED LIMITATION` (`DEPLOYED`)
- **Why Accepted**: Fast iterative schema evolution across Phases 1 through 8.8.
- **Mitigation**: Schema changes are strictly additive; destructive operations are validated before execution.
- **Production Impact**: Production schema upgrades must run through staging verification to ensure zero unexpected data destruction.
- **Future Phase**: Transition to baseline SQL migration files via `prisma migrate deploy`.

---

### PR-006: External Cloud Provisioning Dependent on Operator Credentials
- **Area**: Cloud Infrastructure Provisioning
- **Description**: While the software stack is fully deployment-ready with production container and runbook definitions, actual external managed cloud endpoints (AWS RDS, AWS ElastiCache, Razorpay live merchant accounts) require operator-supplied credentials.
- **Risk Level**: `LOW RISK`
- **Classification**: `ACCEPTED LIMITATION` (`DEPLOYED / DEMO-VERIFIED`)
- **Why Accepted**: Standard SaaS deployment paradigm where client/operator provisions underlying cloud accounts.
- **Mitigation**: Environment validators verify all variables at startup and fail fast on invalid configurations.
- **Production Impact**: Operator must follow `docs/deployment/deployment-runbook.md` during cloud rollout.
- **Future Phase**: Automated Terraform / Pulumi declarative infrastructure modules.

---

### PR-007: Razorpay Live Execution Gated
- **Area**: Payment Gateway Execution
- **Description**: Live payment execution against production credit cards or UPI accounts is intentionally disabled and gated by configuration safeguards (`ALLOW_LIVE_PAYMENT_TESTS=false`, `rzp_test_` key enforcement in staging).
- **Risk Level**: `LOW RISK (BY DESIGN)`
- **Classification**: `ACCEPTED LIMITATION` (`CONTROLLED SAFETY GATE`)
- **Why Accepted**: Core Phase 9.0 requirement: Controlled demonstration must never perform unintended real money transactions.
- **Mitigation**: The system requires triple confirmation (`APP_ENV=production`, `RAZORPAY_KEY_ID=rzp_live_...`, `PAYMENT_EXECUTION_ENABLED=true`) before live payment requests can dispatch.
- **Production Impact**: Live recovery execution remains in standby until operator explicitly enables production mode.
- **Future Phase**: Phase 9.1+ production merchant pilot rollout.

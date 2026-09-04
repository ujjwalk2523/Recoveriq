# RecoverIQ

**Autonomous Payment Recovery Intelligence Platform**

RecoverIQ is a multi-tenant SaaS application architected for autonomous payment recovery intelligence. It integrates payment gateway orchestration, ML-assisted decisioning, contextual bandit learning, distributed background worker queues, and enterprise governance.

---

## Architectural Highlights

- **Authoritative Business State**: PostgreSQL is the single source of truth; all monetary values are represented as integer paise.
- **Disposable Coordination State**: Redis manages distributed worker leases and queues; queues are reconstructable from PostgreSQL.
- **Zero Duplicate Payment Safeguards**: Compound tenant-scoped idempotency keys (`idemp_{merchantId}_{txId}_{seqId}_{step}`) and mandatory provider reconciliation prevent duplicate charges during crashes or timeouts.
- **Enterprise Security & Tenancy**: Multi-tenant database partitioning, RBAC primacy, TOTP MFA, single-use recovery codes, and AES-256-GCM secret storage.
- **Governance & Compliance**: Tamper-evident append-only audit ledger with SHA-256 hash chaining, fail-closed preventive policy engine, and 180-day compliance evidence packages.
- **Disaster Recovery & Reliability**: 10-step recovery orchestrator, multi-domain restore verification, active dependency health probes, and graceful degradation.

> [!NOTE]
> RecoverIQ is built with a production-oriented, production-ready architecture. It implements internal enterprise security controls aligned with industry best practices without claiming external third-party certifications (e.g. SOC 2, ISO 27001, PCI-DSS) unless independently certified.

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Environment Configuration
Copy `.env.example` to `.env` and configure credentials:
```bash
cp .env.example .env
```

### Setup & Migrations
```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

### Development Server
```bash
npm run dev
```

### Background Recovery Worker
```bash
npm run worker
```

---

## Verification & Test Suites

```bash
# Run Phase 8.9 Production Readiness Suite
npm run test:phase8-9

# Run Phase 8.8 Disaster Recovery Suite
npm run test:phase8-8

# Run Phase 8.7 Governance & Audit Suites
npm run test:phase8-7-4
npm run test:phase8-7-3
npm run test:phase8-7-2
npm run test:phase8-7-1

# Full Type Check & Production Build
npx tsc --noEmit
npm run build
```

---

## Documentation

Comprehensive operational and architectural documentation:
- **System Inventory**: `docs/production-readiness/system-inventory.md`
- **Security Audit**: `docs/production-readiness/security-audit.md`
- **Production Configuration**: `docs/production-readiness/production-configuration.md`
- **Payment Safety**: `docs/production-readiness/payment-safety.md`
- **Database Readiness**: `docs/production-readiness/database-readiness.md`
- **Deployment & Rollback**: `docs/production-readiness/deployment-readiness.md`
- **Disaster Recovery Runbooks**: `docs/reliability/`
- **Accepted Limitations**: `docs/production-readiness/accepted-limitations.md`
- **Final Production Readiness Report**: `docs/production-readiness/FINAL-PRODUCTION-READINESS-REPORT.md`

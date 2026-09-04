# RecoverIQ — Phase 8.9 Deployment Readiness Audit

## 1. Deployment Lifecycle & Execution Pipeline

```text
[GIT PUSH / TAG]
       │
       ▼
[CI BUILD & TYPECHECK] ────> `npx tsc --noEmit` & `npm run build`
       │
       ▼
[DATABASE SCHEMA] ─────────> `npx prisma generate` & `npx prisma db push` (or migrate)
       │
       ▼
[SECRET VALIDATION] ───────> `parseAndValidateEnv()` verifies mandatory prod secrets
       │
       ▼
[APPLICATION START] ───────> Next.js web application starts on port 3000
       │
       ▼
[HEALTH PROBES] ───────────> Liveness `/api/health` & Readiness `/api/ready`
       │
       ▼
[WORKER STARTUP] ──────────> `DistributedRecoveryWorker` starts with graceful drain
```

---

## 2. Invariants During Deployment

1. **Zero Customer Mutation on Startup**:
   - Starting or restarting the web server or worker daemon never triggers automated payment transactions.
   - Startup hooks only inspect database connectivity, Redis connection, and cryptographic health.
2. **Graceful Worker Shutdown**:
   - When receiving `SIGTERM` or `SIGINT`, `shutdownCoordinator` triggers worker drain.
   - Active jobs are allowed up to `WORKER_SHUTDOWN_TIMEOUT_MS` to complete or release their leases.
3. **Database Migration Safety**:
   - Additive schema updates preserve backwards compatibility during rolling deployments.
   - Destructive database rollbacks (dropping tables or columns) are strictly prohibited in automated pipelines.

---

## 3. Rollback Procedures

| Scenario | Safe Rollback Procedure |
| :--- | :--- |
| **Application Bug / Bad Release** | Revert Git commit, redeploy previous stable container image. Additive database schema remains intact. |
| **Failed Migration** | Halt deployment; inspect schema diff; manual DBA remediation required. Zero automatic down-migrations. |
| **Worker Queue Corruption** | Flush Redis coordination queues; trigger `QueueRebuildService.rebuildQueuesFromPostgres()` to restore clean state. |
| **Provider Outage During Deploy** | Toggle `PAYMENT_EXECUTION_ENABLED=false` or let circuit breakers pause dispatch while web UI remains active. |

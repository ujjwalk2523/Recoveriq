# RecoverIQ — Phase 8.9 Observability & Telemetry Audit

## 1. Observability Architecture

RecoverIQ implements structured observability across application services, distributed workers, and asynchronous queues.

### Telemetry Stack
- **Structured JSON Logger (`src/lib/observability/logger.ts`)**:
  - Emits JSON logs with standard fields: `timestamp`, `level`, `service`, `environment`, `requestId`, `message`, `metadata`.
  - Automatic recursive redaction of sensitive credentials (`token`, `secret`, `password`, `key`, `cvv`).
- **Telemetry Collector (`src/lib/reliability/reliability/reliability-metrics.ts`)**:
  - Tracks real-time health across PostgreSQL, Redis, Razorpay, ML Engine, WhatsApp, and Email.
  - Computes Recovery Readiness Scores (0–100%) and RPO/RTO metrics against target SLAs.

---

## 2. Health & Readiness Probes

| Probe Endpoint | Purpose | Scope Checked | Failure Behavior |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | Liveness | Process is running and accepting HTTP requests | Returns 200 OK unless process is deadlocked |
| `GET /api/ready` | Readiness | PostgreSQL connectivity, Redis availability, schema migrations | Returns 503 Service Unavailable if critical dependencies fail |
| `GET /api/diagnostics` | Diagnostics | System version, uptime, memory, non-sensitive dependency state | Returns authenticated system diagnostics |
| `GET /api/reliability/status` | Reliability | Current recovery state, readiness score, target vs observed RPO/RTO | Returns real-time disaster recovery telemetry |

### Information Disclosure Guard
- Health and readiness endpoints **never** expose raw connection strings, passwords, JWT secrets, or unredacted stack traces.
- Error responses follow standard sanitized RFC 7807 problem details or minimal error status payloads.

---

## 3. Production Operational Metrics Catalog

| Metric Category | Specific Metrics Monitored | Target Production Threshold |
| :--- | :--- | :--- |
| **Payment Safety** | Duplicate execution attempts, crash post-dispatch detections | 0 duplicate payments |
| **Reconciliation** | Unknown provider state count, manual review queue size | Reconciled within 30 min |
| **Worker Health** | Queue depth, active workers, stale lease count | Stale leases < 1% |
| **Gateway Health** | Razorpay error rate, webhook latency, signature validation failures | Webhook processing < 2s |
| **Audit Ledger** | Hash chain verification pass rate, sequence gap alerts | 100% chain integrity |
| **Governance** | Policy evaluation latency, fail-closed enforcement count | P99 latency < 5ms |

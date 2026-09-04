# RecoverIQ — Production & Demo Operational Troubleshooting Guide

## 1. Operator Health & Triage Checklist

Operators should execute this quick checklist upon receiving alerts or prior to external demonstrations:

| Component | Verification Check | Command / URL | Expected State |
|---|---|---|---|
| **Web App** | HTTP Liveness | `GET /api/health` | `HTTP 200 {"status":"ok"}` |
| **Database** | Pool & Query Health | `GET /api/ready` | `checks.database: "ok"` |
| **Redis** | Ping & Coordination | `redis-cli PING` | `PONG` |
| **Workers** | Active Heartbeats | `GET /api/workers/status` | Active worker count ≥ 1 |
| **Razorpay** | Mode & Credentials | `GET /api/diagnostics` | `environment: "TEST" / "LIVE"` |
| **Queue** | Pending Backlog | `redis-cli LLEN recoveriq:queue:pending` | Backlog < 1,000 |
| **DLQ** | Dead-Letter Queue | `redis-cli LLEN recoveriq:queue:dlq` | Count = 0 |
| **Webhooks** | Signature & Processing | `tail -n 100 app.log \| grep webhook` | No 400 signature failures |

---

## 2. Common Operational Incidents & Triage

### Incident A: Webhook Signature Verification Failures (HTTP 400)
**Symptoms**: Inbound webhooks rejected with `Invalid webhook signature`.
**Root Causes**:
1. Secret mismatch between Razorpay dashboard webhook settings and `RAZORPAY_WEBHOOK_SECRET`.
2. Reverse proxy or middleware modifying the raw request body before HMAC calculation.
**Remediation**:
- Verify that `RAZORPAY_WEBHOOK_SECRET` matches the Razorpay dashboard string exactly.
- Ensure reverse proxy does not perform JSON re-serialization or gzip decompression before reaching Next.js route handlers.

### Incident B: Worker Lease Timeouts & Zombie Leases
**Symptoms**: A recovery sequence remains in `IN_PROGRESS` state without step execution.
**Root Causes**:
- Worker node crashed abruptly while holding the sequence lease.
**Remediation**:
- The lease key `recoveriq:lease:sequence:<id>` automatically expires after `WORKER_LEASE_TTL_MS` (30 seconds).
- Active workers will reclaim expired leases automatically on their next polling cycle.
- To force immediate release during an incident:
  ```bash
  redis-cli DEL recoveriq:staging:lease:sequence:<sequence_id>
  ```

### Incident C: Database Connection Pool Exhaustion
**Symptoms**: HTTP 500 errors reporting `Timed out fetching a connection from the pool`.
**Root Causes**:
- Web application instances scaled up beyond PostgreSQL `max_connections`, or PgBouncer socket saturation.
**Remediation**:
- Verify `DATABASE_URL` uses PgBouncer in transaction pooling mode.
- Increase connection pool limit or tune `connection_limit` parameter in Prisma connection string:
  `DATABASE_URL="...&connection_limit=20"`
- Check for long-running unindexed queries using `SELECT * FROM pg_stat_activity WHERE state = 'active';`.

### Incident D: Redis Connection Failure / Queue Stall
**Symptoms**: Worker logs warn: `[RedisClient] Connection refused. Retrying...`
**Impact**:
- Business data remains safe in PostgreSQL.
- Workers automatically pause and retry without throwing unhandled exceptions.
**Remediation**:
- Check Redis server status and network security groups.
- Once Redis is restored, workers auto-reconnect and rebuild the queue from PostgreSQL `RecoverySequence` records where `status = 'PENDING'`.

### Incident E: Dead-Letter Queue (DLQ) Accumulation
**Symptoms**: `recoveriq:queue:dlq` count > 0.
**Root Causes**:
- Corrupted or unparseable job payloads.
**Remediation**:
1. Inspect the DLQ payload:
   ```bash
   redis-cli LINDEX recoveriq:staging:queue:dlq 0
   ```
2. Diagnose whether the payload is invalid synthetic data or an unexpected gateway response.
3. Once the underlying bug is resolved, re-enqueue the sequence or resolve it via `/dashboard/recovery-opportunities`.

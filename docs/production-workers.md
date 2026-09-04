# RecoverIQ Production Distributed Worker Infrastructure

## Overview

RecoverIQ implements a distributed, decoupled background worker architecture using **Redis** for state coordination and **PostgreSQL** as the authoritative source of business truth.

```
                RECOVERIQ APPLICATION (Next.js)
                             │
                             ▼
                  Recovery Job Scheduler
                             │
                             ▼
                    ┌─────────────────┐
                    │      REDIS      │
                    │                 │
                    │ Delayed Jobs    │
                    │ Ready Queue     │
                    │ Retry State     │
                    │ Worker Leases   │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
             Worker 1     Worker 2     Worker N
                │            │            │
                └────────────┼────────────┘
                             ▼
                    Recovery Executor
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
           Razorpay      Payment Link    WhatsApp
                             │
                             ▼
                     Execution Ledger
                      (PostgreSQL)
```

---

## Key Invariants

1. **PostgreSQL Is Authoritative Business Truth**:
   - `Transaction` and `RecoveryAttempt` states reside in PostgreSQL.
   - Redis is ephemeral coordination infrastructure (delayed scheduling, ready queues, worker leases, distributed locks).
   - Redis never authorizes recovery actions, never marks transactions recovered, and never bypasses Phase 3 Policy Guardrails.
2. **Decoupled Architecture**:
   - Web application traffic (`Next.js`) is completely isolated from background job processing.
   - Workers run as independent stateless daemon processes (`src/worker.ts`) and scale horizontally.
3. **Idempotent Execution**:
   - Compound idempotency keys (`merchantId:txnId:sequenceId:stepNumber`) prevent duplicate payment actions even under worker crash/reclaim scenarios.

---

## Configuration & Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `REDIS_URL` | string | `redis://localhost:6379` | Connection URI for Redis cluster or instance. |
| `WORKER_ENABLED` | boolean | `true` | Enables worker queueing and processing. |
| `WORKER_CONCURRENCY` | number | `5` | Maximum concurrent recovery actions per worker process. |
| `WORKER_LEASE_TTL_MS` | number | `30000` | Lease duration granted to a worker on claim (30s). |
| `WORKER_HEARTBEAT_INTERVAL_MS`| number | `10000` | Interval for lease renewals and cluster health registration (10s). |
| `WORKER_POLL_INTERVAL_MS` | number | `1000` | Polling frequency for claiming ready jobs (1s). |

---

## Redis Persistence & High Availability Requirements

For production deployments:
- **Append Only File (AOF)**: Redis must be deployed with `appendonly yes` (`appendfsync everysec`) to ensure scheduled recovery jobs survive restarts.
- **Cluster or Sentinel**: Use AWS ElastiCache, GCP Memorystore with High Availability (Multi-AZ), or Redis Sentinel.
- **Memory Policy**: Set `maxmemory-policy noeviction` so delayed jobs and ready queue items are never prematurely evicted under memory pressure.

---

## Worker Process Lifecycle & Graceful Shutdown

Workers register signal handlers for `SIGTERM` and `SIGINT`:
1. Transitions worker status to `DRAINING`.
2. Stops claiming new ready jobs from Redis.
3. Allows in-flight recovery executions to finish within the bounded shutdown timeout (`WORKER_LEASE_TTL_MS`).
4. Disconnects from Redis cleanly.
5. If a worker process is abruptly killed, its lease expires after 30 seconds, and the `StaleJobRecoveryService` automatically returns the job to the `READY` queue for another healthy worker.

---

## Operational Monitoring & Metrics

- **Health Endpoint**: `GET /api/workers/health` (Requires `OWNER` or `ADMIN` authentication).
- Returns:
  - Active, healthy, degraded, and offline worker counts.
  - Ready, delayed, and dead-letter queue depths.
  - Zero internal credentials or secret leakage.

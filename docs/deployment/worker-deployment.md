# RecoverIQ — Dedicated Worker Deployment Architecture

## 1. Architectural Role & Invariants

The RecoverIQ Recovery Worker fleet is an autonomous background execution daemon decoupled from the Next.js HTTP server.

### Key Invariants:
1. **Never Inside Web Lifecycle**: Inbound webhooks and user clicks NEVER invoke long-running recovery loops or sleep intervals.
2. **Distributed Leases**: Sequence execution is protected by Redis distributed leases (`recoveriq:lease:sequence:<id>`). Only one worker executes a recovery sequence at any time.
3. **Graceful Heartbeats**: Workers renew active leases every `WORKER_HEARTBEAT_INTERVAL_MS` (default 10,000ms).
4. **Crash Recovery**: If a worker node experiences SIGKILL or physical node termination, its lease expires after `WORKER_LEASE_TTL_MS` (default 30,000ms). Surviving workers automatically detect and reclaim the orphaned sequence without duplicate execution.

---

## 2. Worker Command & Configuration

### Startup Commands
```bash
# In production container or supervisor:
npm run worker

# Direct Node execution:
node dist/worker.js
# Or with TSX runtime:
tsx src/worker.ts
```

### Worker Configuration Environment Variables
| Variable | Production Recommended | Description |
|---|---|---|
| `WORKER_ENABLED` | `true` | Must be `true` for worker instances to poll and process jobs. |
| `WORKER_CONCURRENCY` | `5` to `20` | Maximum number of parallel recovery sequences leased per node. |
| `WORKER_LEASE_TTL_MS` | `30000` (30s) | Redis lock expiration duration. |
| `WORKER_HEARTBEAT_INTERVAL_MS` | `10000` (10s) | Frequency of worker lease renewal pings. |
| `WORKER_POLL_INTERVAL_MS` | `1000` (1s) | Interval between polling cycles when queue is empty. |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | `8000` (8s) | Grace period allowed to finish in-flight steps before forceful exit. |

---

## 3. Database & Redis Connections

- **PostgreSQL**: Configured via `DATABASE_URL`. The worker uses Prisma client configured with a dedicated connection pool slice (recommended: 5–10 connections per worker process).
- **Redis**: Configured via `REDIS_URL`. Uses standard Redis client with auto-reconnect backoff (100ms exponential up to 3000ms).
  - If Redis becomes temporarily partitioned or unavailable, workers pause polling and log backoff notices.
  - On Redis reconnection, workers immediately poll PostgreSQL for any sequences in `PENDING` state to rebuild active queue indices.

---

## 4. Graceful Shutdown & Signal Traps

The worker process registers listeners on `SIGTERM` and `SIGINT`:
```typescript
process.on('SIGTERM', () => worker.shutdown('SIGTERM'));
process.on('SIGINT', () => worker.shutdown('SIGINT'));
```

### Shutdown Workflow:
1. Worker sets `isShuttingDown = true` to immediately cease leasing new sequences.
2. Worker finishes executing any currently active step whose payment request has already been dispatched.
3. If an action has not yet been submitted to the payment gateway, the sequence lock is cleanly released back to Redis so peer nodes can resume immediately.
4. Worker disconnects from Redis and database pools cleanly.
5. Process exits with code 0 within `WORKER_SHUTDOWN_TIMEOUT_MS`.

---

## 5. Supervisor & Container Specification

### Example Systemd Service (`recoveriq-worker.service`):
```ini
[Unit]
Description=RecoverIQ Distributed Recovery Worker Fleet
After=network.target

[Service]
Type=simple
User=recoveriq
WorkingDirectory=/opt/recoveriq
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15
EnvironmentFile=/etc/recoveriq/production.env

[Install]
WantedBy=multi-user.target
```

### Example Dockerfile Entrypoint for Worker:
```dockerfile
CMD ["npm", "run", "worker"]
```

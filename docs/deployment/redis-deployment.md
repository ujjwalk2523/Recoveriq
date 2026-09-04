# RecoverIQ — Redis Coordination Deployment Specification

## 1. Architectural Mandate: Redis as Disposable Coordination State

RecoverIQ strictly designates Redis as **ephemeral coordination infrastructure**.
- **PostgreSQL is the Sole Authoritative State**: Every financial record, customer debt, recovery decision, sequence progress, policy constraint, and audit event is durably committed to PostgreSQL before worker actions take effect.
- **Redis is Disposable**: If Redis crashes, is flushed, or experiences total data loss, **ZERO financial or business state is lost**.

### What Redis Stores:
1. **Worker Queues**: Pointers to sequence IDs awaiting execution (`recoveriq:queue:pending`).
2. **Distributed Mutexes & Leases**: TTL-bounded keys preventing simultaneous execution of the same recovery sequence (`recoveriq:lease:sequence:<id>`).
3. **Worker Heartbeats**: Node registration timestamps (`recoveriq:worker:heartbeat:<worker_id>`).
4. **Idempotency Keys**: Temporary rate-limiting and deduplication keys (`recoveriq:idempotency:<hash>`).
5. **Dead-Letter State**: Ephemeral alerts for unprocessable job payloads (`recoveriq:queue:dlq`).

---

## 2. Managed Redis Configuration

### Recommended Production Settings
- **Engine**: Redis 7.0+
- **Max Memory Policy**: `volatile-lru` or `noeviction` (do NOT use `allkeys-lru` as it may evict active locks prematurely).
- **Persistence**: AOF (Append Only File) recommended with `fsync everysec` for high coordination durability, although RDB snapshots are acceptable given disposable semantics.
- **TLS**: Required in production (`rediss://...`).
- **Connection URL Format**:
  ```bash
  REDIS_URL="rediss://:strong_auth_token@redis.recoveriq.internal:6379"
  ```

---

## 3. Resilience & Reconnection Behaviors

### Behavior A: Redis Unavailable at Startup
If Redis is unreachable when the web application or worker starts:
1. The web application logs a warning and routes fallback health checks (`/api/ready` marks Redis degraded if checked, while PostgreSQL remains ready).
2. The worker enters a resilient connection retry loop (exponential backoff: 500ms, 1000ms, 2000ms up to 10000ms).
3. The worker **DOES NOT crash loop or exit abruptly**. It logs structured warning events:
   `{"level":"WARN","message":"[RedisClient] Connection refused. Retrying in 1000ms..."}`

### Behavior B: Redis Mid-Flight Disconnection
If Redis goes down while a worker is processing jobs:
1. In-flight database transactions complete normally.
2. When the worker attempts to release or renew a lease, it detects the connection loss.
3. The worker aborts starting new steps until connection is restored.
4. When Redis comes back online, the worker reconnects automatically, queries PostgreSQL for all `RecoverySequence` records with `status = 'PENDING'`, and repopulates the Redis queue.

---

## 4. Key Namespace Convention

All keys in Redis are strictly namespaced by environment to prevent cross-contamination:
```
recoveriq:{APP_ENV}:queue:pending
recoveriq:{APP_ENV}:lease:sequence:{sequence_id}
recoveriq:{APP_ENV}:worker:heartbeat:{worker_id}
recoveriq:{APP_ENV}:idempotency:{key}
recoveriq:{APP_ENV}:dlq
```
In Staging / Demo:
`recoveriq:staging:lease:sequence:seq_123`
In Production:
`recoveriq:production:lease:sequence:seq_456`

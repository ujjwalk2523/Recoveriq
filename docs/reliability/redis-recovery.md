# Redis Recovery & Queue Reconstruction Runbook

## Overview
Procedures for managing complete Redis loss, empty restarts, and reconstructing background queues from authoritative PostgreSQL.

## Symptoms
- Redis connectivity failures, connection reset, or memory eviction panics.
- Workers log `ECONNREFUSED` or timeout errors on queue pop operations.

## Impact
- Background job queues and transient worker locks become inaccessible.
- Distributed worker execution pauses temporarily.
- Core HTTP API requests remain functional because business truth resides in PostgreSQL.

## Detection
- `RedisRecoveryService.checkRedisHealth()` returns `available: false`.
- Telemetry dashboard indicates Redis dependency status `UNAVAILABLE`.

## Safe Response
1. Background workers halt polling loops immediately.
2. In-flight leases are abandoned gracefully; no uncoordinated mutations are dispatched.
3. PostgreSQL remains protected as the source of truth.

## Recovery Sequence
1. Provision a new Redis instance or restart the existing container.
2. Run `QueueRebuildService.rebuildQueues({ dryRun: true })` to verify candidate counts.
3. Review candidate numbers: verify all terminal transactions (`RECOVERED`, `COMPLETED`, `SUPPRESSED`) are excluded.
4. Execute `RedisRecoveryService.reconstructQueuesFromPostgres({ dryRun: false })`.
5. Verify reconstructed jobs populate Redis ready queues with compound idempotency keys preserved.

## Verification
- Confirm candidate jobs rebuilt successfully into Redis.
- Confirm zero duplicate executions of previously completed transactions.

## Rollback & Manual Intervention
- Running `rebuildQueues()` is strictly idempotent. If interrupted, rerun safely.

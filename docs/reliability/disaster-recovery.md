# Platform Disaster Recovery Runbook

## Overview
Comprehensive operational runbook for platform-wide disaster events, outages, and state reconstruction.

## Symptoms
- Multiple subsystem health probe failures across PostgreSQL, Redis, or API workers.
- Platform health status degrades to `DEGRADED`, `FAILED`, or `MANUAL_INTERVENTION_REQUIRED`.
- Background recovery queues stall or worker leases experience mass expiration.

## Impact
- Autonomous payment recovery dispatches are automatically paused.
- In-flight webhooks or API requests may be delayed or buffered.
- Real-time analytics and decision generation pause.

## Detection
- Automated alert triggers on `/api/ready` or `/api/reliability/status`.
- Disconnected status reported by `DependencyHealthMonitor`.
- Metrics report elevated `staleJobCount` or `unknownPaymentCount`.

## Safe Response
1. **Freeze Execution (Fail-Closed)**: Immediately prevent automated retries or duplicate payment dispatches.
2. **Preserve PostgreSQL**: Ensure database read-only integrity if storage or connectivity is degraded.
3. **Quarantine In-Flight Jobs**: Do NOT blindly reschedule active worker jobs.

## Recovery Sequence
Follow the deterministic 10-step recovery orchestrator order:
1. Restore primary PostgreSQL or promote warm standby.
2. Validate configuration secrets and environment variables via `validateEnvironmentSafety()`.
3. Provision/flush Redis instance.
4. Execute `QueueRebuildService.rebuildQueues()` to reconstruct active jobs from PostgreSQL.
5. Spin up worker pool; let `WorkerRecoveryService` recover abandoned leases.
6. Run `PaymentReconciliationService` to reconcile uncertain in-flight transactions.
7. Process delayed or missing webhook events with `WebhookReconciliationService`.
8. Verify SaaS billing subscriptions and append-only usage ledger entries.
9. Validate contextual bandit memory and model heuristics.
10. Verify audit hash chains via `AuditRepository.verifyChain()`. Transition to `READY`.

## Verification
- Invoke `POST /api/reliability/verify-restore` and check that all checks pass.
- Confirm `duplicate payment count = 0`.
- Verify audit hash chains are unbroken.

## Rollback & Manual Intervention
- If payment reconciliation encounters conflicting provider states, escalate to `MANUAL_INTERVENTION_REQUIRED`.
- Never force an automatic transition if external gateway state cannot be verified.

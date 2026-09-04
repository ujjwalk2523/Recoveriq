# Deployment Failure & Safe Rollback Runbook

## Overview
Procedures for safely recovering from broken deployments, application runtime panics, or migration incompatibilities.

## Symptoms
- Elevated HTTP 500 rate immediately following production release.
- Application crash loops during startup or dependency initialization.
- Database migration errors or missing schema columns.

## Impact
- Inability to serve web requests or process recovery queue dispatches.

## Detection
- Canary deployment health check failure on `/api/ready`.
- Automated rollback triggered by CI/CD pipeline or orchestrator.

## Safe Response
1. Revert traffic to the previous stable release artifact.
2. Verify backward-compatible database schema state.
3. Restart background recovery workers.

## Recovery Sequence
1. Roll back application deployment to previous git SHA / container image.
2. Execute `DatabaseRecoveryService.verifyDatabaseHealth()` to confirm DB accessibility.
3. Validate schema compatibility: ensure no columns required by previous version were dropped.
4. Restart recovery workers in `RECOVERY_CHECK` mode.
5. Reconstruct transient queue state via `QueueRebuildService.rebuildQueues()`.
6. Reconcile any in-flight operations that were executing during the deployment failure.
7. Return system state to `READY`.

## Verification
- Confirm `/api/ready` returns HTTP 200 with all checks `ok`.
- Verify background worker queue processing resumes without errors.

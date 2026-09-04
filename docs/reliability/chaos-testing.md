# Deterministic Chaos Engineering & Failure Injection Guide

## Overview
Guidelines for executing controlled, deterministic failure injection scenarios to validate platform resilience without introducing random instability.

## Chaos Scenarios & Invariant Assertions

### Scenario A: PostgreSQL Primary Unavailable
- **Failure Injected**: Simulate database connection refusal via `DependencyHealthMonitor.setStatusOverride('POSTGRESQL', 'UNAVAILABLE')`.
- **Assertion**: All payment execution requests block with fail-closed errors. Zero partial mutations occur.

### Scenario B: Complete Redis Loss
- **Failure Injected**: Empty Redis instance; delete all keys.
- **Assertion**: Background workers pause safely. `QueueRebuildService.rebuildQueues()` restores active jobs from PostgreSQL. Duplicate payments = 0.

### Scenario C: All Background Workers Crash
- **Failure Injected**: Abruptly terminate worker processes, leaving active leases in Redis.
- **Assertion**: `WorkerRecoveryService.recoverAllStaleWorkerLeases()` reclaims leases. Jobs already captured externally are marked completed without re-execution.

### Scenario D: Worker Crash Immediately Post-Gateway Request
- **Failure Injected**: Simulate worker crash after Razorpay API receives capture request, before DB commit.
- **Assertion**: `PaymentReconciliationService` interrogates Razorpay. Payment identified as `captured`; local state updated to `RECOVERED`. Duplicate payments = 0.

### Scenario E: Webhook Delayed by 30 Minutes
- **Failure Injected**: Delay delivery of `payment.captured` webhook until after local reconciliation.
- **Assertion**: Webhook is acknowledged idempotently; does not cause duplicate state transitions or duplicate invoice receipts.

### Scenario F: Razorpay Gateway Outage
- **Failure Injected**: Gateway returns 503 or network timeout.
- **Assertion**: Recovery executor pauses payment dispatches; does not classify technical provider outage as customer failure.

### Scenario G: Deployment Failure & Rollback
- **Failure Injected**: Rollback application version.
- **Assertion**: Backward-compatible schema preserves operational continuity; workers resume cleanly.

### Scenario H: Database Restore from Backup
- **Failure Injected**: Restore snapshot into isolated environment and execute `RestoreVerificationEngine`.
- **Assertion**: Identity, Payments, Intelligence, Billing, and Audit ledger hash chains verify successfully.

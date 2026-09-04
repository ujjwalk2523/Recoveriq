# Worker Crash & Stale Lease Recovery Runbook

## Overview
Procedures for managing distributed background worker crashes, mid-flight failures, expired leases, and preventing duplicate payment execution.

## Symptoms
- Worker node terminates abruptly due to OOM, spot instance termination, or network partition.
- Active worker leases expire without completing the leased recovery jobs.

## Impact
- Jobs held by the crashed worker remain in `PROCESSING` status in Redis until lease expires.

## Detection
- `StaleJobRecoveryService` identifies jobs whose worker leases have expired (`Date.now() > lease.expiresAt`).
- Elevated `staleJobCount` in reliability telemetry.

## Safe Response
1. **Never assume payment did not happen**: An expired lease does NOT imply the payment was not captured by the external provider.
2. Interrogate the external payment provider first (`PaymentReconciliationService`).
3. Reconcile authoritative state before re-enqueuing or re-executing.

## Recovery Sequence
1. The recovery worker invokes `WorkerRecoveryService.recoverWorkerJob(jobId)`.
2. The service checks Razorpay provider state using the compound idempotency key.
3. If the provider reports `captured` / `paid`:
   - Mark the transaction and recovery attempt as `RECOVERED`.
   - Update job status to `COMPLETED` without re-executing.
   - Increment `duplicatePaymentPrevented` counter.
4. If the provider confirms `not_found` / `failed`:
   - Safely requeue the job into the Redis `readyQueue`.
5. If the provider returns `unknown` or times out:
   - Quarantine the job and flag `MANUAL_INTERVENTION_REQUIRED`.

## Verification
- Assert that `duplicate payment count = 0`.
- Verify all abandoned leases are reclaimed.

## Rollback & Manual Intervention
- For jobs in `MANUAL_INTERVENTION_REQUIRED`, access the manual review queue in `/settings/security/reliability` to inspect provider logs before manual resolution.

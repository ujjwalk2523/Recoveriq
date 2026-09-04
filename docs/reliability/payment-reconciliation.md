# Payment Reconciliation & Duplicate Prevention Runbook

## Overview
Procedures for resolving ambiguous, in-flight, or uncertain payment operations against external payment gateways (Razorpay).

## Symptoms
- Worker crash immediately following dispatch of payment request to gateway.
- Timeout or network disconnect during gateway response delivery.
- Customer payment status is uncertain between local datastore and external gateway.

## Impact
- Risk of duplicate charges if the uncertain payment is blindly retried.

## Detection
- `PaymentReconciliationResult` returns `outcome: UNKNOWN` or `outcome: CONFLICT`.
- Entries appear in the `manualReviewQueue`.

## Safe Response
1. **Zero Blind Retries**: Never retry an operation when provider state is unknown.
2. **Never Collapse UNKNOWN to FAILURE**: An unknown response must be quarantined, not treated as a failed transaction.

## Recovery Sequence
1. Query external provider API using `PaymentReconciliationService.reconcileTransaction()`:
   - Check payment ID, order ID, and payment link status.
2. Outcome Resolution Matrix:
   - `CONFIRMED_SUCCESS`: Provider captured the charge. Update local state to `RECOVERED` immediately. Safe to retry = FALSE.
   - `CONFIRMED_FAILURE`: Provider rejected the charge. Local state remains `FAILED`. Safe to retry = TRUE.
   - `NOT_FOUND`: Provider has no record of the charge. Safe to retry = TRUE.
   - `PENDING_PROVIDER`: Charge is currently processing. Do NOT retry; wait for settlement.
   - `UNKNOWN` / `CONFLICT`: Cannot establish state. Quarantine in `manualReviewQueue`.

## Verification
- Verify transaction status matches external provider status.
- Assert total duplicate payments = 0.

## Rollback & Manual Intervention
- Operators can resolve items via `POST /api/reliability/reconcile/:id` with `MARK_RECOVERED`, `SAFE_TO_RETRY`, or `ABANDON`.

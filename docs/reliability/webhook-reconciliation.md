# Webhook Reconciliation & Gap Detection Runbook

## Overview
Procedures for managing delayed, duplicate, missing, or out-of-order webhook events.

## Symptoms
- Customer payment was completed on gateway but dashboard reflects `FAILED` or `RECOVERING`.
- Duplicate webhook deliveries logged in access logs.
- Webhook events arrive out of order (e.g. `payment.failed` arrives after `payment.captured`).

## Impact
- Transient discrepancies between local database and payment gateway state.

## Detection
- `WebhookReconciliationService.detectGaps(thresholdMinutes)` flags events with status `MISSING`.
- Webhook idempotency layer logs duplicate signature deliveries.

## Safe Response
1. Webhooks are observational and idempotent; never treat webhook delivery as the sole source of truth.
2. Ignore out-of-order events that would revert terminal states.

## Recovery Sequence
1. For missing webhooks: invoke `PaymentReconciliationService.reconcileTransaction()` to pull authoritative state directly from gateway API.
2. For duplicate webhooks: acknowledge with HTTP 200 without reprocessing business mutations.
3. For late-arriving failure webhooks on already recovered transactions: mark `status: CONFLICT` and preserve the `RECOVERED` state.

## Verification
- Confirm all webhook delivery gaps are resolved (`detectGaps()` returns empty array).
- Verify transaction final state matches gateway authoritative records.

## Rollback & Manual Intervention
- If a webhook payload is corrupted or HMAC signature verification fails, reject with HTTP 400/401 and log security event.

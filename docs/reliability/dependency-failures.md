# External Dependency Failure Runbook

## Overview
Operational policy and failure response matrix for third-party infrastructure and external service outages.

## Dependency Matrix & Failure Responses

| Dependency | Criticality | Outage Response | Recovery Procedure |
|---|---|---|---|
| **PostgreSQL** | `CRITICAL` | Block all state-changing mutations with fail-closed 503. Pause background workers. | Restore standby instance, verify schema, validate audit hash chains. |
| **Redis** | `CRITICAL` | Pause distributed queue polling. Preserve PostgreSQL authoritative state. | Provision/restart Redis, reconstruct queues from DB via `QueueRebuildService`. |
| **Razorpay** | `CRITICAL` | Pause automated payment retries. Do NOT record customer failures. | Reconcile in-flight jobs via `PaymentReconciliationService` once gateway recovers. |
| **ML Service** | `NON_CRITICAL` | Fallback to deterministic heuristic strategy without blocking payments. | Validate feature store latency, verify model calibration, reload weights. |
| **WhatsApp API** | `NON_CRITICAL` | Queue customer notifications with exponential backoff. Fallback to SMS/link. | Drain buffered notification outbox once Meta Graph API responds. |
| **Email Gateway** | `NON_CRITICAL` | Buffer outbound emails in transactional outbox. | Drain buffered outbox upon SMTP/API restoration. |

## Verification
- Run `GET /api/reliability/dependencies` and assert all critical services report `HEALTHY`.
- Confirm heuristic fallback operated during ML outage without customer impact.

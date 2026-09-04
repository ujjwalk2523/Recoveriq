# Recovery Point & Recovery Time Objectives (RPO / RTO)

## Overview
Defines explicit, measurable recovery objectives across platform tiers and outlines continuous verification tracking.

## Objectives Definition Table

| Subsystem Domain | Criticality | Target RPO | Target RTO | Description |
|---|---|---|---|---|
| **PostgreSQL Database** | `TIER_0_CRITICAL` | &le; 5 minutes | &le; 30 minutes | Authoritative datastore for all platform tenants |
| **Payment Execution** | `TIER_0_CRITICAL` | 0 minutes | &le; 15 minutes | Zero lost transactions; reconciliation if uncertain |
| **Immutable Audit Ledger** | `TIER_0_CRITICAL` | 0 minutes | &le; 15 minutes | Cryptographic append-only compliance audit trail |
| **Redis Queues** | `TIER_1_ESSENTIAL` | 0 minutes | &le; 10 minutes | Reconstructable from PostgreSQL upon cold start |
| **Recovery Workers** | `TIER_1_ESSENTIAL` | 0 minutes | &le; 5 minutes | Disposable background compute processes |
| **Developer Webhooks** | `TIER_1_ESSENTIAL` | &le; 15 minutes | &le; 30 minutes | Inbound and outbound webhook delivery pipeline |
| **SaaS Billing & Invoices** | `TIER_2_OPERATIONAL` | &le; 5 minutes | &le; 60 minutes | Subscription state and invoice generation |

## Metric Measurement
- **RPO (Observed)**: Calculated as current elapsed time since the last verified database backup was initiated.
- **RTO (Observed)**: Measured as total duration required to complete the 5-domain isolated restore verification suite.
- Status is classified as `WITHIN_OBJECTIVE` or `BREACHED` in the reliability telemetry API (`GET /api/reliability/status`).

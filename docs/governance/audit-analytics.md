# RecoverIQ — Enterprise Audit Analytics Architecture (Phase 8.7.2)

## 1. Overview & Separation of Concerns

Phase 8.7.2 introduces the **Audit Analytics & Investigation Intelligence** layer built on top of the Phase 8.7.1 Immutable Audit Ledger.

The analytics engine operates under strict governance principles:
```text
Audit Ledger
= Immutable historical evidence (source of truth)

Audit Analytics
= Derived, read-only analysis of audit evidence

DecisionTrace
= AI/ML policy decision justification

Usage Ledger
= Commercial billing and accounting truth

RecoveryAttempt
= Payment execution state
```

### Critical Invariants
1. **Zero Write-Back**: Analytics calculations are derived dynamically and **never** mutate, update, or rewrite `AuditLog` records, sequence numbers, or SHA-256 hashes.
2. **Observational Invariance**: Analytics observations never alter business states or block autonomous payment retries.
3. **No Competing Store**: Analytics queries directly inspect PostgreSQL `AuditLog` rows or derived in-memory aggregates.

---

## 2. Standard Time Windows

- `LAST_24_HOURS`: 1-hour or 5-minute bucket intervals.
- `LAST_7_DAYS`: 6-hour or 1-day bucket intervals.
- `LAST_30_DAYS`: 1-day bucket intervals.
- `LAST_90_DAYS`: 1-day or 1-week bucket intervals.
- `CUSTOM`: Validated ISO 8601 UTC date bounds with `startDate < endDate` and max window enforcement (180 days).

---

## 3. Core Analytics Metrics

| Dimension | Metrics Computed |
| :--- | :--- |
| **Activity Overview** | Total events, success count, failure count, authorization denial count, critical/high severity count, unique actors, unique resources, unique sessions, unique API keys. |
| **Time Series** | Bucketed time-series volume points with success, failure, and denial breakdowns. |
| **Category Distribution** | Categorical breakdown across all 16 platform categories with percentage share. |
| **Action Ranking** | Top 25 most frequent business actions with success/failure/denial counts and latest timestamp. |
| **Actor Profiling** | Metrics by actor type (`USER`, `API_KEY`, `SYSTEM`, `WORKER`, `WEBHOOK`, `SERVICE`, `ANONYMOUS`), event volume, failure rates, and touched resources. |
| **Security Telemetry** | Authentication failure rate, MFA challenge failure rate, authorization denials, session revocations, password resets, and policy changes. |

---

## 4. Tenant & Merchant Isolation

All analytics endpoints derive tenant authority strictly from the authenticated session context (`context.organizationId || context.merchantId`). Query parameters cannot expand tenant scope; any attempt to supply a foreign `organizationId` is rejected with `403 Forbidden`.

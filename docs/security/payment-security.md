# RecoverIQ — Payment & Money Security Architecture

## 1. Authoritative Execution Chain
Payment operations can never be directly invoked from client-facing routes.
All payments must traverse the authoritative execution boundary:

```
Request / Worker
      │
      ▼
SecurityContext (Authenticated Principal)
      │
      ▼
Merchant/Tenant Authorization
      │
      ▼
Transaction Ownership & State (PostgreSQL)
      │
      ▼
Money Integrity Check (Integer paise, DB amount matches)
      │
      ▼
Idempotency Check (IdempotencyGuard)
      │
      ▼
Entitlement Check (EntitlementService)
      │
      ▼
Provider Account Status (ACTIVE)
      │
      ▼
Razorpay Environment (validateRazorpayEnvironmentCompatibility)
      │
      ▼
Policy Guardrails (High value, quiet hours, cooldowns)
      │
      ▼
RecoveryExecutor.executeAction()
      │
      ▼
ActionDispatcher → RazorpayRetryAdapter / PaymentLinkAdapter
      │
      ▼
RecoveryAttempt Ledger (PostgreSQL)
```

---

## 2. Money Integrity Invariants
- **Integer Minor Units (Paise)**: Floating point currencies are strictly prohibited. Every amount is verified via `validateIntegerPaise()`.
- **Zero Client Override**: When a recovery attempt is requested, the system queries the authoritative transaction record in PostgreSQL. Any amount provided in the request payload is reconciled against the database. Discrepancies immediately fail with `AMOUNT_TAMPERING_DETECTED` (HTTP 400).
- **Kill Switch**: Setting `PAYMENT_EXECUTION_ENABLED=false` halts all outbound payment executions immediately.
- **Automated Test Guard**: Setting `ALLOW_LIVE_PAYMENT_TESTS=false` guarantees tests never execute live payment transactions.

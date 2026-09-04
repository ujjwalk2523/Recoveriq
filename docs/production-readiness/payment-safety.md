# RecoverIQ — Phase 8.9 Payment Safety Audit

## 1. Zero Duplicate Payment Invariant

The paramount engineering invariant of RecoverIQ is:
> **Zero Duplicate Payments**: Under no condition—whether worker crash, network partition, Redis loss, or lease timeout—may RecoverIQ execute a duplicate payment for the same customer recovery attempt.

---

## 2. End-to-End Payment Path Audit

```text
               RECOVERY DECISION (Bandit / Strategy)
                                │
                                ▼
                       RECOVERY SEQUENCE
                                │
                                ▼
                         RECOVERY STEP
                                │
                                ▼
                        WORKER DISPATCH
                                │
                                ▼
                       IDEMPOTENCY GUARD
               (Deterministic Compound Key Check)
                                │
                     ┌──────────┴──────────┐
                     │ Already executed?   │
                    YES                    NO
                     │                     │
                     ▼                     ▼
              RETURN CACHED         LOCK LEASE &
                 RESULT            ACQUIRE MUTEX
                                           │
                                           ▼
                                 DISPATCH TO RAZORPAY
                                           │
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
                    CAPTURED            FAILED             UNKNOWN /
                        │                  │               TIMEOUT
                        ▼                  ▼                  │
                   RECORD AS           SCHEDULE               ▼
                   RECOVERED           NEXT STEP          RECONCILE
                                                        WITH PROVIDER
                                                              │
                                                   ┌──────────┴──────────┐
                                                   ▼                     ▼
                                               CONFIRMED             AMBIGUOUS /
                                                SUCCESS               NOT FOUND
                                                   │                     │
                                                   ▼                     ▼
                                               MARK AS                MANUAL
                                              RECOVERED            INTERVENTION
                                                                     REQUIRED
```

---

## 3. Compound Idempotency Key Architecture
- **Format**: `idemp_${merchantId}_${transactionId}_${sequenceId}_step${stepNumber}`
- **Properties**:
  - Deterministic: Re-evaluating the same sequence step produces the exact same key.
  - Multi-Tenant Scoped: Prefix includes `merchantId` to prevent cross-merchant collisions.
  - Granular: Step-indexed, allowing safe retries on subsequent sequence steps without collision.
- **Persistence**: Checked against both in-memory cache and PostgreSQL `RecoveryAttempt.idempotencyKey` before any network call.

---

## 4. Failure Mode Handling & Reconciliation

| Failure Mode | Scenario | System Behavior | Safety Outcome |
| :--- | :--- | :--- | :--- |
| **Concurrent Execution** | Multiple workers poll the same pending step | First worker acquires Redis lease; second worker gets `IdempotencyGuard` hit | Exactly one payment call dispatched |
| **Crash Pre-Dispatch** | Worker crashes after lease acquisition but before HTTP request | Lease expires after `WORKER_LEASE_TTL_MS`; step requeued; gateway shows `NOT_FOUND` | Safe retry executed |
| **Crash Post-Dispatch** | Worker crashes after gateway captures payment but before DB update | Worker restarts; detects stranded transaction; polls Razorpay; finds `captured` | Marked `RECOVERED`; no retry dispatched |
| **Provider Timeout** | Network disconnects during payment request; status unknown | Recovery engine enters `UNKNOWN` state; queries provider status | Automated retries halted |
| **Provider Ambiguity** | Gateway returns conflicting or unresolvable status | Escalates to `MANUAL_INTERVENTION_REQUIRED` queue | Halts automated execution; alerts operator |

### The Critical Rule
```text
UNKNOWN PROVIDER STATE MUST NEVER BE RETRIED AUTOMATICALLY.
IT MUST BE RECONCILED OR ESCALATED TO MANUAL REVIEW.
```

---

## 5. Merchant Recovery vs SaaS Billing Separation
- **Credentials**: Merchant recovery uses `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. RecoverIQ subscription billing uses `RAZORPAY_BILLING_SECRET_KEY`.
- **Webhooks**:
  - `/api/webhooks/razorpay`: Verifies with merchant webhook secret; updates `Transaction` records.
  - `/api/webhooks/billing/razorpay`: Verifies with billing webhook secret; updates `Subscription` records.
- **Transactions**: Merchant recovery records never touch SaaS billing accounts, and subscription invoices never touch merchant customer ledgers.

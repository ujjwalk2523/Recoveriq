# RecoverIQ — Production & Controlled Demo Deployment Architecture

## 1. System Overview

RecoverIQ is an autonomous, multi-tenant payment recovery intelligence platform. It ingests failed payment events, analyzes failure root causes, calculates recovery probabilities, determines expected net recovery values, formulates recovery action sequences, executes recovery actions within governance policies, and learns continuously from payment telemetry.

The system is architected around strict operational separation:
1. **Web Request Lifecycle (Next.js Application)**: Handles API requests, operator UI, developer portals, authentication, and inbound payment webhooks. Never executes blocking recovery actions or sleeps.
2. **Authoritative State (Managed PostgreSQL)**: The sole source of truth for organizations, merchants, transactions, recovery sequences, attempts, policies, customer profiles, and immutable audit logs.
3. **Coordination Infrastructure (Managed Redis)**: Disposable distributed state for worker job queues, distributed locks, lease heartbeats, and rate-limiting. Redis failure never corrupts business data.
4. **Autonomous Execution (Dedicated Worker Process)**: Scalable worker fleet operating outside the web request lifecycle, leasing jobs from Redis/PostgreSQL, evaluating governance guardrails, and invoking provider adapters.
5. **Payment Provider Integration (Razorpay TEST MODE)**: Controlled external execution boundary operating under strict test-mode safety gates.

---

## 2. Infrastructure Topology

```
                                  INTERNET
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
         [ Operator / Browser ]             [ Razorpay Webhooks ]
                    │                                 │
                    │ HTTPS                           │ HTTPS
                    ▼                                 ▼
      ┌─────────────────────────────────────────────────────────────┐
      │               Next.js Web Application Fleet                 │
      │  - Route Handlers (/api/v1, /api/webhooks, /api/health)     │
      │  - Tenant Context & RBAC Middleware                         │
      │  - Webhook Ingestion & HMAC-SHA256 Signature Verification   │
      │  - Intelligence Decision Engine & Policy Evaluator          │
      └──────────────┬───────────────────────────────┬──────────────┘
                     │                               │
             SQL / Pooling                   Queue Push / Job State
                     │                               │
                     ▼                               ▼
       ┌───────────────────────────┐   ┌───────────────────────────┐
       │     Managed PostgreSQL    │   │       Managed Redis       │
       │  (Authoritative Storage)  │   │  (Disposable Coordination)│
       │  - Organizations & Users  │   │  - Job Queues             │
       │  - Transactions & Events  │   │  - Distributed Leases     │
       │  - Recovery Sequences     │   │  - Worker Heartbeats      │
       │  - Customer Profiles      │   │  - Idempotency Locks      │
       │  - Cryptographic Audit    │   │  - DLQ (Dead-Letter Queue)│
       └─────────────▲─────────────┘   └─────────────▲─────────────┘
                     │                               │
             SQL Read / Write                Job Pull / Leases
                     │                               │
      ┌──────────────┴───────────────────────────────┴──────────────┐
      │           Dedicated Worker Process Fleet (Node.js)          │
      │  - DistributedRecoveryWorker Engine                         │
      │  - Lease Renewal & Crash Recovery Handlers                  │
      │  - Policy Safety & High-Ticket Approval Gates               │
      │  - Contextual Bandit Proposal & Attribution                 │
      └──────────────────────────────┬──────────────────────────────┘
                                     │
                             Outbound HTTPS API
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    Razorpay Gateway API     │
                      │       [ TEST MODE ]         │
                      │   Key: rzp_test_...         │
                      │   Live Execution: DISABLED  │
                      └─────────────────────────────┘
```

---

## 3. Boundary & State Invariants

| Component | Responsibility | Failure Mode / Resilience |
|---|---|---|
| **Next.js Web** | UI rendering, webhook ingestion, tenant auth, API endpoints. | Stateless; can autoscale horizontally behind a load balancer. If an instance crashes, another handles the next request. |
| **PostgreSQL** | Authoritative transaction records, customer memory, recovery plans, immutable audit ledger. | Primary-replica clustering with connection pooling (e.g. PgBouncer / Neon). RPO ≤ 1 min, RTO ≤ 15 mins. |
| **Redis** | Ephemeral job distribution, worker leases, distributed mutexes. | If Redis is flushed or unavailable, workers reconstruct pending jobs from PostgreSQL (`RecoverySequence.status = 'PENDING'`). |
| **Recovery Worker** | Step-by-step execution of scheduled recovery actions, retry scheduling, reconciliations. | Distributed workers operate with distributed leases (`WORKER_LEASE_TTL_MS = 30000`). If a worker dies, its lease expires and another worker safely reconciles and resumes. |
| **Razorpay Adapter** | Outbound API calls to create payment links, verify transactions, check payment statuses. | Operates in TEST MODE (`rzp_test_...`). Live execution is hard-gated by `PAYMENT_EXECUTION_ENABLED=true` AND `APP_ENV=production` AND live key format checks. |

---

## 4. Network and Security Boundaries

1. **Ingress Protection**:
   - Web application exposed on TCP 443 (HTTPS) only.
   - Database (TCP 5432) and Redis (TCP 6379) are isolated in a private Virtual Private Cloud (VPC) / subnet with restricted security groups.
2. **Worker Isolation**:
   - Worker processes run in the private subnet with outbound HTTPS access to Razorpay endpoints and internal access to PostgreSQL and Redis.
   - Workers accept no incoming HTTP/TCP connections from the public Internet.
3. **Strict Credential Segregation**:
   - Web and Worker processes share identical environment configurations for DB, Redis, and Gateway keys.
   - Secret keys are never serialized to the client bundle or included in Next.js public runtime configs.

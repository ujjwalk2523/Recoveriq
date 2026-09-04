# RecoverIQ — Controlled Demo Runbook

## 1. Demo Mission & Principles

The RecoverIQ product narrative is:
```
FAILED PAYMENT 
      ↓
UNDERSTAND WHY (Diagnosis & Error Taxonomy)
      ↓
PREDICT RECOVERY PROBABILITY (ML Recovery Probability Engine)
      ↓
CALCULATE ECONOMIC VALUE (Expected Net Recovery net of fatigue & cost)
      ↓
CHOOSE BEST RECOVERY ACTION (Contextual Bandit & Strategy Deck)
      ↓
OPTIMIZE SEQUENCE (Adaptive Multi-Step Scheduling)
      ↓
APPLY GOVERNANCE (Policy Guardrails, Risk Gates, High-Value Approval)
      ↓
EXECUTE SAFELY (Distributed Worker Fleet with Razorpay Test Mode)
      ↓
MEASURE OUTCOME (Attribution & Proof of Recovery)
      ↓
LEARN (Continuous Profile Update & Model Recalibration)
```

RecoverIQ is **NOT** a simple "blind retry" loop. It is an intelligent decisioning and governance platform for payment recovery.

---

## 2. Pre-Demo Setup & Synthetic Tenant

### Demo Tenant Details
- **Organization / Merchant**: SaaSify Technologies India Pvt Ltd (`mer_saasify_blr`)
- **Demo Users**:
  - Owner: `owner@saasify.in` (Full access & governance)
  - Admin: `merchant@saasify.in` (Operations & configuration)
  - Analyst: `analyst@saasify.in` (Intelligence & audit review)
  - Operator: `ops@saasify.in` (Recovery action approvals)
- **PII Policy**: Strictly synthetic customer profiles (e.g. `Ananya Rao`, `Rohan Sharma`), fictional phone numbers (`+919876543210`), and test email domains (`@saasify-demo.local`).

### Seeding Demo Data
To initialize or restore deterministic demo state:
```bash
npx prisma db seed
# Or via safe reset:
npx tsx scripts/demo-reset.ts --confirm
```

---

## 3. Step-by-Step 18-Stage Demo Flow

### Stage 1: Start Web Application
```bash
npm run start
# Runs Next.js web application on port 3000
```

### Stage 2: Start Dedicated Worker Process
```bash
npm run worker
# Boots DistributedRecoveryWorker listening on Redis queues and PostgreSQL
```

### Stage 3: Verify Environment Mode
Navigate to `/api/health` or `/api/diagnostics`.
Verify:
```json
{
  "environment": "staging",
  "razorpay": {
    "environment": "TEST",
    "executionEnabled": true,
    "keyPrefix": "rzp_test_"
  }
}
```

### Stage 4: Log In to Operator Dashboard
1. Open `http://localhost:3000/login`.
2. Sign in as `owner@saasify.in` (or `merchant@saasify.in`) with password `password123`.

### Stage 5: Select Demo Organization
Confirm active organization switcher displays **SaaSify Technologies India Pvt Ltd**.

### Stage 6: Generate Controlled Test Payment
Trigger a test transaction via the demo payment injector or Developer API:
```bash
POST /api/v1/recovery-sequences/test
```
Amount: ₹4,500 INR | Customer: `cust_demo_ananya`

### Stage 7: Trigger Failure Webhook
Simulate a failed card charge (`BAD_REQUEST_ERROR / insufficient_funds`) via Razorpay webhook.

### Stage 8: Inspect Diagnosis
In `/dashboard/transactions`:
- Observe failure categorization: `INSUFFICIENT_FUNDS`
- Root cause diagnosis: "Customer card account temporarily has insufficient balance; high recovery probability via alternate UPI payment link."

### Stage 9: Inspect Recovery Probability
- View ML prediction confidence score: `84.2%`
- Feature contribution highlights: Time of day (evening), customer historical recovery rate (high), failure category (soft decline).

### Stage 10: Inspect Expected Net Recovery (ENR)
- Recoverable Value: ₹4,500
- Gateway & Notification Cost: ₹15
- Customer Fatigue Cost: ₹25
- **Expected Net Recovery**: ₹3,764

### Stage 11: Inspect Selected Strategy
- Strategy recommended: `SMART_PAYMENT_LINK_WHATSAPP`
- Scheduled Execution Delay: 2 hours (optimized for user response window).

### Stage 12: Inspect Recovery Sequence
- Navigate to `/dashboard/sequences`.
- View multi-step recovery sequence `seq_demo_...`.
- Step 1: Automated Payment Link via WhatsApp (Immediate).
- Step 2: Fallback SMS Reminder (T+4 hours).
- Step 3: Card Account Auto-Retry (T+24 hours).

### Stage 13: Inspect Policy Decision
- Policy Guardrail Check:
  - Max automated retry threshold: 3/week (Current: 1) -> **PASSED**
  - High-ticket approval threshold: ₹15,000 (Current: ₹4,500) -> **AUTO-APPROVED**
  - Dispute risk limit: 60% (Current: 12%) -> **PASSED**

### Stage 14: Inspect Worker Execution
- In worker stdout:
  `[Worker] Leased sequence seq_demo_...`
  `[Worker] Executing Step 1: SMART_PAYMENT_LINK_WHATSAPP`
  `[Worker] Dispatched test payment link plink_demo_... to customer`

### Stage 15: Inspect Outcome Attribution
- Simulate customer payment capture via Razorpay webhook `payment.captured`.
- Sequence transitions to `COMPLETED`.
- RecoveryAttempt transitions to `SUCCESS`.
- Recovered Amount: ₹4,500 recorded in SaaSify recovery total.

### Stage 16: Inspect Immutable Audit Ledger
- Navigate to `/dashboard/audit`.
- Verify cryptographic event chain:
  1. `WEBHOOK_RECEIVED`
  2. `DIAGNOSIS_COMPUTED`
  3. `SEQUENCE_CREATED`
  4. `POLICY_EVALUATED`
  5. `ATTEMPT_EXECUTED`
  6. `RECOVERY_ATTRIBUTED`
- Verify SHA-256 hash chaining links each event sequentially.

### Stage 17: Inspect Customer Memory & Learning Update
- Navigate to Customer Recovery Profile:
  - Total recovered payments incremented.
  - Customer responsiveness to WhatsApp payment link updated to `92%`.
  - Future sequence recommendations dynamically prioritize WhatsApp over email.

### Stage 18: Inspect Analytics & ROI Dashboard
- Navigate to `/dashboard`.
- Real-time metrics reflect:
  - Total Recovered Volume: +₹4,500
  - Net Recovery Rate: 78.4%
  - Average Time to Recovery: 2.1 hours

---

## 4. Specific Demonstration Scenarios (A through G)

### Scenario A — Standard Failed Payment Flow
Demonstrated via Stages 6 through 18 above.

### Scenario B — High-Value Payment (Policy Approval Gate)
1. Inject a failed payment of ₹25,000 (Exceeds ₹15,000 policy threshold).
2. AI recommends immediate recovery.
3. Policy Engine overrides automatic execution: Sequence transitions to `REQUIRES_APPROVAL`.
4. The worker **WILL NOT EXECUTE** the payment link until an `OWNER` or `ADMIN` clicks "Approve" in the dashboard.
5. Invariant Verified: **AI Recommendation ≠ Authorization. Policy Governs Execution.**

### Scenario C — Fraud / High Risk Block
1. Inject a payment with `RISK_LEVEL = HIGH` or `FAILURE_REASON = suspected_fraud`.
2. Intelligence Engine tags sequence as `DO_NOT_RECOVER`.
3. Worker aborts sequence; zero payment links or retries are dispatched to prevent disputes.

### Scenario D — Worker Failure & State Uncertainty
1. Worker leases a job and sends request to Razorpay.
2. Worker process is abruptly killed (`kill -9`).
3. Surviving worker leases expired job after lease TTL expires.
4. Worker checks gateway status before initiating any retry:
   - If payment is already captured: Marks recovery complete, NO duplicate charge.
   - If payment failed: Moves safely to next step.
   - If payment state uncertain: Holds sequence in `MANUAL_REVIEW`.

### Scenario E — Customer Recovery Memory
1. Observe customer `cust_demo_rohan` who previously failed 3 card retries but paid immediately on UPI.
2. New failed payment arrives for Rohan.
3. Engine consults customer profile memory and bypasses card retry entirely, issuing instant UPI link.

### Scenario F — Contextual Bandit Safety
1. Bandit exploration engine proposes novel recovery action timing.
2. Proposed action passes through `PolicyGuardrailEngine`.
3. If the bandit recommendation violates merchant fatigue or frequency rules, policy strictly rejects it and reverts to deterministic default.

### Scenario G — Billing Separation
1. Merchant customer recovery transaction (₹4,500 recovered for SaaSify) is recorded under merchant accounts.
2. RecoverIQ SaaS subscription billing (₹9,999/mo SaaS platform fee) is tracked under RecoverIQ subscription ledger.
3. Invariant Verified: **Merchant end-customer recovery payments NEVER commingle with RecoverIQ SaaS subscription charges.**

# RecoverIQ — Razorpay Test Mode & Webhook Specification

## 1. Test Mode Operational Status

In Demo and Staging deployments, RecoverIQ operates strictly in **Razorpay TEST MODE**:
- `PAYMENT_ENVIRONMENT = TEST`
- `LIVE EXECUTION = DISABLED`
- Gateway API Key Prefix: `rzp_test_`
- Real customer payment instruments (credit cards, debit cards, UPI VPA addresses) are strictly prohibited.

---

## 2. Credential Configuration

In Staging / Demo environments, the operator configures:
```bash
APP_ENV=staging
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
PAYMENT_EXECUTION_ENABLED=true
ALLOW_LIVE_PAYMENT_TESTS=false
```

### Safety Guardrails:
- If `APP_ENV=production` is paired with an `rzp_test_` key, the system aborts at startup.
- If `APP_ENV=staging` is paired with an `rzp_live_` key, the system aborts at startup.
- This guarantees zero probability of accidental live charges during demo execution.

---

## 3. Webhook Architecture & Event Processing

Inbound webhooks are received at:
`POST https://<domain>/api/webhooks/razorpay`

### Security & Ingestion Pipeline:
```
Raw HTTP POST Body (Buffer/Text)
       │
       ▼
[ Signature Extraction ]  --> Header: 'X-Razorpay-Signature'
       │
       ▼
[ HMAC-SHA256 Computation ] --> crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
       │
       ▼
[ Timing-Safe Verification ] --> crypto.timingSafeEqual(computedHash, receivedHash)
       │
       ▼
[ Idempotency Deduplication ] --> Check Redis/PostgreSQL for duplicate webhook event_id
       │
       ▼
[ Business Event Mapping ] --> Map to RecoverIQ Internal Events
       │
       ▼
[ Intelligence & Sequence Engine ] --> Diagnosis, Scoring, Policy & Sequence Creation
```

---

## 4. Supported Webhook Event Types

| Razorpay Event | RecoverIQ Action | Pipeline Triggered |
|---|---|---|
| `payment.failed` | Logs payment failure, extracts error code & reason. | Diagnosis -> ML Recovery Score -> Policy Evaluation -> Recovery Sequence Scheduled |
| `payment.authorized` | Notes authorization hold. | Awaits capture confirmation. |
| `payment.captured` | Validates successful payment capture. | Marks RecoveryAttempt `SUCCESS`, completes Sequence, updates Customer Profile memory, dispatches attribution. |
| `order.paid` | Confirms full settlement of an order. | Synchronizes order recovery status. |
| `refund.processed` | Telemetry recording of refund. | Excluded from positive recovery attribution. |
| `dispute.created` | Flags risk alert on customer profile. | Increases customer dispute risk score; policy prevents future automated retries. |

---

## 5. Webhook Setup in Razorpay Dashboard

1. Navigate to: **Razorpay Dashboard > Settings > Webhooks > Add Webhook**.
2. Webhook URL: `https://<YOUR_DEPLOYED_DOMAIN>/api/webhooks/razorpay`
3. Secret: Enter the exact secret string stored in `RAZORPAY_WEBHOOK_SECRET`.
4. Alert Email: Enter operations or on-call email address.
5. Select all 6 event categories listed above.
6. Click **Save Webhook**.

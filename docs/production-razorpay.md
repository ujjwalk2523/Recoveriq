# RecoverIQ — Production Razorpay Operations Manual

## 1. Overview
RecoverIQ interfaces with Razorpay in production (`APP_ENV=production`) using Razorpay Live credentials (`rzp_live_...`).
All payment executions flow through the authoritative execution pipeline:
```
Worker -> RecoveryExecutor -> ActionDispatcher -> RazorpayClient -> RecoveryAttempt
```

Webhook ingestion flows into:
```
POST /api/webhooks/razorpay -> HMAC Verification -> Environment Check -> Idempotency -> PostgreSQL
```

SaaS billing runs on completely distinct credentials via `/api/webhooks/billing/razorpay`.

---

## 2. Production Environment Variables
| Variable | Description | Requirement | Example Prefix |
|---|---|---|---|
| `APP_ENV` | Application environment | Must be `production` | `production` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_LIVE_KEY_ID` | Live Razorpay Key ID | Mandatory in production | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_LIVE_KEY_SECRET` | Live Razorpay Secret | Mandatory in production | (Live secret key) |
| `RAZORPAY_WEBHOOK_SECRET` / `RAZORPAY_LIVE_WEBHOOK_SECRET` | Authoritative Live Webhook Secret | Mandatory in production | `whsec_...` |
| `PAYMENT_EXECUTION_ENABLED` | Operational Kill Switch | Optional, defaults `true` | `true` or `false` |
| `ALLOW_LIVE_PAYMENT_TESTS` | Test Guard | Defaults `false` (Fail-closed) | `false` |
| `RECOVERIQ_SECRET_ENCRYPTION_KEY` | AES-256-GCM Key | 32-byte secret for SecretStore | (Base64 / Hex string) |

> **IMPORTANT**: If `APP_ENV=production` and `RAZORPAY_KEY_ID` begins with `rzp_test_`, the application **aborts startup immediately** with a configuration error.

---

## 3. Webhook Setup
1. In the Razorpay Dashboard under **Settings > Webhooks**, create an active webhook pointing to:
   `https://<recoveriq-domain>/api/webhooks/razorpay`
2. Subscribe to the events:
   - `payment.failed`
   - `payment.captured`
   - `order.paid`
3. Set the Secret to your configured `RAZORPAY_LIVE_WEBHOOK_SECRET`.
4. RecoverIQ enforces constant-time HMAC-SHA256 signature verification, replay protection (max age 300s), and environment validation.

---

## 4. Multi-Tenant Secret Storage
Merchant-specific credentials are never stored as plaintext in PostgreSQL columns.
The `SecretStore` wraps credentials using authenticated **AES-256-GCM** encryption:
- Key derived from `RECOVERIQ_SECRET_ENCRYPTION_KEY`.
- PostgreSQL records only store opaque references (e.g. `sec_ref_rzp_mer_123_LIVE_...`).
- Decryption happens exclusively in-memory on the backend server.

---

## 5. Emergency Operational Kill Switch
If an upstream gateway incident occurs, payment recovery execution can be immediately halted across all workers without restarting workers or dropping webhooks:
```bash
# In deployment configuration / orchestration:
PAYMENT_EXECUTION_ENABLED=false
```
**Effect**:
- Webhook ingestion continues normally.
- Payment state and PostgreSQL transactions remain 100% intact.
- Outbound mutations (`IMMEDIATE_RETRY`, `PAYMENT_LINK`, etc.) are halted fail-closed by `assertPaymentExecutionAllowed`.

---

## 6. Credential Rotation Procedure
To rotate Razorpay Live credentials:
1. Generate a new Key Pair in the Razorpay Dashboard (Razorpay supports dual active keys during transition).
2. For system-level credentials:
   - Set `RAZORPAY_LIVE_KEY_ID` and `RAZORPAY_LIVE_KEY_SECRET` to the new key.
   - Perform a rolling restart of the application and worker processes.
   - Verify connectivity via `GET /api/diagnostics`.
   - Decommission the old key in the Razorpay Dashboard.
3. For tenant-specific provider accounts:
   - Call `PaymentProviderAccountService.rotateCredentials(merchantId, 'LIVE', newCredentials)`.
   - The `SecretStore` atomically updates the ciphertext and increments the version.

---

## 7. Pre-Deployment Verification Checklist
- [ ] `APP_ENV=production`
- [ ] `RAZORPAY_KEY_ID` begins with `rzp_live_`
- [ ] `RAZORPAY_WEBHOOK_SECRET` does not contain `test`
- [ ] `PAYMENT_EXECUTION_ENABLED=true`
- [ ] `ALLOW_LIVE_PAYMENT_TESTS=false`
- [ ] PostgreSQL connection healthy
- [ ] Redis cluster connected (`REDIS_URL`)
- [ ] Standalone worker process running (`npm run worker`)

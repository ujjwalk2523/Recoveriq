# RecoverIQ — Razorpay Environment Isolation Architecture

## 1. Principles
RecoverIQ enforces strict isolation between application runtime environments and payment provider environments:

| Application Environment (`APP_ENV`) | Permitted Razorpay Mode | Key Prefix Allowed | Live Keys Allowed |
|---|---|---|---|
| `development` | `TEST` | `rzp_test_` | ❌ BLOCKED |
| `test` | `TEST` | `rzp_test_` | ❌ BLOCKED |
| `staging` | `TEST` | `rzp_test_` | ❌ BLOCKED |
| `production` | `LIVE` | `rzp_live_` | ✅ REQUIRED |

---

## 2. Fail-Closed Boundary Controls

### 2.1 Startup Validation
- `parseAndValidateEnv()` and `validateEnvironmentSafety()` validate credential prefixes during process initialization.
- Startup fails closed before any HTTP request or worker can process.

### 2.2 Execution Gate
Before any outbound payment mutation, `assertPaymentExecutionAllowed()` verifies:
1. `PAYMENT_EXECUTION_ENABLED !== false` (Operational Kill Switch)
2. `ALLOW_LIVE_PAYMENT_TESTS !== false` (Prevents test suites from invoking live APIs)
3. Application environment matches target Razorpay provider environment
4. Tenant entitlement via `EntitlementService`

### 2.3 Webhook Ingestion Gate
- `validateWebhookEnvironment()` inspects incoming payloads:
  - Production drops any `pay_test_` / `order_test_` payload with HTTP 422.
  - Non-production drops any `pay_live_` / `order_live_` payload with HTTP 422.
- Constant-time HMAC-SHA256 signature verification prevents tampering.
- Freshness timestamp check (max age 300s) prevents replay attacks.

---

## 3. Credential Decoupling
Merchant recovery credentials:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

RecoverIQ SaaS billing credentials:
- `RAZORPAY_BILLING_SECRET_KEY`
- `RAZORPAY_BILLING_WEBHOOK_SECRET`

These credential sets are completely isolated and managed independently.

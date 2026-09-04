# RecoverIQ — Webhook Security Architecture

## 1. Overview
RecoverIQ processes inbound webhooks from Razorpay and emits outbound developer webhooks.

---

## 2. Inbound Razorpay Webhook Invariants
- **Endpoint**: `/api/webhooks/razorpay` (Merchant recovery) & `/api/webhooks/billing/razorpay` (RecoverIQ SaaS billing).
- **HMAC Signature**: Constant-time verification using HMAC-SHA256 (`x-razorpay-signature`).
- **Replay Protection**: Payloads with timestamps older than 300 seconds are rejected with HTTP 400.
- **Environment Isolation**:
  - In production (`LIVE`): Inbound test webhooks (`pay_test_...`) are rejected with HTTP 422.
  - In non-production (`TEST`): Inbound live webhooks (`pay_live_...`) are rejected with HTTP 422.
- **Deduplication**: `RazorpayWebhookService` logs the event ID in `WebhookEvent` to ensure deduplication.
- **SaaS Billing Segregation**: Merchant recovery webhooks cannot mutate SaaS subscriptions, and billing webhooks cannot trigger recovery retry sequences.

---

## 3. Outbound Developer Webhooks
- **Signature**: Generated via HMAC-SHA256 using merchant-specific secret (`whsec_...`).
- **SSRF Defense**: Destination URLs must pass `assertSafeUrl()`. Private networks, loopbacks, and cloud metadata are blocked.

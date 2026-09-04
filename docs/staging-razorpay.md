# RecoverIQ — Staging Environment Razorpay Guide

## 1. Purpose
The **Staging** environment (`APP_ENV=staging`) mirrors production configuration, Docker containers, workers, and Redis topology, while strictly restricting all payment interactions to Razorpay Test Mode.

---

## 2. Invariants
- **Razorpay Environment**: Always `TEST`.
- **Live Credentials Prohibited**: If any key starting with `rzp_live_` is configured, staging startup **fails immediately**.
- **Real Money**: Zero real financial transactions can occur in staging.

---

## 3. Configuration
```env
APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.recoveriq.internal
DATABASE_URL=postgresql://staging_user:secret@postgres.internal:5432/recoveriq_staging
REDIS_URL=redis://redis.internal:6379

# Razorpay Test Credentials
RAZORPAY_KEY_ID=rzp_test_staging_key
RAZORPAY_KEY_SECRET=rzp_test_staging_secret
RAZORPAY_WEBHOOK_SECRET=whsec_test_staging_webhook_secret

# SaaS Billing (Separate)
RAZORPAY_BILLING_SECRET_KEY=rzp_test_billing_secret
RAZORPAY_BILLING_WEBHOOK_SECRET=rzp_test_billing_whsec

PAYMENT_EXECUTION_ENABLED=true
WORKER_ENABLED=true
```

---

## 4. Webhook Setup for Staging
1. Point Razorpay Test Mode webhooks to:
   `https://staging.recoveriq.internal/api/webhooks/razorpay`
2. Validate that events ingested carry `dataSource: 'RAZORPAY_TEST'`.
3. If an event bearing a `pay_live_...` ID is sent to staging, it is rejected with HTTP 422 `LIVE webhook payload rejected in TEST non-production environment.`

# RecoverIQ — Security Incident Response Runbook

## 1. Emergency Kill Switch
If suspicious outbound payment behavior is observed:
1. In the application environment or deployment orchestration, set:
   ```bash
   PAYMENT_EXECUTION_ENABLED=false
   ```
2. **Effect**: All recovery payment mutations immediately fail closed via `assertPaymentExecutionAllowed()`.
3. Inbound webhooks, customer tracking, and PostgreSQL state remain 100% operational.

---

## 2. API Key Compromise
1. Identify the compromised API key ID.
2. Invalidate immediately:
   `POST /api/developer/keys/{id}/revoke`
3. Revocation is instantaneous across all API gateways.

---

## 3. Webhook Secret Compromise
1. In the Razorpay Dashboard, generate a new active webhook secret.
2. Update `RAZORPAY_WEBHOOK_SECRET` across all application instances.
3. Verify incoming signatures via structured logs.

---

## 4. Master SecretStore Key Rotation
1. Update `RECOVERIQ_SECRET_ENCRYPTION_KEY` in deployment environment variables.
2. Invoke `SecretStore.rotateSecret()` across stored credentials.

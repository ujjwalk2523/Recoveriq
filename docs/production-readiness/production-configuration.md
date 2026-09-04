# RecoverIQ — Phase 8.9 Production Configuration Audit

## 1. Environment Variable Classification Catalog

Every configuration variable defined or consumed across RecoverIQ is classified below:

| Variable Name | Scope | Security Class | Environment Requirement | Usage & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `APP_ENV` | SERVER_ONLY | PUBLIC | REQUIRED | Application environment (`development`, `test`, `staging`, `production`) |
| `NEXT_PUBLIC_APP_URL` | PUBLIC | PUBLIC | REQUIRED | Base URL for redirects, emails, and web UI |
| `DATABASE_URL` | SERVER_ONLY | SECRET | REQUIRED | PostgreSQL connection string (Neon / Self-hosted) |
| `REDIS_URL` | SERVER_ONLY | SECRET | REQUIRED if worker enabled | Redis 7 connection string for worker coordination |
| `JWT_SECRET` | SERVER_ONLY | SECRET | REQUIRED | Cryptographic key for signing user authentication tokens |
| `SESSION_SECRET` | SERVER_ONLY | SECRET | REQUIRED | Cryptographic seed for user session derivation |
| `API_ENCRYPTION_KEY` | SERVER_ONLY | SECRET | REQUIRED | Master key for developer API secrets and `SecretStore` |
| `RECOVERIQ_SECRET_ENCRYPTION_KEY` | SERVER_ONLY | SECRET | OPTIONAL (defaults to API_ENCRYPTION_KEY) | Master key for provider credentials and MFA vault |
| `RAZORPAY_KEY_ID` | SERVER_ONLY | SECRET | REQUIRED in live/dev | Merchant recovery Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | SERVER_ONLY | SECRET | REQUIRED in live/dev | Merchant recovery Razorpay API Secret |
| `RAZORPAY_WEBHOOK_SECRET` | SERVER_ONLY | SECRET | REQUIRED | Secret for validating inbound merchant payment webhooks |
| `RAZORPAY_TEST_KEY_ID` | SERVER_ONLY | SECRET | TEST_ONLY | Explicit test key for non-production environments |
| `RAZORPAY_TEST_KEY_SECRET` | SERVER_ONLY | SECRET | TEST_ONLY | Explicit test secret for non-production environments |
| `RAZORPAY_TEST_WEBHOOK_SECRET` | SERVER_ONLY | SECRET | TEST_ONLY | Explicit test webhook secret for non-production environments |
| `RAZORPAY_LIVE_KEY_ID` | SERVER_ONLY | SECRET | LIVE_ONLY | Live production Razorpay Key ID |
| `RAZORPAY_LIVE_KEY_SECRET` | SERVER_ONLY | SECRET | LIVE_ONLY | Live production Razorpay Key Secret |
| `RAZORPAY_LIVE_WEBHOOK_SECRET` | SERVER_ONLY | SECRET | LIVE_ONLY | Live production webhook validation secret |
| `RAZORPAY_BILLING_SECRET_KEY` | SERVER_ONLY | SECRET | REQUIRED in production | SaaS subscription billing secret (isolated from merchant keys) |
| `RAZORPAY_BILLING_WEBHOOK_SECRET`| SERVER_ONLY | SECRET | REQUIRED in production | SaaS subscription billing webhook secret |
| `PAYMENT_EXECUTION_ENABLED` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to true) | Global kill-switch for automated payment retries |
| `ALLOW_LIVE_PAYMENT_TESTS` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to false)| Safety flag strictly required to run live tests |
| `ML_SERVICE_URL` | SERVER_ONLY | PUBLIC | OPTIONAL | Endpoint for standalone ML microservice |
| `WORKER_ENABLED` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to false)| Flag to run background recovery worker daemon |
| `WORKER_CONCURRENCY` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to 5) | Concurrency limit for distributed recovery workers |
| `WORKER_LEASE_TTL_MS` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to 30000)| Worker lease TTL for crash recovery |
| `LOG_LEVEL` | SERVER_ONLY | PUBLIC | OPTIONAL (INFO in prod) | Log verbosity level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `WEBHOOK_TIMEOUT_MS` | SERVER_ONLY | PUBLIC | OPTIONAL (defaults to 5000) | Outbound webhook HTTP timeout |

---

## 2. Environment Separation & Payment Safeguards

RecoverIQ strictly isolates test and live environments in `src/lib/config/env.ts`:

### Strict Live vs Test Guardrails
1. **Production Startup Verification**:
   - If `APP_ENV === 'production'`:
     - Fails closed if any mandatory secret is missing (`DATABASE_URL`, `SESSION_SECRET`, `API_ENCRYPTION_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `REDIS_URL`).
     - Fails closed if `RAZORPAY_KEY_ID.startsWith('rzp_test_')`. Test credentials can **never** be used in production.
     - Fails closed if `RAZORPAY_WEBHOOK_SECRET.includes('test')`.
2. **Non-Production Protection**:
   - If `APP_ENV !== 'production'`:
     - Fails closed if `RAZORPAY_KEY_ID.startsWith('rzp_live_')`. Live payment credentials can **never** be loaded in development, testing, or staging environments unless `ALLOW_LIVE_PAYMENT_TESTS=true` is explicitly configured.

---

## 3. Secret Leakage Audit
- Zero production secrets are hardcoded in source code or committed to Git.
- Sample `.env` files use explicit dummy markers (`rzp_test_recoveriq_demo`, `change_in_prod`).
- No sensitive configuration variables are prefixed with `NEXT_PUBLIC_`.

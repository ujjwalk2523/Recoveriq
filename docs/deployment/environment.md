# RecoverIQ — Environment Variable Audit & Configuration Matrix

## 1. Classification Methodology

Every environment variable utilized by RecoverIQ is classified across five dimensions:
- **Scope**: `PUBLIC` (bundled into client UI) vs. `SERVER_ONLY` (retained within backend process memory).
- **Sensitivity**: `SECRET` (cryptographic keys, credentials, connection tokens) vs. `CONFIG` (timeouts, concurrency, flags).
- **Mandatory Status**: `REQUIRED` (service will fail startup if missing) vs. `OPTIONAL` (safe fallbacks defined).
- **Environment Affinity**: `COMMON` (all environments), `TEST_ONLY` (dev/test/staging only), or `LIVE_ONLY` (production only).

---

## 2. Environment Variable Matrix

| Variable Name | Scope | Sensitivity | Status | Affinity | Default / Allowed Value | Description |
|---|---|---|---|---|---|---|
| `APP_ENV` | `SERVER_ONLY` | `CONFIG` | `REQUIRED` | `COMMON` | `development`, `test`, `staging`, `production` | Active deployment environment. Controls safety guardrails. |
| `NODE_ENV` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `development`, `production`, `test` | Node.js standard environment indicator. |
| `NEXT_PUBLIC_APP_URL` | `PUBLIC` | `CONFIG` | `REQUIRED` | `COMMON` | `http://localhost:3000` (Dev) / `https://app.recoveriq.io` | Canonical base URL for webhook redirection and links. |
| `DATABASE_URL` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | `postgresql://...` | PostgreSQL connection string with SSL parameters. |
| `REDIS_URL` | `SERVER_ONLY` | `SECRET` | `REQUIRED`* | `COMMON` | `redis://...` or `rediss://...` (TLS) | Redis connection URL for distributed queues and locks. (*Required when `WORKER_ENABLED=true`). |
| `REDIS_CONNECTION_TIMEOUT_MS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `3000` | Redis socket connection timeout in milliseconds. |
| `REDIS_COMMAND_TIMEOUT_MS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `5000` | Redis individual command execution timeout. |
| `SESSION_SECRET` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | 32+ byte string | Secret used for sealing session cookies and auth tokens. |
| `JWT_SECRET` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | 32+ byte string | Secret used for signing and verifying JWT tokens. |
| `API_ENCRYPTION_KEY` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | 32-byte hex/raw key | AES-256-GCM key for encrypting merchant credentials at rest. |
| `RECOVERIQ_SECRET_ENCRYPTION_KEY`| `SERVER_ONLY`| `SECRET` | `REQUIRED` | `COMMON` | 32-byte key | Master envelope key for the organization credential vault. |
| `RAZORPAY_KEY_ID` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | `rzp_test_...` (Demo) / `rzp_live_...` (Prod) | Gateway API Key ID. Format strictly enforced per `APP_ENV`. |
| `RAZORPAY_KEY_SECRET` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | Alphanumeric secret | Gateway API Secret for authenticating outbound calls. |
| `RAZORPAY_WEBHOOK_SECRET` | `SERVER_ONLY` | `SECRET` | `REQUIRED` | `COMMON` | Alphanumeric secret | Webhook HMAC-SHA256 signature verification secret. |
| `RAZORPAY_TEST_KEY_ID` | `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `TEST_ONLY` | `rzp_test_...` | Explicit test key override. Prohibited in production. |
| `RAZORPAY_TEST_KEY_SECRET` | `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `TEST_ONLY` | Secret | Explicit test secret override. Prohibited in production. |
| `RAZORPAY_TEST_WEBHOOK_SECRET`| `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `TEST_ONLY` | Secret | Explicit test webhook secret override. |
| `RAZORPAY_LIVE_KEY_ID` | `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `LIVE_ONLY` | `rzp_live_...` | Explicit live key override. Prohibited in non-production. |
| `RAZORPAY_LIVE_KEY_SECRET` | `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `LIVE_ONLY` | Secret | Explicit live secret override. Prohibited in non-production. |
| `RAZORPAY_LIVE_WEBHOOK_SECRET`| `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `LIVE_ONLY` | Secret | Explicit live webhook secret override. |
| `PAYMENT_EXECUTION_ENABLED` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `true` or `false` | Master kill switch for all recovery payment executions. |
| `ALLOW_LIVE_PAYMENT_TESTS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `LIVE_ONLY` | `false` | Must remain `false` unless explicitly authorized for canary testing. |
| `WORKER_ENABLED` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `true` or `false` | Dictates if worker polling processes are enabled. |
| `WORKER_CONCURRENCY` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `5` | Number of parallel jobs processed per worker node. |
| `WORKER_LEASE_TTL_MS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `30000` | Lease duration for recovery sequence lock. |
| `WORKER_HEARTBEAT_INTERVAL_MS`| `SERVER_ONLY`| `CONFIG` | `OPTIONAL` | `COMMON` | `10000` | Lease heartbeat renewal frequency. |
| `WORKER_POLL_INTERVAL_MS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `1000` | Queue poll frequency when idle. |
| `WEBHOOK_TIMEOUT_MS` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `5000` | Inbound webhook timeout limit. |
| `LOG_LEVEL` | `SERVER_ONLY` | `CONFIG` | `OPTIONAL` | `COMMON` | `INFO` (Prod) / `DEBUG` (Dev) | Structured logging output granularity. |
| `GEMINI_API_KEY` | `SERVER_ONLY` | `SECRET` | `OPTIONAL` | `COMMON` | API Key string | Optional GenAI key for enhanced diagnostic explanations. |

---

## 3. Environment Isolation Rules

### Rule 1: Production Strict Secret Enforcement
When `APP_ENV=production`:
1. `DATABASE_URL`, `SESSION_SECRET`, `API_ENCRYPTION_KEY`, and `RECOVERIQ_SECRET_ENCRYPTION_KEY` MUST be provided.
2. Razorpay keys MUST NOT begin with `rzp_test_`.
3. Webhook secrets MUST NOT contain `test` or start with `whsec_test`.
4. If `WORKER_ENABLED=true`, `REDIS_URL` MUST be configured.
5. If any violation occurs, application bootstrap throws a fatal `[ConfigError]` and exits immediately.

### Rule 2: Non-Production Live Credential Blocker
When `APP_ENV` is `development`, `test`, or `staging`:
1. Razorpay keys MUST NOT begin with `rzp_live_`.
2. Any attempt to supply a live production Razorpay key triggers an immediate fatal startup abortion.
3. This guarantees that test scripts or demo transactions CANNOT trigger real financial movements.

---

## 4. Secret Sanitization & Safety Verification

1. **Repository Audit**:
   - Git tracking verifies that `.env`, `.env.local`, and `.env.production` are strictly listed in `.gitignore`.
   - `.env.example` contains only synthetic placeholders.
2. **Log Redaction**:
   - `AuditRedactor` and logger interceptors sanitize authorization headers, webhook payloads, PANs, CVVs, UPI IDs, and token secrets before emitting JSON log lines.
3. **Bundle Isolation**:
   - Only variables prefixed with `NEXT_PUBLIC_` are exposed to the client JavaScript bundle. All backend keys remain completely invisible to the browser.

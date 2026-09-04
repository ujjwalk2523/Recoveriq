# RecoverIQ — Developer API Security Architecture

## 1. Overview
RecoverIQ exposes developer APIs under `/api/v1/` authenticated via API keys (`rk_test_...` or `rk_live_...`).

---

## 2. API Key Invariants
- **Secret Hash**: Raw secrets are revealed exactly once upon creation. Only constant-time SHA-256 hashes (`secretHash`) are persisted in PostgreSQL.
- **Timing-Safe Verification**: Verification uses `crypto.timingSafeEqual` to eliminate side-channel timing attacks.
- **Environment Prefixes**:
  - `rk_test_...` is strictly bound to `TEST` environments.
  - `rk_live_...` is strictly bound to `LIVE` environments.
  - Cross-environment usage aborts with HTTP 401 `ENVIRONMENT_MISMATCH`.
- **Revocation & Expiration**: Revoked or expired keys fail closed immediately.
- **Scope Enforcement**: Every API route validates required scopes (e.g. `recovery:execute`, `transactions:read`).

---

## 3. Rate Limiting & Idempotency
- **Sliding Window**: Default 120 requests/minute (scaled dynamically with SaaS subscription plan).
- **Persistent Idempotency**: Developers provide `Idempotency-Key` headers. Cached successful responses are replayed; mismatched bodies with the same idempotency key return HTTP 409 `IDEMPOTENCY_CONFLICT`.
- **Tenant-Scoped Idempotency**: Keys are stored as compound hashes (`merchantId:endpoint:key`).

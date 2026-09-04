# RecoverIQ — Production Security Verification Checklist

This checklist tracks all security controls implemented and verified in Phase 8.4.

---

## 1. Authentication
- [x] [PASS] HttpOnly, Secure, SameSite=Lax session cookies enforced
- [x] [PASS] Fixed HS256 JWT algorithm verification (rejects `none` and mismatched algorithms)
- [x] [PASS] Absolute session expiration (7 days) enforced
- [x] [PASS] Idle session timeout (4 hours) enforced
- [x] [PASS] Server-side session revocation list on logout
- [x] [PASS] Session rotation on authentication (anti-session fixation)
- [x] [PASS] Rate limiting on login attempts (5 fails per 15-minute window)
- [x] [PASS] Account enumeration defense (generic `Invalid credentials` error)

---

## 2. Authorization & RBAC
- [x] [PASS] Centralized SecurityContext abstraction (`USER_SESSION`, `API_KEY`, `INTERNAL_WORKER`, `WEBHOOK_PROVIDER`, `SYSTEM`)
- [x] [PASS] Least-privilege RBAC role hierarchy (`OWNER > ADMIN > OPERATOR > ANALYST`)
- [x] [PASS] Guardrail policy modifications restricted to `OWNER` / `ADMIN`
- [x] [PASS] Diagnostics endpoint restricted to `OWNER` / `ADMIN`
- [x] [PASS] Authorization never inferred from untrusted request body fields

---

## 3. Tenant Isolation & IDOR Defense
- [x] [PASS] Multi-tenant scoping on transactions, customers, recovery sequences, and attempts
- [x] [PASS] Cross-tenant access attempts return HTTP 403 / 404
- [x] [PASS] Tenant-scoped database mutations enforced (`TenantSecurityGuard.assertTenantScope`)
- [x] [PASS] Zero blind `where: { id }` queries on tenant-owned models

---

## 4. API Key Security
- [x] [PASS] Only constant-time SHA-256 hashes stored in database
- [x] [PASS] Timing-safe verification (`crypto.timingSafeEqual`)
- [x] [PASS] Environment prefix isolation (`rk_test_` vs `rk_live_`)
- [x] [PASS] Revoked API keys fail immediately
- [x] [PASS] Expired API keys fail immediately
- [x] [PASS] Granular API scope enforcement before business operations

---

## 5. Web Application & CSRF
- [x] [PASS] Double-submit CSRF cookie & header validation for browser state-changing requests
- [x] [PASS] Origin / Referer validation against allowed domains
- [x] [PASS] API key and webhook routes correctly excluded from browser CSRF
- [x] [PASS] Production security headers applied (`CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`)
- [x] [PASS] XSS string sanitization and character escaping

---

## 6. Rate Limiting
- [x] [PASS] Login attempt throttling (IP and account)
- [x] [PASS] Developer API sliding window rate limiting
- [x] [PASS] Standard HTTP 429 and `Retry-After` headers returned
- [x] [PASS] Redis rate limiter with in-memory fallback

---

## 7. SSRF Protection
- [x] [PASS] Webhook URLs validate protocol (HTTPS required)
- [x] [PASS] Localhost and 127.0.0.1 blocked
- [x] [PASS] Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) blocked
- [x] [PASS] Cloud metadata endpoints (169.254.169.254, metadata.google.internal) blocked
- [x] [PASS] IPv6 loopback (::1) blocked
- [x] [PASS] Non-HTTP protocols (`file://`, `ftp://`, `javascript:`, `data:`) blocked

---

## 8. Payment & Money Security
- [x] [PASS] Integer paise validation (`validateIntegerPaise`)
- [x] [PASS] Floating point amounts, NaN, Infinity, negative values rejected
- [x] [PASS] Authoritative transaction amount reconciliation from PostgreSQL (zero client overrides)
- [x] [PASS] Client cannot directly invoke gateway operations
- [x] [PASS] All payments route through `RecoveryExecutor.executeAction()`
- [x] [PASS] Operational kill switch (`PAYMENT_EXECUTION_ENABLED=false`) halts execution
- [x] [PASS] Automated test safety guard (`ALLOW_LIVE_PAYMENT_TESTS=false`) prevents live payments in tests

---

## 9. Webhook Security
- [x] [PASS] Constant-time HMAC-SHA256 signature verification
- [x] [PASS] Webhook replay protection (max age 300 seconds)
- [x] [PASS] Webhook environment isolation (test payloads rejected in live, live payloads rejected in test)
- [x] [PASS] Webhook event deduplication via `WebhookEvent` ledger
- [x] [PASS] SaaS billing webhooks isolated from merchant payment recovery webhooks

---

## 10. Workers & Redis Security
- [x] [PASS] Redis jobs treated as untrusted coordination data
- [x] [PASS] Redis cannot authorize payment execution
- [x] [PASS] Worker validates PostgreSQL business state before executing
- [x] [PASS] Stale jobs (already recovered transactions) dropped safely
- [x] [PASS] Zero plaintext secrets stored in Redis

---

## 11. Secrets Management
- [x] [PASS] Authenticated AES-256-GCM encryption for provider credentials (`SecretStore`)
- [x] [PASS] 12-byte random IVs and 16-byte authentication tags
- [x] [PASS] Tampered ciphertext aborts decryption
- [x] [PASS] Database persists only opaque reference strings (`sec_ref_...`)
- [x] [PASS] Atomic credential rotation with versioning

---

## 12. Logging & Error Handling
- [x] [PASS] Structured JSON logging
- [x] [PASS] Automatic secret masking (API keys, webhook secrets, tokens, passwords, cookies)
- [x] [PASS] Database and Redis URLs masked in log outputs
- [x] [PASS] Customer PII masked in log outputs
- [x] [PASS] Production errors sanitized (`ApplicationError.toSafeResponse`), zero stack traces exposed

---

## 13. Audit & Security Events
- [x] [PASS] Security events recorded via `SecurityEventService`
- [x] [PASS] Tamper-evident SHA-256 integrity hashes on audit logs
- [x] [PASS] Actions tracked: `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `API_KEY_CREATED`, `API_KEY_REVOKED`, `ROLE_CHANGED`, `RECOVERY_APPROVED`, `POLICY_CHANGED`
- [x] [PASS] Zero plaintext secrets in audit metadata

# RecoverIQ — Zero-Trust Security Threat Model

## 1. Overview
RecoverIQ is a multi-tenant autonomous payment-recovery SaaS platform.
This document catalogs threat vectors, attack surfaces, implemented controls, tests, and residual risks across the platform.

---

## 2. Threat Catalog

### 2.1 Authentication Threats
| Threat | Attack Surface | Existing Protection | New Protection (Phase 8.4) | Automated Test | Residual Risk |
|---|---|---|---|---|---|
| **Stolen Session** | Stolen browser cookie | HttpOnly cookie | Short-lived JWT (7d), idle timeout (4h), server-side revocation list | `Domain 1: Expired/revoked session rejected` | Compromised client device |
| **JWT Tampering** | Modified claims in cookie | HMAC signature | Fixed `HS256` algorithm verification, rejects `none`, signed with 32-byte secret | `Domain 1: Tampered JWT signature fails` | Server secret key compromise |
| **Session Fixation** | Pre-auth session reuse | Session cookie | Session rotated to new `sessionId` upon login | `Domain 1: Session rotation verified` | Stored credentials on public device |
| **Credential Stuffing / Brute Force** | `POST /api/auth/login` | None | IP and account-based rate limiter (5 fails / 15 mins) | `Domain 5: Login brute force throttled` | Distributed low-and-slow botnet |
| **Account Enumeration** | `POST /api/auth/login` | Detailed errors | Uniform `Invalid credentials` error, identical response time | `Domain 5: Generic credentials error` | Timing variance on bcrypt hash |

### 2.2 Authorization & Multi-Tenancy Threats
| Threat | Attack Surface | Existing Protection | New Protection (Phase 8.4) | Automated Test | Residual Risk |
|---|---|---|---|---|---|
| **Insecure Direct Object Reference (IDOR)** | `/api/v1/transactions/[id]`, `/api/transactions/[id]` | Tenant filter in DB query | Centralized `requireMerchantAccess` and `requireResourceOwnership` asserting merchant ownership | `Domain 2: Cross-tenant access returns 403/404` | None |
| **Cross-Tenant Access** | Bulk mutations, reports | Scoped queries | `TenantSecurityGuard.assertTenantScope` requires `merchantId` in mutation where clauses | `Domain 2: Cross-tenant mutation blocked` | Raw DB admin access |
| **Role Privilege Escalation** | Guardrail settings, API keys | RBAC helper | Strongly typed role hierarchy: `OWNER > ADMIN > OPERATOR > ANALYST`. Policy modification restricted to `OWNER`/`ADMIN` | `Domain 2: Role escalation rejected (403)` | Compromised admin account |
| **Scope Escalation** | Developer API endpoints | Header checking | Explicit `requireScope` with typed scope catalog | `Domain 3: Insufficient scope rejected (403)` | Over-privileged API key generation |

### 2.3 Payment & Money Threats
| Threat | Attack Surface | Existing Protection | New Protection (Phase 8.4) | Automated Test | Residual Risk |
|---|---|---|---|---|---|
| **Amount Tampering** | Client payment payloads | None | `validateIntegerPaise` validates whole integer paise; `RecoveryExecutor` checks authoritative amount in PostgreSQL | `Domain 6: Amount tampering rejected` | Upstream provider currency conversion |
| **Direct Execution Bypass** | `/api/payments/retry` | Gateway simulation | Route converted to authenticate tenant, verify DB transaction, and delegate strictly to `RecoveryExecutor` | `Domain 6: Execution bypass blocked` | None |
| **Duplicate Payment Execution** | Worker retries, network glitches | `IdempotencyGuard` | Compound keys (`merchant:txn:seq:step`), atomic Redis lock | `Domain 6: Duplicate payment suppressed` | DB connection failure during recording |
| **Stale Worker Execution** | Distributed worker queue | Redis lease | Worker inspects PostgreSQL state and drops already-recovered transactions | `Domain 11: Stale worker job suppressed` | Redis state corruption |
| **Forged Webhook** | `/api/webhooks/razorpay` | HMAC-SHA256 | Constant-time HMAC comparison, replay protection (300s window), environment mismatch drop | `Domain 7: Webhook signature & replay checked` | Webhook secret disclosure |
| **Cross-Environment Webhook** | Production webhook to test | None | `validateWebhookEnvironment` rejects `pay_test_` in prod and `pay_live_` in test | `Domain 7: Cross-environment webhook dropped` | None |

### 2.4 Web Application Threats
| Threat | Attack Surface | Existing Protection | New Protection (Phase 8.4) | Automated Test | Residual Risk |
|---|---|---|---|---|---|
| **Cross-Site Request Forgery (CSRF)** | Browser state-changing APIs | SameSite=Lax | Double-submit CSRF cookie & `x-csrf-token` header verification; strict Origin / Referer check | `Domain 4: CSRF token missing/invalid fails` | Subdomain takeover |
| **Server-Side Request Forgery (SSRF)** | Webhook endpoint URLs | URL format check | `assertSafeUrl` blocks loopback (127.0.0.1), private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), cloud metadata (169.254.169.254), non-HTTPS | `Domain 8: SSRF targets blocked` | Public proxy open redirection |
| **Cross-Site Scripting (XSS)** | Customer notes, names, templates | React JSX escaping | `escapeHtml` and `sanitizePlainText` strip control characters and HTML entities | `Domain 9: XSS strings sanitized` | Third-party script compromise |
| **Clickjacking** | UI framing | None | `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` in CSP | `Domain 10: Security headers verified` | Legacy browser incompatibility |

### 2.5 Infrastructure & Secret Threats
| Threat | Attack Surface | Existing Protection | New Protection (Phase 8.4) | Automated Test | Residual Risk |
|---|---|---|---|---|---|
| **Secret Leakage in Logs** | Logger output | Basic patterns | Deep multi-layer redaction covering tokens, cookies, auth headers, database/redis URLs | `Domain 10: Zero secrets in logs` | Custom unredacted console.log |
| **Plaintext Provider Keys** | Database columns | SecretStore | Authenticated AES-256-GCM encryption with 12-byte IVs, 16-byte tags, and opaque reference tokens | `Domain 10: SecretStore AES-256-GCM validated` | Master encryption key compromise |
| **Redis Authorization Confusion** | Redis queue jobs | Worker leases | Redis is treated strictly as ephemeral coordination; PostgreSQL remains the sole authorization truth | `Domain 11: Redis cannot authorize payment` | Redis cluster outage |

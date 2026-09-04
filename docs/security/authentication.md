# RecoverIQ — Authentication Architecture

## 1. Overview
RecoverIQ uses a hardened, token-based session authentication model for interactive browser users, and cryptographic API keys for programmatic developer access.

---

## 2. Browser Session Security
- **Cookie Name**: `rcvq_session`
- **Flags**: `HttpOnly=true`, `Secure=true` (in production/HTTPS), `SameSite=Lax`, `Path=/`
- **Algorithm**: Fixed `HS256` HMAC-SHA256 signature using `JWT_SECRET` (minimum 32 bytes).
- **Expiration Policy**:
  - Absolute Expiration: 7 days (`maxAge: 604800s`).
  - Idle Timeout: 4 hours (`idleTimeoutSeconds: 14400s`) evaluated on active requests.
- **Session Rotation**: On successful authentication via `POST /api/auth/login`, the session token is re-minted with a newly generated `sessionId` (`sess_...`) to prevent pre-authentication session fixation.
- **Server-Side Invalidation**: On logout via `POST /api/auth/logout`, the active session token is registered in the revocation store (`REVOKED_SESSION_SET` + Redis TTL).

---

## 3. Login Security & Brute-Force Throttling
- Endpoint: `POST /api/auth/login`
- Rate Limiting: 5 failed attempts per 15-minute sliding window per IP/account (`SecurityRateLimiter.checkLoginAttempt`).
- Account Enumeration Defense: The login handler always returns HTTP 401 `Invalid credentials` regardless of whether the email exists in the database.
- Audit Logging: All login successes and failures are logged via `SecurityEventService.recordSecurityEvent` (`LOGIN_SUCCESS`, `LOGIN_FAILURE`).

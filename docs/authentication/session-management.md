# Durable Session & Device Management

## Session Architecture
- Every session is uniquely identified with a cryptographic session ID.
- Stored as a SHA-256 token hash in `UserSession`.
- Tokens are never exposed to browser JavaScript (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
- Session rotation is enforced upon login, password reset, and privilege escalation to prevent session fixation.

## Session Lifecycle & Controls
- **Idle Timeout**: 15 minutes of inactivity revokes session.
- **Maximum TTL**: 24 hours standard session lifetime.
- **Active Sessions View**: Displays sanitized browser and OS details with last activity timestamp.
- **Individual Session Revocation**: Allows revoking any remote session.
- **Sign Out Everywhere**: `/api/auth/logout-all` revokes all active sessions for the user and emits audit notifications.

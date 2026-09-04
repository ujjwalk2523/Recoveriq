# Password Authentication & Password Policies

## Policy Invariants
- Minimum password length: 12 characters.
- Maximum password length: 128 characters.
- Blacklist rejection for common / easily guessable passphrases.
- Salted hashing using bcrypt with 12 rounds / Argon2id parameters.
- Timing-safe verification against stored hashes.
- Password change requires recent authentication (< 15 mins) and invalidates all other active user sessions.

## Password Reset Flow
1. User requests password reset via generic non-enumerating endpoint (`/api/auth/password/forgot`).
2. Server generates cryptographically random token (32 bytes).
3. Only the SHA-256 hash of the token is persisted with a 1-hour expiration.
4. Token link dispatched via `EmailDeliveryService`.
5. Upon consumption, token is marked `usedAt`, password updated, all sessions revoked, and a security notification is emitted.

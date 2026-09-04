# Multi-Factor Authentication (MFA) & Recovery Codes

## TOTP Implementation
- Standards-compliant RFC 6238 Time-based One-Time Password algorithm.
- 160-bit Base32 secret keys generated with cryptographically secure random bytes.
- 30-second time steps with ±1 window tolerance for clock drift.
- **Encrypted at Rest**: TOTP secrets are encrypted using AES-256-GCM via `SecretStore` before being stored in the database.
- Proof of possession is mandatory to complete enrollment or disable MFA.

## Single-Use Recovery Codes
- 10 alphanumeric single-use recovery codes generated upon enrollment.
- Plaintext codes are presented ONCE to the user during enrollment.
- Stored exclusively as SHA-256 hashes.
- Successfully using a recovery code immediately deletes its hash from the database.
- Regeneration invalidates all previous codes and requires step-up authentication.

## Restricted Challenge Sessions
- When an MFA-enrolled user logs in with email/password, a temporary unprivileged challenge session (`pendingMfa: true`) is issued.
- Challenge sessions cannot access organization data, billing, payments, API keys, or recovery pipelines.
- Access is restricted strictly to `/api/auth/mfa/verify` and `/api/auth/mfa/recovery`.

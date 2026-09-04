# RecoverIQ — Secrets Management Architecture

## 1. Principles
- **No Plaintext Secrets**: Passwords, API keys, and webhook secrets are never stored in plaintext.
- **No Secrets in Client Bundles**: All secrets reside in server-side modules; client bundles never import secret stores.
- **No Secrets in Redis**: Redis is used solely for queue coordination, job metadata, and ephemeral locks.
- **No Secrets in Logs**: Structured logger masks tokens, API keys, webhook secrets, passwords, and DB connection strings.

---

## 2. SecretStore Implementation
- **Encryption Algorithm**: Authenticated `AES-256-GCM`.
- **IV / Nonce**: 12-byte cryptographically random IV per encryption operation.
- **Authentication Tag**: 16-byte tag ensuring ciphertext integrity. Tampering immediately aborts decryption.
- **Key Derivation**: 32-byte key derived from `RECOVERIQ_SECRET_ENCRYPTION_KEY`.
- **Rotation**: Supported via `SecretStore.rotateSecret()` with atomic version increment.
- **Opaque Reference Tokens**: Databases only persist reference strings (`sec_ref_...`).

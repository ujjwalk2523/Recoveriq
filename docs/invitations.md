# RecoverIQ — Cryptographic Member Invitations

## 1. Security Architecture

Invitations to join an organization follow zero-trust cryptographic standards:

1. **Token Generation**:
   - High-entropy 32-byte cryptographically secure token generated using `crypto.randomBytes(32).toString('hex')`.
   - Plaintext token `inv_<hex>` is sent only to the invitee via email (`IEmailProvider`).
   - The database stores **only** the SHA-256 hash of the token: `crypto.createHash('sha256').update(rawToken).digest('hex')`.

2. **Expiration & Single-Use**:
   - Invitations expire automatically after 7 days (`DEFAULT_INVITATION_TTL_MS = 7 * 86400 * 1000`).
   - Tokens are single-use. Upon acceptance or revocation, status is transitioned to `ACCEPTED` or `REVOKED` in an atomic transaction.

3. **Rate Limiting**:
   - Maximum 10 pending invitations per hour per organization to mitigate spam and abuse.

4. **Server-Authoritative Roles**:
   - The role assigned upon acceptance is determined strictly by the server-side stored `role` on the `OrganizationInvitation` record, preventing client role-spoofing attacks.

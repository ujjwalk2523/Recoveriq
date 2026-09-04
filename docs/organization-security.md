# RecoverIQ — Organization Security & Tenant Isolation

## 1. Zero-Trust Tenancy Principles

RecoverIQ Phase 8.5 extends Phase 8.4 security hardening into organizational multi-tenancy:

1. **Strict Tenant Separation**:
   - Every organizational resource (members, invitations, teams, team members) is strictly associated with an `organizationId`.
   - Direct object references (IDOR) are prevented by requiring both `organizationId` and entity `id` in query predicates.

2. **Cross-Tenant Prevention in Team Assignment**:
   - `TeamMember` records must reference a `memberId` whose `organizationId` matches `Team.organizationId`.
   - The team service strictly throws `MEMBER_CROSS_TENANT_REJECTED` if a mismatch is detected.

3. **Session Context Integrity**:
   - Sessions are cryptographically signed with HMAC-SHA256 (`COOKIE_SECRET` / `SESSION_SECRET`).
   - Forged or manipulated `organizationId` values in cookies are rejected during signature validation.

4. **Audit Logging & Non-Repudiation**:
   - Sensitive organizational actions (membership changes, role alterations, invitations created/revoked/accepted, team modifications, ownership transfers) generate non-repudiable audit log entries.

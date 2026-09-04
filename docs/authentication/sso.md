# Enterprise SSO, OIDC, SAML & Domain Verification

## Enterprise Single Sign-On Architecture
- **OIDC & SAML-Ready Provider Model**: Supports custom IdP configurations per organization (`OrganizationIdentityProvider`).
- **Cryptographic Protections**: Enforces state, nonce, PKCE (SHA-256 code verifier/challenge), issuer, audience, and expiry validation.
- **Client Secret Encryption**: OIDC client secrets are encrypted using AES-256-GCM.

## Domain Verification
- Organizations can claim enterprise domains (e.g. `acme.com`).
- Domain ownership is proven via DNS TXT records containing cryptographic verification hashes.

## Just-In-Time (JIT) Provisioning
- Allows automatic member onboarding for users authenticating via verified enterprise domains.
- **Seat Limit Enforcement**: JIT provisioning fails closed if organization seat limits are reached.
- **Role Isolation**: JIT members are provisioned with isolated roles (default `OPERATOR`, never auto-escalating to `OWNER`).

## SSO Enforcement
- When `enforceSso = true`, members matching the verified enterprise domain must authenticate via the configured IdP.
- Emergency OWNER recovery channels remain protected.

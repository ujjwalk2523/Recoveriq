# RecoverIQ Enterprise Authentication & Identity Architecture

## Overview
RecoverIQ Phase 8.6 introduces an enterprise-grade, decoupled identity and authentication architecture designed to support multi-tenant SaaS operations with strict zero-trust boundaries.

```text
                     USER IDENTITY (Canonical)
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
          PASSWORD AUTHENTICATION      ENTERPRISE SSO (OIDC / SAML)
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
                     IDENTITY RESOLUTION
                                 │
                                 ▼
                     MFA / STEP-UP AUTH (TOTP / Recovery)
                                 │
                                 ▼
                     DURABLE SESSION LEDGER
                                 │
                                 ▼
                     ORGANIZATION CONTEXT
                                 │
                                 ▼
                     ORGANIZATION MEMBERSHIP
                                 │
                                 ▼
                     RBAC & PERMISSION MATRIX (Phase 8.5)
                                 │
                                 ▼
                     APPLICATION / WORKSPACES
```

## Architectural Invariants
1. **Authentication establishes identity** ("Who are you?").
2. **Organization membership establishes tenancy** ("Which workspace are you acting inside?").
3. **RBAC establishes authority** ("What can you do?").
4. **Step-Up Authentication gates sensitive operations** (requires recent auth < 15 mins).
5. **No claim elevation**: SSO group claims or external metadata cannot bypass RecoverIQ authorization.

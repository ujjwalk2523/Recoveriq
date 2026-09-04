# Policy Versioning & Lifecycle Architecture

## Overview

RecoverIQ Governance Policies implement strict version tracking and immutable snapshotting to ensure complete transparency, regulatory defensibility, and auditability across all policy updates.

## Lifecycle States

Policies cycle through five discrete states:

```
    [DRAFT]
       │
       ▼
   [ACTIVE] ──(pause)──► [PAUSED]
       │                    │
       │ (resume)           │ (archive)
       ▼                    ▼
   [ACTIVE] ────────────► [ARCHIVED]
```

1. **DRAFT**: Created but not evaluated against live requests. Used for authoring, rule composition, and simulation testing.
2. **ACTIVE**: Enforced by the real-time governance engine for incoming organizational actions.
3. **PAUSED**: Temporarily suspended without deleting the rule definitions. Policies in `PAUSED` state are skipped during real-time evaluations.
4. **ARCHIVED**: Permanently retired policies retained strictly for historical audit compliance and evidence packages.

## Immutable Version History (`GovernancePolicyHistory`)

Whenever a policy is updated, activated, paused, or archived, the engine atomically writes an immutable history snapshot:

- `policyId`: Reference to parent policy.
- `version`: Monotonically incrementing integer (v1, v2, v3...).
- `name`: Policy name at time of snapshot.
- `description`: Narrative description at time of snapshot.
- `category`: Operational category.
- `effect`: Applied effect (`DENY`, `REQUIRE_STEP_UP`, `REQUIRE_APPROVAL`, `ALLOW`).
- `rules`: Full JSON serialization of the condition AST.
- `status`: Lifecycle state at time of snapshot.
- `changedBy`: User ID of modifying administrator.
- `changeReason`: Mandatory justification message explaining the update.
- `createdAt`: UTC timestamp of snapshot.

## Audit Ledger Integration

Every mutation (`CREATE`, `UPDATE`, `ACTIVATE`, `PAUSE`, `ARCHIVE`) appends an immutable event to the RecoverIQ Audit Ledger (`GovernancePolicyService` invokes `AuditRepository.append`):
- Action: `POLICY_CREATED`, `POLICY_UPDATED`, `POLICY_ACTIVATED`, `POLICY_PAUSED`, `POLICY_ARCHIVED`
- Category: `SECURITY` / `GOVERNANCE`
- Metadata: Includes snapshot version, previous status, actor details, and change justification.

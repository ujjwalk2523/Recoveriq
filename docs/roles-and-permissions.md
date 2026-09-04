# RecoverIQ — Roles & Permission Matrix

## 1. Permission Matrix

Permissions are centralized in `src/lib/organization/permission-matrix.ts`. RecoverIQ enforces 22 fine-grained permissions across 4 distinct organization roles:

| Permission | OWNER | ADMIN | OPERATOR | ANALYST | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `ORG_VIEW` | [x] | [x] | [x] | [x] | View basic organization details |
| `ORG_MANAGE_SETTINGS` | [x] | [x] | [ ] | [ ] | Edit organization settings |
| `ORG_DELETE` | [x] | [ ] | [ ] | [ ] | Soft-delete / deactivate organization |
| `ORG_TRANSFER_OWNERSHIP` | [x] | [ ] | [ ] | [ ] | Transfer organization ownership |
| `MEMBER_VIEW` | [x] | [x] | [x] | [x] | View member roster |
| `MEMBER_INVITE` | [x] | [x] | [ ] | [ ] | Invite new members |
| `MEMBER_UPDATE_ROLE` | [x] | [x] | [ ] | [ ] | Change role of members |
| `MEMBER_SUSPEND` | [x] | [x] | [ ] | [ ] | Suspend member access |
| `MEMBER_REMOVE` | [x] | [x] | [ ] | [ ] | Remove member from organization |
| `TEAM_VIEW` | [x] | [x] | [x] | [x] | View teams |
| `TEAM_CREATE` | [x] | [x] | [ ] | [ ] | Create teams |
| `TEAM_UPDATE` | [x] | [x] | [ ] | [ ] | Edit teams |
| `TEAM_DELETE` | [x] | [x] | [ ] | [ ] | Delete/archive teams |
| `TEAM_MANAGE_MEMBERS` | [x] | [x] | [ ] | [ ] | Add/remove team members |
| `POLICY_READ` | [x] | [x] | [x] | [x] | View recovery policies |
| `POLICY_WRITE` | [x] | [x] | [x] | [ ] | Edit recovery policies |
| `PAYMENT_VIEW` | [x] | [x] | [x] | [x] | View transactions and payments |
| `PAYMENT_RECOVER` | [x] | [x] | [x] | [ ] | Trigger autonomous/manual recovery |
| `API_KEYS_VIEW` | [x] | [x] | [ ] | [ ] | View API keys |
| `API_KEYS_MANAGE` | [x] | [x] | [ ] | [ ] | Generate/revoke API keys |
| `AUDIT_LOG_VIEW` | [x] | [x] | [x] | [x] | Inspect compliance audit logs |
| `BILLING_MANAGE` | [x] | [x] | [ ] | [ ] | Manage SaaS subscription & payment methods |

---

## 2. Invariants
- Only `OWNER` can delete an organization or initiate ownership transfer.
- `ADMIN` cannot modify or suspend the `OWNER`.
- `OPERATOR` can execute recovery actions and configure policies but cannot manage members or billing.
- `ANALYST` has read-only visibility into analytics, audit logs, and payments.

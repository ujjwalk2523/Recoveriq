# RecoverIQ — Audit Event Catalog & Classifications (Phase 8.7.1)

## 1. Centralized Actor Types

| Actor Type | Meaning | Example |
| :--- | :--- | :--- |
| `USER` | Authenticated human principal | Admin changes user role |
| `API_KEY` | Authenticated programmatic caller | Client script creates webhooks |
| `SYSTEM` | Scheduled or automated platform background task | Database partition rotation |
| `WORKER` | Asynchronous recovery execution worker | Payment recovery retry triggered |
| `WEBHOOK` | External provider callback invocation | Razorpay payment failure event |
| `SERVICE` | Internal microservice or trusted agent | Decision trace synchronization |
| `ANONYMOUS` | Unauthenticated external caller | Failed login with unknown user |

---

## 2. Categories

- `AUTHENTICATION`
- `AUTHORIZATION`
- `IDENTITY`
- `MFA`
- `SESSION`
- `ORGANIZATION`
- `MEMBERSHIP`
- `TEAM`
- `API`
- `BILLING`
- `PAYMENT`
- `RECOVERY`
- `WEBHOOK`
- `SECURITY`
- `SYSTEM`
- `CONFIGURATION`

---

## 3. Severities

- `INFO`: Standard operational state (e.g. `AUTH_LOGIN_SUCCESS`)
- `LOW`: Expected minor failure (e.g. `AUTH_LOGIN_FAILURE` bad credentials)
- `MEDIUM`: Privilege change (e.g. `ORG_MEMBER_ROLE_CHANGED`)
- `HIGH`: Security perimeter modification (e.g. `AUTH_MFA_DISABLED`, `API_KEY_REVOKED`)
- `CRITICAL`: High-impact administrative change (e.g. `ORG_OWNER_TRANSFERRED`, `LIVE_EXECUTION_ENABLED`)

---

## 4. Results

- `SUCCESS`: Action executed successfully.
- `FAILURE`: Action failed due to validation or runtime error.
- `DENIED`: Action blocked by RBAC or security perimeter.
- `PARTIAL`: Multi-step action partially completed.

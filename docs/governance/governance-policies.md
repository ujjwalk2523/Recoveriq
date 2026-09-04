# RecoverIQ — Enterprise Governance Policies Architecture

## 1. Executive Summary
Phase 8.7.4 introduces the **Governance Policy Engine**, delivering deterministic preventive controls over security-sensitive, administrative, and configuration actions within RecoverIQ.

While the immutable audit ledger records what happened and analytics investigate patterns, governance policies decide in real time whether an intended operation is permitted, requires elevated step-up authentication, demands multi-party approval, or must be blocked.

---

## 2. Authorization Hierarchy & Invariants
Governance policies integrate into RecoverIQ's zero-trust defense-in-depth pipeline:

```text
Authentication (JWT / Session / Scoped API Key)
      ↓
Organization Context (Tenant Scope Verification)
      ↓
RBAC / Permission Check (OWNER / ADMIN / OPERATOR / ANALYST)
      ↓
Step-Up Authentication Check (Freshness / Elevation)
      ↓
Governance Policy Engine (Deterministic Preventive Controls)
      ↓
Domain-Specific Guardrails (Financial ceilings, VIP sign-offs)
      ↓
Business Operation Execution
      ↓
Immutable Audit Ledger Event Recorded
```

### The RBAC Primacy Invariant
* **A governance policy can further restrict an operation, but can NEVER grant privileges that RBAC denies.**
* If RBAC evaluates `DENY`, the final decision is `DENY`, regardless of whether a governance rule returns `ALLOW`.
* Both RBAC and Governance must permit an action for execution to proceed.

### Payment Safety Independence
* The governance policy engine does **not** sit in the critical path of raw payment recovery attempts.
* RecoverIQ's high-frequency payment execution relies strictly on `PolicyGuardrails`, ML safety gates, and `EntitlementService` to prevent outage dependencies.

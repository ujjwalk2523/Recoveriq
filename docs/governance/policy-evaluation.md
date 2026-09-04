# Policy Evaluation Engine Reference

## Overview

The RecoverIQ Governance Policy Engine evaluates declarative, organization-scoped governance policies in real time to enforce preventive guardrails on user, API, and administrative actions.

## Execution Model

```
               Incoming Request
                      │
                      ▼
         ┌─────────────────────────┐
         │       RBAC Check        │
         └────────────┬────────────┘
                      │
            Allowed   │   Denied
            ┌─────────┴─────────┐
            │                   │
            ▼                   ▼
   ┌─────────────────┐    ┌───────────┐
   │ Governance Eval │    │   DENY    │ (Immediate exit)
   └────────┬────────┘    └───────────┘
            │
            ├─────────────────────────────────────────┐
            ▼                                         ▼
   Active Policies Found?                   No Matching Policies?
            │                                         │
            ▼                                         ▼
   Match Target Action/Scope?                Default Fallback:
            │                                 - Critical Admin: Fail-Closed (DENY)
            ▼                                 - Non-Critical: ALLOW
   Evaluate Condition AST
   (Deterministic AST Walker)
            │
            ▼
   Precedence Resolution:
   DENY > REQUIRE_STEP_UP > REQUIRE_APPROVAL > ALLOW
```

## Precedence Resolution Matrix

When multiple policies match an evaluation context, decisions resolve according to strict deterministic priority:

| Effect | Priority | Action Taken |
|---|---|---|
| `DENY` | 1 (Highest) | Request is immediately rejected with explicit denial rationale. |
| `REQUIRE_STEP_UP` | 2 | Request requires multi-factor authentication / step-up challenge verification. |
| `REQUIRE_APPROVAL` | 3 | Request is held in an approval queue awaiting dual-control authorization. |
| `ALLOW` | 4 (Lowest) | Request is permitted to proceed. |

## Fail-Closed Critical Actions

If no active policies match or if evaluation encounters an irrecoverable state, the engine adheres to a fail-closed posture for critical operations:
- `ORG_MEMBERSHIP_REVOKE`
- `SECURITY_SETTINGS_MUTATE`
- `BILLING_INFO_MUTATE`
- `RECOVERY_STRATEGY_MUTATE`
- `PAYMENT_GATEWAY_MUTATE`
- `API_KEY_REVOKE`

Any critical action missing explicit policy coverage or failing runtime validation will default to `DENY`.

## Simulation Mode

The policy engine exposes `simulateEvaluation(context)` which executes the exact deterministic AST evaluation and precedence algorithm against target policies without:
1. Emitting persistent audit ledger records
2. Mutating database state
3. Interrupting end-user operational flows

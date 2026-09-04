# Governance Policy Engine Troubleshooting Guide

## Diagnostic Checklist

When investigating unexpected governance policy decisions or blocked operations, follow this step-by-step diagnostic workflow:

### 1. Verify Policy Lifecycle State
- Ensure the policy status is `ACTIVE`.
- Policies in `DRAFT`, `PAUSED`, or `ARCHIVED` status are ignored during live evaluation.
- Query policy status via:
  ```http
  GET /api/governance/policies/:id
  ```

### 2. Inspect Precedence Order
If multiple policies match an action, higher precedence effects immediately supersede lower effects:
1. `DENY` (Highest priority)
2. `REQUIRE_STEP_UP`
3. `REQUIRE_APPROVAL`
4. `ALLOW` (Lowest priority)

If a user is unexpectedly denied an action, check if an overarching `DENY` policy matches the scope (e.g., wildcard action match or global category policy).

### 3. Review Evaluation Simulation
Run the dry-run simulation endpoint to inspect rule evaluation traces without mutating state:
```http
POST /api/governance/policies/simulate
Content-Type: application/json

{
  "context": {
    "action": "API_KEY_REVOKE",
    "category": "API_MANAGEMENT",
    "actor": {
      "id": "usr_123",
      "role": "ADMIN",
      "mfaEnabled": false
    },
    "organizationId": "org_abc",
    "resource": {
      "type": "API_KEY",
      "id": "key_999"
    }
  }
}
```
The response returns `matchedPolicies`, `evaluations`, and `finalEffect` detailing the AST evaluation path.

### 4. Check for RBAC Primacy
If the RBAC layer has rejected the action, the governance policy engine will not evaluate policies. The final outcome will report `RBAC Primacy: Permission denied`.
Ensure the actor possesses the prerequisite RBAC role/permission before troubleshooting governance rule conditions.

### 5. Check Audit Ledger Snapshots
Every policy change records a snapshot in `GovernancePolicyHistory` and appends an audit event. Check the audit timeline (`GET /api/audit/events?action=POLICY_UPDATED`) to identify recent modifications or policy revisions that may have altered evaluation behavior.

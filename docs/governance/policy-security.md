# Policy Security & Threat Mitigation

## Security Principles

The RecoverIQ Policy Engine operates under strict defensive design constraints to protect against execution attacks, privilege escalations, and denial-of-service vulnerabilities.

## 1. Zero `eval()` Execution Model
- Condition AST nodes are parsed and interpreted using static TypeScript evaluation functions.
- Dynamic code generation, `eval()`, `new Function()`, or shell execution are strictly forbidden across the codebase.
- Condition field accessors validate against an allowed schema of context attributes (`actor.role`, `actor.mfaEnabled`, `ipAddress`, `action`, `resource.type`, etc.), preventing arbitrary property dereferencing.

## 2. Prototype Pollution Defense
- All JSON payloads and AST nodes are deeply frozen and sanitized prior to evaluation.
- Property accessors explicitly disallow `__proto__`, `constructor`, and `prototype` tokens in field paths.
- Objects are resolved safely without recursive proto-chain manipulation.

## 3. Regular Expression Denial of Service (ReDoS) Protection
- Regular expression matches (`MATCHES_REGEX` operator) strictly enforce a maximum regex string length of 128 characters.
- Evaluation runs inside bounded time envelopes and flags catastrophic backtracking patterns.
- Pre-compiled safe patterns are prioritized.

## 4. RBAC Primacy Invariant
- Governance policies can **never** override an RBAC denial.
- The authorization stack evaluates RBAC permissions first:
  ```typescript
  if (rbacDecision.isDenied) {
    return {
      allowed: false,
      reason: 'RBAC Primacy: Permission denied by role-based access control',
      effect: 'DENY',
      // Governance cannot relax this decision
    };
  }
  ```
- Governance policies can only apply further restrictions (`DENY`, `REQUIRE_STEP_UP`, `REQUIRE_APPROVAL`) or uphold an existing RBAC grant (`ALLOW`).

## 5. Multi-Tenant Isolation
- All policies and policy queries are scoped strictly by `organizationId`.
- Cross-organization evaluation or inheritance is strictly disallowed.

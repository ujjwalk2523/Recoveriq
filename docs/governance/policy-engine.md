# RecoverIQ — Governance Policy Engine & Evaluation AST

## 1. Typed Condition AST
RecoverIQ uses a safe, structured condition AST without `eval`, arbitrary regex execution, or script interpreters to eliminate code injection and ReDoS risks:

```typescript
export interface GovernanceSimpleCondition {
  field: GovernanceConditionField;
  operator: GovernanceOperator;
  value: any;
}

export interface GovernanceConditions {
  all?: GovernanceSimpleCondition[];
  any?: GovernanceSimpleCondition[];
}
```

### Supported Fields
* `actorRole`: Assigned RBAC role (`OWNER`, `ADMIN`, `OPERATOR`, `ANALYST`)
* `actorType`: Identity type (`USER`, `API_KEY`, `SYSTEM`, `WORKER`)
* `action`: Authoritative action verb (`API_KEY_CREATED`, `AUTH_MFA_DISABLED`, etc.)
* `resourceType`: Platform resource (`ORGANIZATION`, `API_KEY`, `SESSION`, etc.)
* `resourceId`: Specific resource identifier
* `environment`: Active deployment environment (`production`, `staging`, `test`)
* `timeOfDay`: Current UTC hour (0 - 23)
* `dayOfWeek`: Current day of week (0 = Sunday, 6 = Saturday)
* `mfaAge`: Seconds since most recent step-up authentication challenge
* `teamIds`: Array of team identifiers assigned to the actor

### Supported Operators
* `EQUALS`: Strict equality check.
* `NOT_EQUALS`: Negated equality check.
* `IN`: Set inclusion.
* `NOT_IN`: Set exclusion.
* `GREATER_THAN`: Numeric comparison ($>$).
* `GREATER_THAN_OR_EQUAL`: Numeric comparison ($\ge$).
* `LESS_THAN`: Numeric comparison ($<$).
* `LESS_THAN_OR_EQUAL`: Numeric comparison ($\le$).
* `BETWEEN`: Closed range check ($[min, max]$).
* `MATCHES_ENUM`: Type-safe enum equality.

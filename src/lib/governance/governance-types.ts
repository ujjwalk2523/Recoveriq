/**
 * Phase 8.7.4 — Enterprise Governance Policy Types & Condition AST
 *
 * Provides typed, deterministic policy models, condition evaluators, and
 * decision contracts for enterprise preventive controls.
 *
 * CRITICAL SECURITY INVARIANT:
 * Governance policies can further restrict operations, but can NEVER grant
 * privileges that RBAC denies. RBAC DENY always wins.
 */

export type GovernancePolicyCategory =
  | 'IDENTITY'
  | 'AUTHENTICATION'
  | 'MFA'
  | 'SESSION'
  | 'ORGANIZATION'
  | 'MEMBERSHIP'
  | 'TEAM'
  | 'API'
  | 'BILLING'
  | 'PAYMENT'
  | 'RECOVERY'
  | 'SECURITY'
  | 'CONFIGURATION';

export type GovernancePolicyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export type GovernancePolicyEffect =
  | 'ALLOW'
  | 'DENY'
  | 'REQUIRE_APPROVAL'
  | 'REQUIRE_STEP_UP';

export type GovernanceOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN'
  | 'MATCHES_ENUM';

export type GovernanceConditionField =
  | 'actorRole'
  | 'actorType'
  | 'action'
  | 'resourceType'
  | 'resourceId'
  | 'severity'
  | 'environment'
  | 'timeOfDay' // 0-23
  | 'dayOfWeek' // 0-6 (0 = Sunday)
  | 'mfaAge' // seconds since last MFA challenge
  | 'teamIds';

export interface GovernanceSimpleCondition {
  field: GovernanceConditionField;
  operator: GovernanceOperator;
  value: any;
}

export interface GovernanceCompoundConditions {
  all?: GovernanceSimpleCondition[];
  any?: GovernanceSimpleCondition[];
}

export type GovernanceConditions = GovernanceCompoundConditions;

export interface GovernancePolicyRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  category: GovernancePolicyCategory;
  status: GovernancePolicyStatus;
  priority: number; // Lower number = evaluated first (e.g. 10 before 100)
  effect: GovernancePolicyEffect;
  conditions: GovernanceConditions;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  history?: GovernancePolicyHistoryRecord[];
}

export interface GovernancePolicyHistoryRecord {
  id: string;
  policyId: string;
  version: number;
  name: string;
  description: string;
  category: GovernancePolicyCategory;
  status: GovernancePolicyStatus;
  priority: number;
  effect: GovernancePolicyEffect;
  conditions: GovernanceConditions;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

export interface GovernanceEvaluationContext {
  organizationId: string;
  actorId: string;
  actorType: string;
  role?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  severity?: string;
  environment?: string; // 'development' | 'test' | 'staging' | 'production'
  timestamp?: Date;
  mfaAge?: number; // seconds since last step-up/MFA
  teamIds?: string[];
  isPrivilegedAdminAction?: boolean;
}

export interface GovernanceDecision {
  allowed: boolean;
  effect: GovernancePolicyEffect;
  matchedPolicies: Array<{
    id: string;
    name: string;
    version: number;
    priority: number;
    effect: GovernancePolicyEffect;
    reason: string;
  }>;
  requiresStepUp: boolean;
  requiresApproval: boolean;
  reason: string;
  conflicts: Array<{
    policyId: string;
    effect: GovernancePolicyEffect;
    overriddenBy: string;
  }>;
  evaluatedAt: string;
}

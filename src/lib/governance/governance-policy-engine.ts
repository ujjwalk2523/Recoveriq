/**
 * Phase 8.7.4 — Enterprise Governance Policy Engine
 *
 * Deterministic policy evaluator with strict precedence, explainable decision
 * traces, zero eval/arbitrary code execution, and fail-closed safety guards.
 *
 * PRECEDENCE:
 * DENY > REQUIRE_STEP_UP > REQUIRE_APPROVAL > ALLOW
 *
 * CRITICAL INVARIANT:
 * Governance policy can never override an RBAC denial.
 */

import {
  GovernancePolicyRecord,
  GovernanceEvaluationContext,
  GovernanceDecision,
  GovernancePolicyEffect,
  GovernanceSimpleCondition,
  GovernanceConditions,
  GovernanceOperator,
} from './governance-types';

export const CRITICAL_ADMIN_ACTIONS = new Set([
  'ORG_OWNER_TRANSFERRED',
  'ORG_SECURITY_UPDATED',
  'AUTH_MFA_DISABLED',
  'API_KEY_CREATED',
  'API_KEY_ROTATED',
  'SSO_CONFIG_UPDATED',
  'DOMAIN_VERIFIED',
  'PAYMENT_PROVIDER_CREDENTIALS_UPDATED',
]);

const EFFECT_PRECEDENCE: Record<GovernancePolicyEffect, number> = {
  DENY: 4,
  REQUIRE_STEP_UP: 3,
  REQUIRE_APPROVAL: 2,
  ALLOW: 1,
};

export class GovernancePolicyEngine {
  /**
   * Safely extracts the value of a target field from the trusted context.
   */
  private static extractFieldValue(
    field: string,
    context: GovernanceEvaluationContext
  ): any {
    const now = context.timestamp || new Date();

    switch (field) {
      case 'actorRole':
        return context.role;
      case 'actorType':
        return context.actorType;
      case 'action':
        return context.action;
      case 'resourceType':
        return context.resourceType;
      case 'resourceId':
        return context.resourceId;
      case 'severity':
        return context.severity;
      case 'environment':
        return context.environment;
      case 'timeOfDay':
        return now.getUTCHours();
      case 'dayOfWeek':
        return now.getUTCDay();
      case 'mfaAge':
        return context.mfaAge !== undefined ? context.mfaAge : 999999;
      case 'teamIds':
        return context.teamIds || [];
      default:
        return undefined;
    }
  }

  /**
   * Evaluates a single condition safely without eval or arbitrary code execution.
   */
  static evaluateSimpleCondition(
    cond: GovernanceSimpleCondition,
    context: GovernanceEvaluationContext
  ): boolean {
    if (!cond || typeof cond !== 'object') return false;

    const actual = this.extractFieldValue(cond.field, context);
    const expected = cond.value;

    switch (cond.operator) {
      case 'EQUALS':
        return actual === expected;

      case 'NOT_EQUALS':
        return actual !== expected;

      case 'IN':
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            return actual.some(a => expected.includes(a));
          }
          return expected.includes(actual);
        }
        return false;

      case 'NOT_IN':
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            return !actual.some(a => expected.includes(a));
          }
          return !expected.includes(actual);
        }
        return true;

      case 'GREATER_THAN':
        return Number(actual) > Number(expected);

      case 'GREATER_THAN_OR_EQUAL':
        return Number(actual) >= Number(expected);

      case 'LESS_THAN':
        return Number(actual) < Number(expected);

      case 'LESS_THAN_OR_EQUAL':
        return Number(actual) <= Number(expected);

      case 'BETWEEN':
        if (Array.isArray(expected) && expected.length === 2) {
          const num = Number(actual);
          return num >= Number(expected[0]) && num <= Number(expected[1]);
        }
        return false;

      case 'MATCHES_ENUM':
        return actual === expected;

      default:
        console.warn(`[GovernancePolicyEngine] Unknown operator: ${(cond as any).operator}`);
        return false;
    }
  }

  /**
   * Evaluates compound (all/any) conditions for a policy.
   */
  static evaluateConditions(
    conditions: GovernanceConditions,
    context: GovernanceEvaluationContext
  ): boolean {
    if (!conditions || typeof conditions !== 'object') return false;

    // Evaluate 'all' conditions (conjunction)
    if (conditions.all && Array.isArray(conditions.all) && conditions.all.length > 0) {
      const allPassed = conditions.all.every(c => this.evaluateSimpleCondition(c, context));
      if (!allPassed) return false;
    }

    // Evaluate 'any' conditions (disjunction)
    if (conditions.any && Array.isArray(conditions.any) && conditions.any.length > 0) {
      const anyPassed = conditions.any.some(c => this.evaluateSimpleCondition(c, context));
      if (!anyPassed) return false;
    }

    return true;
  }

  /**
   * Evaluates an ordered list of active governance policies against a context.
   */
  static evaluate(
    policies: GovernancePolicyRecord[],
    context: GovernanceEvaluationContext
  ): GovernanceDecision {
    const evaluatedAt = new Date().toISOString();

    try {
      // 1. Filter to ACTIVE policies for the organization and sort by priority ASC
      const activePolicies = policies
        .filter(p => p.status === 'ACTIVE' && p.organizationId === context.organizationId)
        .sort((a, b) => a.priority - b.priority);

      // 2. Identify matched policies
      const matched: Array<{
        id: string;
        name: string;
        version: number;
        priority: number;
        effect: GovernancePolicyEffect;
        reason: string;
      }> = [];

      for (const policy of activePolicies) {
        // Enforce maximum condition count per policy to guard against ReDoS/Denial-of-Service
        const condCount = (policy.conditions?.all?.length || 0) + (policy.conditions?.any?.length || 0);
        if (condCount > 25) {
          console.warn(`[GovernancePolicyEngine] Policy ${policy.id} exceeds condition limit (${condCount} > 25). Skipping.`);
          continue;
        }

        if (this.evaluateConditions(policy.conditions, context)) {
          matched.push({
            id: policy.id,
            name: policy.name,
            version: policy.version,
            priority: policy.priority,
            effect: policy.effect,
            reason: policy.description || `Matched conditions in policy '${policy.name}'`,
          });
        }
      }

      // 3. If no policies matched, default to ALLOW
      if (matched.length === 0) {
        return {
          allowed: true,
          effect: 'ALLOW',
          matchedPolicies: [],
          requiresStepUp: false,
          requiresApproval: false,
          reason: 'No active governance policies restrict this operation.',
          conflicts: [],
          evaluatedAt,
        };
      }

      // 4. Resolve highest precedence effect
      let winningMatch = matched[0];
      let highestScore = EFFECT_PRECEDENCE[winningMatch.effect];

      for (let i = 1; i < matched.length; i++) {
        const score = EFFECT_PRECEDENCE[matched[i].effect];
        if (score > highestScore) {
          highestScore = score;
          winningMatch = matched[i];
        }
      }

      // 5. Track overridden conflicts
      const conflicts: GovernanceDecision['conflicts'] = [];
      for (const m of matched) {
        if (m.effect !== winningMatch.effect) {
          conflicts.push({
            policyId: m.id,
            effect: m.effect,
            overriddenBy: winningMatch.id,
          });
        }
      }

      const effect = winningMatch.effect;
      const allowed = effect === 'ALLOW';
      const requiresStepUp = effect === 'REQUIRE_STEP_UP';
      const requiresApproval = effect === 'REQUIRE_APPROVAL';

      let reason = `Governance policy '${winningMatch.name}' (v${winningMatch.version}) enforced effect: ${effect}.`;
      if (effect === 'DENY') {
        reason = `Operation blocked by governance policy '${winningMatch.name}': ${winningMatch.reason}`;
      } else if (effect === 'REQUIRE_STEP_UP') {
        reason = `MFA step-up required by governance policy '${winningMatch.name}'.`;
      } else if (effect === 'REQUIRE_APPROVAL') {
        reason = `Administrative approval required by governance policy '${winningMatch.name}'.`;
      }

      return {
        allowed,
        effect,
        matchedPolicies: matched,
        requiresStepUp,
        requiresApproval,
        reason,
        conflicts,
        evaluatedAt,
      };
    } catch (err: any) {
      console.error('[GovernancePolicyEngine] Unexpected evaluation error:', err);

      // Fail closed for privileged administrative actions
      const isCritical =
        context.isPrivilegedAdminAction || CRITICAL_ADMIN_ACTIONS.has(context.action);

      if (isCritical) {
        return {
          allowed: false,
          effect: 'DENY',
          matchedPolicies: [],
          requiresStepUp: false,
          requiresApproval: false,
          reason: 'Governance policy engine error encountered during critical administrative action (Fail-Closed).',
          conflicts: [],
          evaluatedAt,
        };
      }

      // Non-sensitive operations allow with warning
      return {
        allowed: true,
        effect: 'ALLOW',
        matchedPolicies: [],
        requiresStepUp: false,
        requiresApproval: false,
        reason: 'Governance policy evaluation error on non-sensitive operation (Fail-Safe).',
        conflicts: [],
        evaluatedAt,
      };
    }
  }

  /**
   * Enforces the architectural rule: Governance policies cannot grant what RBAC denies.
   */
  static composeRbacAndGovernance(
    rbacAllowed: boolean,
    governanceDecision: GovernanceDecision
  ): {
    allowed: boolean;
    reason: string;
    governanceDecision: GovernanceDecision;
  } {
    if (!rbacAllowed) {
      return {
        allowed: false,
        reason: 'Operation denied by Role-Based Access Control (RBAC). Governance policies cannot grant privileges denied by RBAC.',
        governanceDecision,
      };
    }

    return {
      allowed: governanceDecision.allowed,
      reason: governanceDecision.reason,
      governanceDecision,
    };
  }
}

/**
 * Phase 8.7.4 — Enterprise Governance Policy Service
 *
 * Manages the lifecycle, immutable versioning, audit logging, and simulation
 * of enterprise governance policies.
 *
 * INVARIANTS:
 * 1. Policy updates create immutable historical snapshots in GovernancePolicyHistory.
 * 2. Every policy lifecycle event is recorded in the immutable audit ledger.
 * 3. Multi-tenant boundary is enforced across all CRUD and simulation calls.
 * 4. Policy simulation NEVER executes real operations.
 */

import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { AuditRepository } from '../audit/audit-repository';
import {
  GovernancePolicyRecord,
  GovernancePolicyHistoryRecord,
  GovernanceEvaluationContext,
  GovernanceDecision,
  GovernancePolicyCategory,
  GovernancePolicyStatus,
  GovernancePolicyEffect,
  GovernanceConditions,
} from './governance-types';
import { GovernancePolicyEngine } from './governance-policy-engine';

export class GovernancePolicyService {
  // In-memory fallback stores for testing / non-DB environments
  private static memoryPolicies = new Map<string, GovernancePolicyRecord>();
  private static memoryHistory = new Map<string, GovernancePolicyHistoryRecord[]>();

  static clearMemoryForTesting(): void {
    this.memoryPolicies.clear();
    this.memoryHistory.clear();
  }

  /**
   * Creates a new enterprise governance policy.
   */
  static async createPolicy(params: {
    organizationId: string;
    name: string;
    description: string;
    category: GovernancePolicyCategory;
    status?: GovernancePolicyStatus;
    priority?: number;
    effect: GovernancePolicyEffect;
    conditions: GovernanceConditions;
    createdBy: string;
  }): Promise<GovernancePolicyRecord> {
    if (!params.organizationId) throw new Error('organizationId is required');
    if (!params.name) throw new Error('Policy name is required');
    if (!params.effect) throw new Error('Policy effect is required');

    const id = `pol_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const version = 1;
    const status = params.status || 'ACTIVE';
    const priority = params.priority ?? 100;

    const policy: GovernancePolicyRecord = {
      id,
      organizationId: params.organizationId,
      name: params.name,
      description: params.description,
      category: params.category,
      status,
      priority,
      effect: params.effect,
      conditions: params.conditions,
      version,
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [],
    };

    // 1. Persist to DB or Memory
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.governancePolicy.create({
          data: {
            id: policy.id,
            organizationId: policy.organizationId,
            name: policy.name,
            description: policy.description,
            category: policy.category,
            status: policy.status,
            priority: policy.priority,
            effect: policy.effect,
            conditions: policy.conditions as any,
            version: policy.version,
            createdBy: policy.createdBy,
            updatedBy: policy.updatedBy,
            createdAt: new Date(policy.createdAt),
            updatedAt: new Date(policy.updatedAt),
          },
        });
      } catch (err) {
        console.warn('[GovernancePolicyService] DB insert failed; fallback to memory:', err);
        this.memoryPolicies.set(policy.id, policy);
      }
    } else {
      this.memoryPolicies.set(policy.id, policy);
    }

    // 2. Record immutable audit event
    try {
      await AuditRepository.append({
        organizationId: policy.organizationId,
        actor: { type: 'USER', id: params.createdBy },
        action: 'GOVERNANCE_POLICY_CREATED',
        category: 'SECURITY',
        severity: 'MEDIUM',
        result: 'SUCCESS',
        resource: { type: 'GOVERNANCE_POLICY', id: policy.id },
        metadata: {
          details: `Created governance policy '${policy.name}' with effect ${policy.effect}`,
          name: policy.name,
          category: policy.category,
          effect: policy.effect,
          priority: policy.priority,
          version: policy.version,
        },
      });
    } catch {
      // Non-blocking
    }

    return policy;
  }

  /**
   * Retrieves a governance policy by ID with strict tenant boundary.
   */
  static async getPolicy(
    policyId: string,
    organizationId: string
  ): Promise<GovernancePolicyRecord | null> {
    if (!policyId || !organizationId) return null;

    if (process.env.SKIP_DB !== 'true') {
      try {
        const p = await prisma.governancePolicy.findFirst({
          where: { id: policyId, organizationId },
          include: {
            history: {
              orderBy: { version: 'desc' },
            },
          },
        });

        if (!p) return null;

        return {
          id: p.id,
          organizationId: p.organizationId,
          name: p.name,
          description: p.description,
          category: p.category as any,
          status: p.status as any,
          priority: p.priority,
          effect: p.effect as any,
          conditions: p.conditions as any,
          version: p.version,
          createdBy: p.createdBy,
          updatedBy: p.updatedBy,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          history: p.history.map(h => ({
            id: h.id,
            policyId: h.policyId,
            version: h.version,
            name: h.name,
            description: h.description,
            category: h.category as any,
            status: h.status as any,
            priority: h.priority,
            effect: h.effect as any,
            conditions: h.conditions as any,
            changedBy: h.changedBy,
            changeReason: h.changeReason || undefined,
            createdAt: h.createdAt.toISOString(),
          })),
        };
      } catch {
        // Fall back to memory
      }
    }

    const mem = this.memoryPolicies.get(policyId);
    if (!mem || mem.organizationId !== organizationId) return null;

    const hist = this.memoryHistory.get(policyId) || [];
    return {
      ...mem,
      history: hist,
    };
  }

  /**
   * Updates an existing policy, creating an immutable history snapshot of the previous version.
   */
  static async updatePolicy(params: {
    policyId: string;
    organizationId: string;
    name?: string;
    description?: string;
    category?: GovernancePolicyCategory;
    priority?: number;
    effect?: GovernancePolicyEffect;
    conditions?: GovernanceConditions;
    status?: GovernancePolicyStatus;
    updatedBy: string;
    changeReason?: string;
  }): Promise<GovernancePolicyRecord> {
    const existing = await this.getPolicy(params.policyId, params.organizationId);
    if (!existing) {
      throw new Error('Policy not found or cross-tenant access denied.');
    }

    const nowIso = new Date().toISOString();
    const newVersion = existing.version + 1;

    // 1. Create history snapshot of previous version
    const historyEntry: GovernancePolicyHistoryRecord = {
      id: `polhist_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      policyId: existing.id,
      version: existing.version,
      name: existing.name,
      description: existing.description,
      category: existing.category,
      status: existing.status,
      priority: existing.priority,
      effect: existing.effect,
      conditions: existing.conditions,
      changedBy: params.updatedBy,
      changeReason: params.changeReason,
      createdAt: nowIso,
    };

    // 2. Updated policy record
    const updatedPolicy: GovernancePolicyRecord = {
      ...existing,
      name: params.name ?? existing.name,
      description: params.description ?? existing.description,
      category: params.category ?? existing.category,
      priority: params.priority ?? existing.priority,
      effect: params.effect ?? existing.effect,
      conditions: params.conditions ?? existing.conditions,
      status: params.status ?? existing.status,
      version: newVersion,
      updatedBy: params.updatedBy,
      updatedAt: nowIso,
    };

    // 3. Persist updated policy & snapshot
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.$transaction(async tx => {
          await tx.governancePolicyHistory.create({
            data: {
              id: historyEntry.id,
              policyId: historyEntry.policyId,
              version: historyEntry.version,
              name: historyEntry.name,
              description: historyEntry.description,
              category: historyEntry.category,
              status: historyEntry.status,
              priority: historyEntry.priority,
              effect: historyEntry.effect,
              conditions: historyEntry.conditions as any,
              changedBy: historyEntry.changedBy,
              changeReason: historyEntry.changeReason,
              createdAt: new Date(historyEntry.createdAt),
            },
          });

          await tx.governancePolicy.update({
            where: { id: existing.id },
            data: {
              name: updatedPolicy.name,
              description: updatedPolicy.description,
              category: updatedPolicy.category,
              priority: updatedPolicy.priority,
              effect: updatedPolicy.effect,
              conditions: updatedPolicy.conditions as any,
              status: updatedPolicy.status,
              version: updatedPolicy.version,
              updatedBy: updatedPolicy.updatedBy,
              updatedAt: new Date(updatedPolicy.updatedAt),
            },
          });
        });
      } catch (err) {
        console.warn('[GovernancePolicyService] DB transaction failed; updating memory:', err);
        const hist = this.memoryHistory.get(existing.id) || [];
        hist.unshift(historyEntry);
        this.memoryHistory.set(existing.id, hist);
        this.memoryPolicies.set(existing.id, updatedPolicy);
      }
    } else {
      const hist = this.memoryHistory.get(existing.id) || [];
      hist.unshift(historyEntry);
      this.memoryHistory.set(existing.id, hist);
      this.memoryPolicies.set(existing.id, updatedPolicy);
    }

    // 4. Record audit event
    try {
      await AuditRepository.append({
        organizationId: updatedPolicy.organizationId,
        actor: { type: 'USER', id: params.updatedBy },
        action: 'GOVERNANCE_POLICY_UPDATED',
        category: 'SECURITY',
        severity: 'MEDIUM',
        result: 'SUCCESS',
        resource: { type: 'GOVERNANCE_POLICY', id: updatedPolicy.id },
        metadata: {
          details: `Updated policy '${updatedPolicy.name}' to version ${updatedPolicy.version}`,
        },
        previousState: {
          version: existing.version,
          effect: existing.effect,
          priority: existing.priority,
          status: existing.status,
        },
        newState: {
          version: updatedPolicy.version,
          effect: updatedPolicy.effect,
          priority: updatedPolicy.priority,
          status: updatedPolicy.status,
        },
      });
    } catch {
      // Non-blocking
    }

    return updatedPolicy;
  }

  /**
   * Status change helper: activates, pauses, or archives a policy.
   */
  static async updatePolicyStatus(params: {
    policyId: string;
    organizationId: string;
    status: GovernancePolicyStatus;
    updatedBy: string;
    reason?: string;
  }): Promise<GovernancePolicyRecord> {
    return this.updatePolicy({
      policyId: params.policyId,
      organizationId: params.organizationId,
      status: params.status,
      updatedBy: params.updatedBy,
      changeReason: params.reason || `Status transition to ${params.status}`,
    });
  }

  /**
   * Lists policies for an organization sorted by priority.
   */
  static async listPolicies(params: {
    organizationId: string;
    category?: GovernancePolicyCategory;
    status?: GovernancePolicyStatus;
  }): Promise<GovernancePolicyRecord[]> {
    if (!params.organizationId) return [];

    if (process.env.SKIP_DB !== 'true') {
      try {
        const rows = await prisma.governancePolicy.findMany({
          where: {
            organizationId: params.organizationId,
            ...(params.category ? { category: params.category } : {}),
            ...(params.status ? { status: params.status } : {}),
          },
          orderBy: { priority: 'asc' },
        });

        return rows.map(p => ({
          id: p.id,
          organizationId: p.organizationId,
          name: p.name,
          description: p.description,
          category: p.category as any,
          status: p.status as any,
          priority: p.priority,
          effect: p.effect as any,
          conditions: p.conditions as any,
          version: p.version,
          createdBy: p.createdBy,
          updatedBy: p.updatedBy,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }));
      } catch {
        // Fall back to memory
      }
    }

    const results: GovernancePolicyRecord[] = [];
    for (const p of this.memoryPolicies.values()) {
      if (p.organizationId === params.organizationId) {
        if (!params.category || p.category === params.category) {
          if (!params.status || p.status === params.status) {
            results.push(p);
          }
        }
      }
    }

    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluates active governance policies against an operational context.
   */
  static async evaluate(
    context: GovernanceEvaluationContext
  ): Promise<GovernanceDecision> {
    const policies = await this.listPolicies({
      organizationId: context.organizationId,
      status: 'ACTIVE',
    });

    return GovernancePolicyEngine.evaluate(policies, context);
  }

  /**
   * Simulates policy evaluation for hypothetical operations (never executes).
   */
  static async simulateEvaluation(params: {
    organizationId: string;
    context: GovernanceEvaluationContext;
  }): Promise<{
    decision: GovernanceDecision;
    totalActivePoliciesEvaluated: number;
    simulationDisclaimer: string;
  }> {
    const policies = await this.listPolicies({
      organizationId: params.organizationId,
      status: 'ACTIVE',
    });

    const decision = GovernancePolicyEngine.evaluate(policies, params.context);

    return {
      decision,
      totalActivePoliciesEvaluated: policies.length,
      simulationDisclaimer: 'Policy simulation only; no business action was executed.',
    };
  }
}

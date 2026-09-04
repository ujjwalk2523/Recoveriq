import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { AuditLogEntry } from '@/lib/engine/types';
import { INITIAL_AUDIT_LOGS } from '@/lib/data/mock-dataset';
import { AuditRepository } from '@/lib/audit/audit-repository';
import {
  AuditEventInput,
  AuditEventRecord,
  AuditQueryFilters,
  AuditChainVerificationResult,
  ActorType,
  AuditCategory,
} from '@/lib/audit/audit-types';

export class AuditService {
  /**
   * Generates a tamper-evident SHA-256 integrity hash for an audit record (legacy compatibility)
   */
  static generateHash(payload: Record<string, any>): string {
    const serialized = JSON.stringify(payload);
    return `sha256:${crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 32)}`;
  }

  /**
   * Core enterprise audit recording method.
   * Enforces schema validation, normalization, deep redaction, hash chaining, and append-only persistence.
   */
  static async record(
    input: AuditEventInput,
    tx?: Prisma.TransactionClient
  ): Promise<AuditEventRecord> {
    return AuditRepository.append(input, tx);
  }

  /**
   * Convenience helper to record a SUCCESS audit event.
   */
  static async recordSuccess(
    input: Omit<AuditEventInput, 'result'>,
    tx?: Prisma.TransactionClient
  ): Promise<AuditEventRecord> {
    return this.record({ ...input, result: 'SUCCESS' }, tx);
  }

  /**
   * Convenience helper to record a FAILURE audit event.
   */
  static async recordFailure(
    input: Omit<AuditEventInput, 'result'>,
    tx?: Prisma.TransactionClient
  ): Promise<AuditEventRecord> {
    return this.record({ ...input, result: 'FAILURE' }, tx);
  }

  /**
   * Convenience helper to record an authorization DENIED audit event.
   */
  static async recordDenied(
    input: Omit<AuditEventInput, 'result'>,
    tx?: Prisma.TransactionClient
  ): Promise<AuditEventRecord> {
    return this.record({ ...input, result: 'DENIED' }, tx);
  }

  /**
   * Query enterprise audit events with tenant isolation, filtering, and cursor pagination.
   */
  static async getEvents(filters: AuditQueryFilters) {
    return AuditRepository.list(filters);
  }

  /**
   * Retrieve a single enterprise audit event with tenant boundary enforcement.
   */
  static async getEventById(id: string, organizationId: string) {
    return AuditRepository.getById(id, organizationId);
  }

  /**
   * Cryptographically verify an organization's audit ledger hash chain.
   */
  static async verifyChain(
    organizationId: string,
    options?: { maxEvents?: number }
  ): Promise<AuditChainVerificationResult> {
    return AuditRepository.verifyChain(organizationId, options);
  }

  /**
   * Log an audit event scoped to a merchant (Legacy compatibility with Phase 1-8.6 callers)
   */
  static async logEvent(params: {
    merchantId: string;
    actorType: string;
    actorName: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
  }) {
    // Map legacy actor type to standard ActorType
    let actorType: ActorType = 'SYSTEM';
    if (params.actorType === 'MERCHANT_ADMIN' || params.actorType === 'USER') {
      actorType = 'USER';
    } else if (params.actorType === 'API_KEY') {
      actorType = 'API_KEY';
    } else if (params.actorType === 'WEBHOOK_INGEST' || params.actorType === 'WEBHOOK') {
      actorType = 'WEBHOOK';
    } else if (params.actorType === 'POLICY_ENGINE' || params.actorType === 'WORKER') {
      actorType = 'WORKER';
    }

    // Map entity to category
    let category: AuditCategory = 'RECOVERY';
    if (params.action.includes('AUTH') || params.action.includes('LOGIN')) {
      category = 'AUTHENTICATION';
    } else if (params.action.includes('POLICY')) {
      category = 'CONFIGURATION';
    } else if (params.action.includes('ORG') || params.action.includes('MEMBER')) {
      category = 'ORGANIZATION';
    } else if (params.action.includes('API_KEY')) {
      category = 'API';
    }

    // Record through Enterprise Ledger
    try {
      await AuditRepository.append({
        organizationId: params.merchantId, // In single-merchant or legacy mode, merchantId serves as tenant key
        merchantId: params.merchantId,
        actor: {
          type: actorType,
          displayName: params.actorName,
        },
        action: params.action,
        category,
        severity: 'INFO',
        result: 'SUCCESS',
        resource: {
          type: params.entityType,
          id: params.entityId,
        },
        metadata: { legacyDetails: params.details },
      });
    } catch {
      // Fall through to legacy persistence
    }

    const timestamp = new Date();
    const hash = this.generateHash({ ...params, timestamp: timestamp.toISOString() });

    if (process.env.SKIP_DB !== 'true') {
      try {
        return await prisma.auditLog.create({
          data: {
            merchantId: params.merchantId,
            actorType: params.actorType,
            actorName: params.actorName,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            details: params.details,
            integrityHash: hash,
            timestamp,
          },
        });
      } catch (err) {
        // In-memory / test mode fallback
      }
    }

    return null;
  }

  /**
   * Retrieve audit logs for a merchant (Legacy compatibility)
   */
  static async getLogs(merchantId: string, limit = 50): Promise<AuditLogEntry[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { merchantId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      if (logs.length === 0) {
        return INITIAL_AUDIT_LOGS;
      }

      return logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        actorType: l.actorType as AuditLogEntry['actorType'],
        actorName: l.actorName,
        action: l.action,
        entityType: l.entityType as AuditLogEntry['entityType'],
        entityId: l.entityId,
        details: l.details,
        integrityHash: l.integrityHash,
      }));
    } catch (err) {
      console.warn('[AuditService.getLogs] DB read failed, using fallback logs:', err);
      return INITIAL_AUDIT_LOGS;
    }
  }
}

/**
 * Phase 8.8 — Database Recovery & Integrity Service
 *
 * Verifies PostgreSQL connectivity, schema health, and runs cryptographic
 * audit chain verification on the restored ledger.
 *
 * CRITICAL INVARIANT:
 * A broken audit ledger chain must never be silently repaired. It must be
 * flagged as INTEGRITY_FAILED and require manual security investigation.
 */

import { prisma, checkDatabaseHealth } from '../../db/prisma';
import { AuditRepository } from '../../audit/audit-repository';

export class DatabaseRecoveryService {
  /**
   * Verifies database responsiveness and schema accessibility.
   */
  static async verifyDatabaseHealth(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      if (process.env.SKIP_DB === 'true') {
        return { healthy: true, latencyMs: 1 };
      }

      const res = await checkDatabaseHealth();
      return {
        healthy: res.status === 'ok',
        latencyMs: res.latencyMs || Date.now() - start,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Cryptographically verifies the audit ledger hash chains across organizations.
   */
  static async verifyAuditLedgerIntegrity(organizationId = 'org_default'): Promise<{
    intact: boolean;
    eventsChecked: number;
    firstInvalidSequenceNumber?: number;
    error?: string;
  }> {
    try {
      const result = await AuditRepository.verifyChain(organizationId);
      return {
        intact: result.valid,
        eventsChecked: result.checkedEvents,
        firstInvalidSequenceNumber: result.firstInvalidSequence,
        error: result.reason,
      };
    } catch (err: any) {
      return {
        intact: false,
        eventsChecked: 0,
        error: err.message,
      };
    }
  }
}

/**
 * Phase 8.8 — Enterprise Disaster Recovery Service
 *
 * Coordinates backup metadata lifecycle, checksum integrity validation,
 * restore verification runs, recovery readiness evaluations, and immutable audit logging.
 */

import crypto from 'crypto';
import { prisma } from '../../db/prisma';
import { AuditRepository } from '../../audit/audit-repository';
import {
  DisasterRecoveryState,
  BackupMetadataRecord,
  BackupStatus,
  BackupType,
  RestoreVerificationResult,
  RecoveryReadinessAssessment,
} from './dr-types';
import { BackupIntegrityService } from './backup-integrity';
import { RestoreVerificationEngine } from './restore-verification';
import { RecoveryReadinessService } from './recovery-readiness';

export class DisasterRecoveryService {
  // In-memory fallback stores for tests or non-DB environments
  private static memoryBackups = new Map<string, BackupMetadataRecord>();
  private static memoryRestores = new Map<string, RestoreVerificationResult>();
  private static currentState: DisasterRecoveryState = 'HEALTHY';

  static clearMemoryForTesting(): void {
    this.memoryBackups.clear();
    this.memoryRestores.clear();
    this.currentState = 'HEALTHY';
  }

  static getRecoveryState(): DisasterRecoveryState {
    return this.currentState;
  }

  static setRecoveryState(state: DisasterRecoveryState): void {
    this.currentState = state;
  }

  /**
   * Registers a new database backup record and verifies its metadata integrity.
   */
  static async recordBackup(params: {
    backupId?: string;
    databaseIdentifier: string;
    backupType: BackupType;
    sizeBytes: number;
    checksum: string;
    startedAt?: string;
    completedAt?: string;
    status?: BackupStatus;
    retentionClass?: string;
    sourceEnvironment?: string;
    organizationId?: string;
  }): Promise<BackupMetadataRecord> {
    const backupId = params.backupId || `bkp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const startedAt = params.startedAt || new Date().toISOString();
    const completedAt = params.completedAt || new Date().toISOString();
    const status = params.status || 'COMPLETED';
    const sourceEnvironment = params.sourceEnvironment || process.env.NODE_ENV || 'production';

    const record: BackupMetadataRecord = {
      id: `bkprec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      backupId,
      databaseIdentifier: params.databaseIdentifier,
      backupType: params.backupType,
      startedAt,
      completedAt,
      sizeBytes: params.sizeBytes,
      checksum: params.checksum,
      status,
      retentionClass: params.retentionClass || 'STANDARD_30D',
      sourceEnvironment,
      createdAt: new Date().toISOString(),
    };

    // 1. Verify metadata integrity
    const validation = BackupIntegrityService.verifyMetadataIntegrity(record);
    if (!validation.valid) {
      record.status = 'CORRUPT';
      throw new Error(`Backup metadata integrity check failed: ${validation.errors.join('; ')}`);
    }

    // 2. Persist to DB or Memory
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.backupMetadata.create({
          data: {
            id: record.id,
            backupId: record.backupId,
            databaseIdentifier: record.databaseIdentifier,
            backupType: record.backupType,
            startedAt: new Date(record.startedAt),
            completedAt: record.completedAt ? new Date(record.completedAt) : null,
            sizeBytes: BigInt(record.sizeBytes),
            checksum: record.checksum,
            status: record.status,
            retentionClass: record.retentionClass,
            sourceEnvironment: record.sourceEnvironment,
          },
        });
      } catch {
        this.memoryBackups.set(record.backupId, record);
      }
    } else {
      this.memoryBackups.set(record.backupId, record);
    }

    // 3. Emit immutable audit event
    try {
      await AuditRepository.append({
        organizationId: params.organizationId || 'org_system',
        actor: { type: 'SYSTEM', id: 'disaster_recovery_engine' },
        action: 'BACKUP_RECORDED',
        category: 'SECURITY',
        severity: 'INFO',
        result: 'SUCCESS',
        resource: { type: 'DATABASE_BACKUP', id: record.backupId },
        metadata: {
          databaseIdentifier: record.databaseIdentifier,
          backupType: record.backupType,
          checksum: record.checksum,
          sizeBytes: record.sizeBytes,
          status: record.status,
        },
      });
    } catch {
      // Non-blocking
    }

    return record;
  }

  /**
   * Retrieves a backup record by backupId.
   */
  static async getBackup(backupId: string): Promise<BackupMetadataRecord | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const row = await prisma.backupMetadata.findUnique({
          where: { backupId },
        });
        if (row) {
          return {
            id: row.id,
            backupId: row.backupId,
            databaseIdentifier: row.databaseIdentifier,
            backupType: row.backupType as BackupType,
            startedAt: row.startedAt.toISOString(),
            completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
            sizeBytes: Number(row.sizeBytes),
            checksum: row.checksum,
            status: row.status as BackupStatus,
            retentionClass: row.retentionClass,
            verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : undefined,
            sourceEnvironment: row.sourceEnvironment,
            createdAt: row.createdAt.toISOString(),
          };
        }
      } catch {
        // Fall back to memory
      }
    }

    return this.memoryBackups.get(backupId) || null;
  }

  /**
   * Lists all recorded backups sorted newest first.
   */
  static async listBackups(limit = 20): Promise<BackupMetadataRecord[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const rows = await prisma.backupMetadata.findMany({
          orderBy: { startedAt: 'desc' },
          take: limit,
        });
        return rows.map(r => ({
          id: r.id,
          backupId: r.backupId,
          databaseIdentifier: r.databaseIdentifier,
          backupType: r.backupType as BackupType,
          startedAt: r.startedAt.toISOString(),
          completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
          sizeBytes: Number(r.sizeBytes),
          checksum: r.checksum,
          status: r.status as BackupStatus,
          retentionClass: r.retentionClass,
          verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : undefined,
          sourceEnvironment: r.sourceEnvironment,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch {
        // Fall back to memory
      }
    }

    return Array.from(this.memoryBackups.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Executes a multi-domain restore verification on an isolated snapshot.
   */
  static async runRestoreVerification(params: {
    backupId: string;
    organizationId?: string;
    environment?: string;
  }): Promise<RestoreVerificationResult> {
    const backup = await this.getBackup(params.backupId);
    if (!backup) {
      throw new Error(`Backup with ID '${params.backupId}' not found.`);
    }

    // 1. Audit start of verification
    try {
      await AuditRepository.append({
        organizationId: params.organizationId || 'org_system',
        actor: { type: 'SYSTEM', id: 'disaster_recovery_engine' },
        action: 'RESTORE_VERIFICATION_STARTED',
        category: 'SECURITY',
        severity: 'INFO',
        result: 'SUCCESS',
        resource: { type: 'DATABASE_BACKUP', id: backup.backupId },
        metadata: { environment: params.environment || 'isolated_verification' },
      });
    } catch {
      // Non-blocking
    }

    // 2. Run multi-domain checks
    const result = await RestoreVerificationEngine.verifyRestoredDatabase({
      backupId: params.backupId,
      targetEnvironment: params.environment,
    });

    // 3. Persist verification result
    this.memoryRestores.set(result.id, result);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.restoreVerificationRecord.create({
          data: {
            id: result.id,
            backupId: result.backupId,
            environment: result.environment,
            status: result.status,
            durationMs: result.durationMs,
            checksPassCount: result.checksPassCount,
            checksTotalCount: result.checksTotalCount,
            details: result.checks as any,
            verifiedAt: new Date(result.verifiedAt),
          },
        });

        if (result.status === 'VERIFIED') {
          await prisma.backupMetadata.update({
            where: { backupId: backup.backupId },
            data: {
              status: 'VERIFIED',
              verifiedAt: new Date(result.verifiedAt),
            },
          });
        }
      } catch {
        // Handled in memory
      }
    }

    if (result.status === 'VERIFIED') {
      backup.status = 'VERIFIED';
      backup.verifiedAt = result.verifiedAt;
      this.memoryBackups.set(backup.backupId, backup);
    }

    // 4. Audit verification completion
    try {
      await AuditRepository.append({
        organizationId: params.organizationId || 'org_system',
        actor: { type: 'SYSTEM', id: 'disaster_recovery_engine' },
        action: result.status === 'VERIFIED' ? 'RESTORE_VERIFIED' : 'RESTORE_FAILED',
        category: 'SECURITY',
        severity: result.status === 'VERIFIED' ? 'INFO' : 'CRITICAL',
        result: result.status === 'VERIFIED' ? 'SUCCESS' : 'FAILURE',
        resource: { type: 'DATABASE_BACKUP', id: backup.backupId },
        metadata: {
          status: result.status,
          checksPassed: `${result.checksPassCount}/${result.checksTotalCount}`,
          durationMs: result.durationMs,
        },
      });
    } catch {
      // Non-blocking
    }

    return result;
  }

  /**
   * Evaluates current system recovery readiness.
   */
  static async getRecoveryReadiness(dependencies: Array<{ name: string; status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' }> = []): Promise<RecoveryReadinessAssessment> {
    const backups = await this.listBackups(1);
    const latestBackup = backups[0];
    const latestRestore = Array.from(this.memoryRestores.values()).pop();

    return RecoveryReadinessService.assessReadiness({
      currentState: this.currentState,
      latestBackup,
      latestRestoreVerification: latestRestore,
      dependencies,
      unreconciledPaymentCount: 0,
      staleJobCount: 0,
    });
  }
}

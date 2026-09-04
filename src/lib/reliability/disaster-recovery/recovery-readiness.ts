/**
 * Phase 8.8 — Recovery Readiness Assessor
 *
 * Continuously evaluates platform recoverability by checking backup age,
 * restore verification currency, dependency health, and reconciliation backlogs.
 */

import { DR_CONFIG } from './dr-config';
import {
  DisasterRecoveryState,
  BackupMetadataRecord,
  RestoreVerificationResult,
  RecoveryReadinessAssessment,
} from './dr-types';

export class RecoveryReadinessService {
  /**
   * Evaluates overall platform recovery readiness against configured SLOs.
   */
  static assessReadiness(params: {
    currentState: DisasterRecoveryState;
    latestBackup?: BackupMetadataRecord;
    latestRestoreVerification?: RestoreVerificationResult;
    dependencies: Array<{ name: string; status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' }>;
    unreconciledPaymentCount: number;
    staleJobCount: number;
  }): RecoveryReadinessAssessment {
    const checks: Array<{ name: string; ready: boolean; reason: string }> = [];
    let overallReady = true;

    // 1. Backup Currency Check
    let rpoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN' = 'UNKNOWN';
    if (!params.latestBackup) {
      checks.push({
        name: 'Backup Availability',
        ready: false,
        reason: 'No completed database backups recorded.',
      });
      overallReady = false;
      rpoStatus = 'BREACHED';
    } else {
      const backupAgeMs = Date.now() - new Date(params.latestBackup.startedAt).getTime();
      const backupAgeHours = backupAgeMs / (1000 * 60 * 60);

      if (backupAgeHours > DR_CONFIG.maxAllowedBackupAgeHours) {
        checks.push({
          name: 'Backup Currency',
          ready: false,
          reason: `Latest backup is ${backupAgeHours.toFixed(1)}h old (exceeds ${DR_CONFIG.maxAllowedBackupAgeHours}h threshold).`,
        });
        overallReady = false;
        rpoStatus = 'BREACHED';
      } else {
        checks.push({
          name: 'Backup Currency',
          ready: true,
          reason: `Latest backup is ${backupAgeHours.toFixed(1)}h old (within target).`,
        });
        rpoStatus = 'WITHIN_OBJECTIVE';
      }
    }

    // 2. Restore Verification Check
    let rtoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN' = 'UNKNOWN';
    if (!params.latestRestoreVerification) {
      checks.push({
        name: 'Restore Verification',
        ready: false,
        reason: 'No restore verification has been executed.',
      });
      overallReady = false;
    } else if (params.latestRestoreVerification.status !== 'VERIFIED') {
      checks.push({
        name: 'Restore Verification',
        ready: false,
        reason: `Latest restore verification status is ${params.latestRestoreVerification.status}.`,
      });
      overallReady = false;
      rtoStatus = 'BREACHED';
    } else {
      checks.push({
        name: 'Restore Verification',
        ready: true,
        reason: `Latest restore verification passed all ${params.latestRestoreVerification.checksTotalCount} checks.`,
      });
      rtoStatus = 'WITHIN_OBJECTIVE';
    }

    // 3. Dependency Health Check
    const healthyCount = params.dependencies.filter(d => d.status === 'HEALTHY').length;
    const degradedCount = params.dependencies.filter(d => d.status === 'DEGRADED').length;
    const unavailableCount = params.dependencies.filter(d => d.status === 'UNAVAILABLE').length;

    if (unavailableCount > 0) {
      checks.push({
        name: 'Critical Dependencies',
        ready: false,
        reason: `${unavailableCount} critical dependencies are unavailable.`,
      });
      overallReady = false;
    } else {
      checks.push({
        name: 'Critical Dependencies',
        ready: true,
        reason: 'All critical dependencies are responsive.',
      });
    }

    // 4. Reconciliation Backlog Check
    if (params.unreconciledPaymentCount > 50) {
      checks.push({
        name: 'Payment Reconciliation Backlog',
        ready: false,
        reason: `${params.unreconciledPaymentCount} uncertain payments awaiting reconciliation.`,
      });
      overallReady = false;
    } else {
      checks.push({
        name: 'Payment Reconciliation Backlog',
        ready: true,
        reason: `Reconciliation queue within normal operational bounds (${params.unreconciledPaymentCount} pending).`,
      });
    }

    // 5. Stale Job Leases Check
    if (params.staleJobCount > 20) {
      checks.push({
        name: 'Worker Lease Health',
        ready: false,
        reason: `${params.staleJobCount} expired worker leases detected.`,
      });
      overallReady = false;
    } else {
      checks.push({
        name: 'Worker Lease Health',
        ready: true,
        reason: 'Worker leases are healthy.',
      });
    }

    return {
      overallReady,
      recoveryState: params.currentState,
      lastSuccessfulBackup: params.latestBackup,
      lastVerifiedRestore: params.latestRestoreVerification,
      rpoStatus,
      rtoStatus,
      dependencyHealthSummary: {
        healthy: healthyCount,
        degraded: degradedCount,
        unavailable: unavailableCount,
      },
      unreconciledPaymentCount: params.unreconciledPaymentCount,
      staleJobCount: params.staleJobCount,
      readinessChecks: checks,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

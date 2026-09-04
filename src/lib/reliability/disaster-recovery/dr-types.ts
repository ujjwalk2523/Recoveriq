/**
 * Phase 8.8 — Disaster Recovery Types & Recovery State Models
 *
 * Defines recovery states, backup metadata types, restore verification checks,
 * and recovery readiness contracts.
 */

export type DisasterRecoveryState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RECOVERING'
  | 'RECONCILING'
  | 'RESTORED'
  | 'READY'
  | 'FAILED'
  | 'MANUAL_INTERVENTION_REQUIRED';

export type BackupStatus =
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'VERIFIED'
  | 'CORRUPT'
  | 'EXPIRED';

export type BackupType = 'FULL' | 'INCREMENTAL' | 'LOG' | 'DIFFERENTIAL';

export interface BackupMetadataRecord {
  id: string;
  backupId: string;
  databaseIdentifier: string;
  backupType: BackupType;
  startedAt: string;
  completedAt?: string;
  sizeBytes: number;
  checksum: string; // SHA-256
  status: BackupStatus;
  retentionClass: string;
  verifiedAt?: string;
  sourceEnvironment: string;
  createdAt: string;
}

export type RestoreVerificationDomain =
  | 'IDENTITY'
  | 'PAYMENTS'
  | 'INTELLIGENCE'
  | 'BILLING'
  | 'ENTERPRISE_GOVERNANCE';

export interface RestoreVerificationCheck {
  domain: RestoreVerificationDomain;
  name: string;
  passed: boolean;
  message: string;
  recordsChecked?: number;
  durationMs?: number;
}

export interface RestoreVerificationResult {
  id: string;
  backupId: string;
  environment: string;
  status: 'VERIFIED' | 'FAILED' | 'RUNNING';
  durationMs: number;
  checksPassCount: number;
  checksTotalCount: number;
  checks: RestoreVerificationCheck[];
  verifiedAt: string;
}

export interface RecoveryReadinessAssessment {
  overallReady: boolean;
  recoveryState: DisasterRecoveryState;
  lastSuccessfulBackup?: BackupMetadataRecord;
  lastVerifiedRestore?: RestoreVerificationResult;
  rpoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN';
  rtoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN';
  dependencyHealthSummary: {
    healthy: number;
    degraded: number;
    unavailable: number;
  };
  unreconciledPaymentCount: number;
  staleJobCount: number;
  readinessChecks: Array<{
    name: string;
    ready: boolean;
    reason: string;
  }>;
  evaluatedAt: string;
}

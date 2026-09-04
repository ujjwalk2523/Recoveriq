/**
 * Phase 8.8 — Failure Semantics & Explicit Error Classifications
 *
 * Provides strongly-typed reliability error classifications avoiding generic booleans.
 */

export type ReliabilityErrorCode =
  | 'DATABASE_UNAVAILABLE'
  | 'REDIS_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_STATE_UNKNOWN'
  | 'RECONCILIATION_REQUIRED'
  | 'RESTORE_VERIFICATION_FAILED'
  | 'BACKUP_INTEGRITY_FAILED'
  | 'AUDIT_INTEGRITY_FAILED'
  | 'RECOVERY_BLOCKED'
  | 'MANUAL_INTERVENTION_REQUIRED'
  | 'STALE_LEASE_DETECTED'
  | 'CROSS_TENANT_QUARANTINE_VIOLATION';

export class ReliabilityError extends Error {
  readonly code: ReliabilityErrorCode;
  readonly safeMessage: string;
  readonly recoverable: boolean;
  readonly requiresManualIntervention: boolean;

  constructor(params: {
    code: ReliabilityErrorCode;
    message: string;
    safeMessage?: string;
    recoverable?: boolean;
    requiresManualIntervention?: boolean;
  }) {
    super(params.message);
    this.name = 'ReliabilityError';
    this.code = params.code;
    this.safeMessage = params.safeMessage || params.message;
    this.recoverable = params.recoverable ?? true;
    this.requiresManualIntervention = params.requiresManualIntervention ?? false;
  }
}

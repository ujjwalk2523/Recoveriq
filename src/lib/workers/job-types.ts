import { RecoveryActionType } from '../engine/types';

export type JobStatus =
  | 'PENDING'
  | 'READY'
  | 'PROCESSING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface RecoveryJob {
  jobId: string;
  merchantId: string;
  transactionId: string;
  sequenceId: string;
  stepNumber: number;
  actionType: RecoveryActionType;
  channel?: string;
  amount: number;
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
  scheduledAt: string; // ISO 8601 string
  delayMs: number;
  attemptNumber: number;
  maxAttempts: number;
  idempotencyKey: string;
  status: JobStatus;
  createdAt: string;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface WorkerClaimResult {
  job: RecoveryJob;
  leaseId: string;
  expiresAt: number;
}

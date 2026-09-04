export enum RecoverIQEventType {
  // Payment Events
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_RECOVERED = 'payment.recovered',

  // Recovery Engine Events
  RECOVERY_DECISION_CREATED = 'recovery.decision.created',
  RECOVERY_SEQUENCE_CREATED = 'recovery.sequence.created',
  RECOVERY_ATTEMPT_STARTED = 'recovery.attempt.started',
  RECOVERY_ATTEMPT_FAILED = 'recovery.attempt.failed',
  RECOVERY_ATTEMPT_SUCCEEDED = 'recovery.attempt.succeeded',
  RECOVERY_COMPLETED = 'recovery.completed',
  RECOVERY_HALTED = 'recovery.halted',
  RECOVERY_SUPPRESSED = 'recovery.suppressed',

  // Human Approval Events
  RECOVERY_APPROVAL_REQUIRED = 'recovery.approval.required',
  RECOVERY_APPROVED = 'recovery.approved',
  RECOVERY_REJECTED = 'recovery.rejected',

  // Intelligence Events
  INTELLIGENCE_ANOMALY_DETECTED = 'intelligence.anomaly.detected',
  INTELLIGENCE_MODEL_FALLBACK = 'intelligence.model.fallback',

  // Synthetic Test Event
  WEBHOOK_TEST = 'webhook.test',
}

export const ALL_RECOVERIQ_EVENT_TYPES: RecoverIQEventType[] = Object.values(RecoverIQEventType);

export const BILLABLE_EVENT_TYPES: RecoverIQEventType[] = [
  RecoverIQEventType.PAYMENT_FAILED,
  RecoverIQEventType.PAYMENT_RECOVERED,
  RecoverIQEventType.RECOVERY_COMPLETED,
];

export function isValidEventType(type: string): boolean {
  return ALL_RECOVERIQ_EVENT_TYPES.includes(type as RecoverIQEventType);
}

export interface DomainEventEnvelope<T = any> {
  id: string;
  merchantId: string;
  type: RecoverIQEventType;
  version: number;
  aggregateType: 'payment' | 'recovery' | 'approval' | 'intelligence' | 'system';
  aggregateId: string;
  createdAt: string;
  payload: T;
  test?: boolean;
}

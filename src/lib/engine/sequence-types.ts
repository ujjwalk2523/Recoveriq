import { RecoveryActionType } from './types';
import { SequenceStopCondition } from './strategy-definition';

export type SequenceStatus = 
  | 'ACTIVE' 
  | 'AWAITING_APPROVAL' 
  | 'PAUSED' 
  | 'COMPLETED' 
  | 'HALTED' 
  | 'SUPPRESSED';

export type StepStatus = 
  | 'PENDING' 
  | 'DISPATCHED' 
  | 'FAILED' 
  | 'SUCCEEDED' 
  | 'SKIPPED' 
  | 'CANCELLED';

export type StepOutcomeType = 
  | 'PAYMENT_CAPTURED'
  | 'ATTEMPT_FAILED'
  | 'LINK_OPENED'
  | 'LINK_EXPIRED'
  | 'FATIGUE_EXCEEDED'
  | 'OPERATOR_APPROVED'
  | 'OPERATOR_REJECTED';

export interface StepOutcome {
  eventType: StepOutcomeType;
  gatewayPaymentId?: string;
  errorMessage?: string;
  amount?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SequenceStep {
  stepNumber: number;
  actionType: RecoveryActionType;
  channel: string;
  delayMinutes: number;
  scheduledAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
  status: StepStatus;
  rationale: string;
  attemptId?: string;
  outcome?: StepOutcome;
}

export interface SequenceTransitionHistoryItem {
  timestamp: string;
  fromStep: number;
  toStep?: number;
  triggerEvent: StepOutcomeType;
  explanation: string;
  resultingStatus: SequenceStatus;
  stopCondition?: SequenceStopCondition;
}

export interface RecoverySequence {
  id: string;
  transactionId: string;
  merchantId: string;
  strategyId: string;
  strategyName: string;
  status: SequenceStatus;
  currentStepIndex: number; // 0-indexed into steps
  steps: SequenceStep[];
  stopCondition?: SequenceStopCondition;
  stopReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  transitionHistory: SequenceTransitionHistoryItem[];
}

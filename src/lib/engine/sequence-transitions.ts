import { RecoverySequence, StepOutcome, SequenceStatus } from './sequence-types';
import { SequenceStopCondition } from './strategy-definition';

export interface SequenceTransitionResult {
  newStatus: SequenceStatus;
  nextStepIndex?: number;
  stopCondition?: SequenceStopCondition;
  stopReason?: string;
  explanation: string;
  scheduledDelayMinutes: number;
  keepStepActive?: boolean;
}

export class SequenceTransitionEngine {
  /**
   * Pure deterministic state machine evaluating the next step or terminal condition for a sequence
   */
  static evaluate(params: {
    sequence: RecoverySequence;
    outcome: StepOutcome;
    customerFatigueScore: number;
    maxFatigueThreshold?: number;
  }): SequenceTransitionResult {
    const { sequence, outcome, customerFatigueScore, maxFatigueThreshold = 70 } = params;
    const currentStep = sequence.steps[sequence.currentStepIndex];
    const currentStepNumber = currentStep?.stepNumber || 1;

    // 1. Success Terminal Condition: PAYMENT_CAPTURED
    if (outcome.eventType === 'PAYMENT_CAPTURED') {
      return {
        newStatus: 'COMPLETED',
        stopCondition: 'PAID',
        stopReason: `Payment successfully recovered via ${currentStep?.channel || 'gateway'}.`,
        explanation: `Step ${currentStepNumber} (${currentStep?.actionType}) succeeded. Recovery goal achieved. Stopping sequence.`,
        scheduledDelayMinutes: 0,
      };
    }

    // 2. Operator Rejection Terminal Condition
    if (outcome.eventType === 'OPERATOR_REJECTED') {
      return {
        newStatus: 'HALTED',
        stopCondition: 'OPERATOR_REJECTED',
        stopReason: outcome.errorMessage || 'Manual recovery action declined by merchant operator.',
        explanation: `Sequence halted at Step ${currentStepNumber} due to merchant operator rejection.`,
        scheduledDelayMinutes: 0,
      };
    }

    // 3. Customer Fatigue Ceiling Terminal Condition
    if (outcome.eventType === 'FATIGUE_EXCEEDED' || customerFatigueScore >= maxFatigueThreshold) {
      return {
        newStatus: 'HALTED',
        stopCondition: 'FATIGUE_EXCEEDED',
        stopReason: `Customer fatigue level (${customerFatigueScore}/100) reached ceiling (${maxFatigueThreshold}).`,
        explanation: `Customer contact fatigue exceeded. Terminating further nudges to eliminate customer churn risk.`,
        scheduledDelayMinutes: 0,
      };
    }

    // 4. In-flight Link Interaction: LINK_OPENED
    if (outcome.eventType === 'LINK_OPENED') {
      return {
        newStatus: 'ACTIVE',
        nextStepIndex: sequence.currentStepIndex,
        keepStepActive: true,
        explanation: `Customer opened payment link. Extending window to allow checkout completion before triggering fallback step.`,
        scheduledDelayMinutes: 15,
      };
    }

    // 5. Operator Approval: Transition from AWAITING_APPROVAL -> ACTIVE
    if (outcome.eventType === 'OPERATOR_APPROVED') {
      return {
        newStatus: 'ACTIVE',
        nextStepIndex: sequence.currentStepIndex,
        explanation: `Operator approved Step ${currentStepNumber} (${currentStep?.actionType}). Dispatching action immediately.`,
        scheduledDelayMinutes: 0,
      };
    }

    // 6. Failures & Timeouts: ATTEMPT_FAILED or LINK_EXPIRED
    if (outcome.eventType === 'ATTEMPT_FAILED' || outcome.eventType === 'LINK_EXPIRED') {
      const nextIndex = sequence.currentStepIndex + 1;

      // Has subsequent step in strategy blueprint
      if (nextIndex < sequence.steps.length) {
        const nextStep = sequence.steps[nextIndex];
        const triggerDesc = outcome.eventType === 'LINK_EXPIRED' ? 'Payment link expired without payment' : `Attempt ${currentStepNumber} failed (${outcome.errorMessage || 'gateway decline'})`;
        
        return {
          newStatus: 'ACTIVE',
          nextStepIndex: nextIndex,
          scheduledDelayMinutes: nextStep.delayMinutes,
          explanation: `${triggerDesc}. Advancing to Step ${nextStep.stepNumber} (${nextStep.actionType}) via ${nextStep.channel} after ${nextStep.delayMinutes} min cooling period.`,
        };
      }

      // No more steps remaining in sequence
      return {
        newStatus: 'HALTED',
        stopCondition: 'MAX_ATTEMPTS_REACHED',
        stopReason: `All ${sequence.steps.length} recovery steps in ${sequence.strategyName} exhausted without settlement.`,
        explanation: `Reached end of sequence (${sequence.steps.length} steps executed). Final status marked as unrecovered.`,
        scheduledDelayMinutes: 0,
      };
    }

    // Default fallback
    return {
      newStatus: sequence.status,
      nextStepIndex: sequence.currentStepIndex,
      explanation: `Received event ${outcome.eventType}. Maintaining current sequence state.`,
      scheduledDelayMinutes: 0,
    };
  }
}

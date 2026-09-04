import { RecoverySequence, SequenceStep, StepOutcome } from './sequence-types';
import { SequenceStopCondition } from './strategy-definition';

export class SequenceTraceExplainer {
  /**
   * Explains why a specific step was selected in the recovery sequence
   */
  static explainStepSelection(
    step: SequenceStep,
    previousStep?: SequenceStep,
    triggerOutcome?: StepOutcome
  ): string {
    if (step.stepNumber === 1) {
      return `Step 1 (${step.actionType}) was initiated as the primary intervention based on initial failure classification and strategy blueprint: ${step.rationale}`;
    }

    const prevDesc = previousStep
      ? `Step ${previousStep.stepNumber} (${previousStep.actionType})`
      : 'Previous attempt';

    const triggerDesc = triggerOutcome?.eventType === 'LINK_EXPIRED'
      ? 'Payment link expired without customer completion'
      : triggerOutcome?.eventType === 'ATTEMPT_FAILED'
      ? `Encountered gateway error (${triggerOutcome.errorMessage || 'declined'})`
      : 'Previous step timed out';

    return `${prevDesc} outcome: ${triggerDesc}. Transitioned to Step ${step.stepNumber} (${step.actionType}) via ${step.channel}. Rationale: ${step.rationale}`;
  }

  /**
   * Explains why RecoverIQ stopped executing further recovery steps
   */
  static explainSequenceStop(
    stopCondition: SequenceStopCondition,
    stopReason?: string
  ): string {
    switch (stopCondition) {
      case 'PAID':
        return `Sequence successfully concluded: Payment was captured and settled. Full transaction value recovered.`;
      case 'FATIGUE_EXCEEDED':
        return `Sequence halted to protect Customer LTV: ${stopReason || 'Customer contact fatigue threshold reached. Continuing outreach risks subscriber churn.'}`;
      case 'MAX_ATTEMPTS_REACHED':
        return `Sequence completed all planned interventions: ${stopReason || 'Strategy steps exhausted without settlement. Marking as permanently unrecovered to prevent spam.'}`;
      case 'OPERATOR_REJECTED':
        return `Sequence halted by merchant policy: Operator reviewed and rejected further automated interventions (${stopReason || 'manual override'}).`;
      case 'FRAUD_DETECTED':
        return `Sequence suppressed: Prohibited by risk guardrails due to fraudulent or hotlisted card scheme flags.`;
      case 'EXPIRED':
        return `Sequence expired: The maximum recovery window (48 hours) elapsed without customer payment.`;
      case 'MANUAL_OVERRIDE':
        return `Sequence halted via administrative manual override.`;
      default:
        return `Sequence stopped. Condition: ${stopCondition}. ${stopReason || ''}`;
    }
  }

  /**
   * Formats a complete explainability summary for an audit log or dashboard modal
   */
  static generateFullAuditStory(sequence: RecoverySequence): string[] {
    const story: string[] = [];

    story.push(`Strategy Initialized: ${sequence.strategyName} (${sequence.strategyId})`);

    for (const transition of sequence.transitionHistory) {
      story.push(`[${transition.timestamp.split('T')[1]?.slice(0, 8) || '00:00:00'}] Step ${transition.fromStep} -> ${transition.toStep ? `Step ${transition.toStep}` : 'STOP'}: ${transition.explanation}`);
    }

    if (sequence.stopCondition) {
      story.push(`Terminal Exit Condition [${sequence.stopCondition}]: ${this.explainSequenceStop(sequence.stopCondition, sequence.stopReason)}`);
    }

    return story;
  }
}

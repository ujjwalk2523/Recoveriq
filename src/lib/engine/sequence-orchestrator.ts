import { prisma } from '@/lib/db/prisma';
import { AttemptStatus, PaymentStatus } from '@prisma/client';
import { CustomerProfile, FailureCategory } from './types';
import { PolicyCheckResult } from './policy-guardrails';
import { resolveOptimalStrategy, RecoveryStrategyDefinition } from './strategy-definition';
import { RecoverySequence, SequenceStep, StepOutcome } from './sequence-types';
import { SequenceTransitionEngine } from './sequence-transitions';
import { SequenceTraceExplainer } from './sequence-trace';
import { AuditService } from '@/lib/services/audit.service';
import { RecoveryJobQueue } from '../queue/recovery-queue';
import { IdempotencyGuard } from '../execution/idempotency';
import { RecoverIQEventStore, RecoverIQEventType } from '@/lib/webhooks';

// In-memory fallback sequence storage for offline resilience / test suites
const IN_MEMORY_SEQUENCES = new Map<string, RecoverySequence>();

export class RecoveryOrchestrator {
  /**
   * Initializes and starts a new Recovery Sequence for a failed transaction
   */
  static async startSequence(params: {
    transactionId: string;
    merchantId: string;
    failureCategory: FailureCategory;
    customer: CustomerProfile;
    amount: number;
    policyCheck: PolicyCheckResult;
    isAutoApproved: boolean;
  }): Promise<RecoverySequence> {
    const { transactionId, merchantId, failureCategory, customer, amount, policyCheck, isAutoApproved } = params;

    // 1. Resolve optimal strategy blueprint
    const strategy: RecoveryStrategyDefinition = resolveOptimalStrategy({
      failureCategory,
      customerSegment: customer.segment,
      amount,
      isFraudOrHotlisted: failureCategory === 'RISK_AND_FRAUD',
    });

    const now = new Date().toISOString();

    // 2. Build Sequence Steps from Blueprint
    const steps: SequenceStep[] = strategy.defaultSteps.map(s => ({
      stepNumber: s.stepNumber,
      actionType: s.actionType,
      channel: s.channel,
      delayMinutes: s.delayMinutes,
      status: 'PENDING',
      rationale: s.rationale,
    }));

    // 3. Compile Sequence Object
    const sequence: RecoverySequence = {
      id: `seq_${transactionId}`,
      transactionId,
      merchantId,
      strategyId: strategy.id,
      strategyName: strategy.name,
      status: isAutoApproved ? 'ACTIVE' : 'AWAITING_APPROVAL',
      currentStepIndex: 0,
      steps,
      createdAt: now,
      updatedAt: now,
      transitionHistory: [
        {
          timestamp: now,
          fromStep: 0,
          toStep: 1,
          triggerEvent: isAutoApproved ? 'OPERATOR_APPROVED' : 'ATTEMPT_FAILED',
          explanation: isAutoApproved
            ? `Initialized ${strategy.name}. Auto-approved by Policy Guardrails. Dispatching Step 1.`
            : `Initialized ${strategy.name}. Paused in AWAITING_APPROVAL: ${policyCheck.approvalReasons.join('; ')}.`,
          resultingStatus: isAutoApproved ? 'ACTIVE' : 'AWAITING_APPROVAL',
        },
      ],
    };

    // 4. If auto-approved, dispatch Step 1 immediately or schedule delayed job
    if (isAutoApproved && steps[0] && steps[0].actionType !== 'DO_NOT_RECOVER') {
      steps[0].status = 'DISPATCHED';
      steps[0].dispatchedAt = now;
      const delayMs = steps[0].delayMinutes * 60000;
      const scheduledFor = new Date(Date.now() + delayMs).toISOString();
      steps[0].scheduledAt = scheduledFor;

      const idempotencyKey = IdempotencyGuard.generateKey({
        merchantId,
        transactionId,
        sequenceId: sequence.id,
        stepNumber: 1,
      });

      await this.persistRecoveryAttempt({
        transactionId,
        sequenceId: sequence.id,
        stepNumber: 1,
        actionType: steps[0].actionType,
        channel: steps[0].channel,
        status: AttemptStatus.DISPATCHED,
        idempotencyKey,
        scheduledAt: scheduledFor,
      });

      // Schedule background queue job
      try {
        await RecoveryJobQueue.scheduleJob({
          merchantId,
          transactionId,
          sequenceId: sequence.id,
          stepNumber: 1,
          actionType: steps[0].actionType,
          channel: steps[0].channel,
          idempotencyKey,
          amount,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          scheduledFor,
          delayMs,
        });
      } catch {
        // resilient queue
      }

      // Emit attempt started (Phase 7.4)
      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.RECOVERY_ATTEMPT_STARTED,
        aggregateType: 'recovery',
        aggregateId: sequence.id,
        payload: {
          sequenceId: sequence.id,
          transactionId,
          stepNumber: 1,
          actionType: steps[0].actionType,
          channel: steps[0].channel,
        },
      }).catch(() => {});
    }

    // Emit RecoverIQ Domain Events (Phase 7.4)
    RecoverIQEventStore.emitEvent({
      merchantId,
      type: RecoverIQEventType.RECOVERY_SEQUENCE_CREATED,
      aggregateType: 'recovery',
      aggregateId: sequence.id,
      payload: {
        sequenceId: sequence.id,
        transactionId,
        strategyName: strategy.name,
        isAutoApproved,
        amount,
      },
    }).catch(() => {});

    if (!isAutoApproved) {
      RecoverIQEventStore.emitEvent({
        merchantId,
        type: RecoverIQEventType.RECOVERY_APPROVAL_REQUIRED,
        aggregateType: 'approval',
        aggregateId: sequence.id,
        payload: {
          sequenceId: sequence.id,
          transactionId,
          amount,
          reasons: policyCheck.approvalReasons,
        },
      }).catch(() => {});
    }

    // Save in memory cache
    IN_MEMORY_SEQUENCES.set(transactionId, sequence);

    return sequence;
  }

  /**
   * Processes an observed outcome for a running step (e.g. failure, link opened, link expired, payment captured)
   */
  static async handleStepOutcome(params: {
    transactionId: string;
    stepNumber: number;
    outcome: StepOutcome;
    customerFatigueScore: number;
    maxFatigueThreshold?: number;
  }): Promise<{ sequence: RecoverySequence; nextActionDispatched?: boolean }> {
    const { transactionId, stepNumber, outcome, customerFatigueScore, maxFatigueThreshold = 70 } = params;
    const sequence = await this.getSequence(transactionId);

    if (!sequence) {
      throw new Error(`Recovery sequence not found for transaction ${transactionId}`);
    }

    const currentStep = sequence.steps[sequence.currentStepIndex];
    const now = new Date().toISOString();

    // 1. Record outcome on the current step
    if (currentStep && currentStep.stepNumber === stepNumber) {
      currentStep.outcome = outcome;
      if (outcome.eventType === 'PAYMENT_CAPTURED') {
        currentStep.status = 'SUCCEEDED';
        currentStep.completedAt = now;
      } else if (outcome.eventType === 'ATTEMPT_FAILED' || outcome.eventType === 'LINK_EXPIRED') {
        currentStep.status = 'FAILED';
        currentStep.completedAt = now;
      }
    }

    // 2. Evaluate state transition
    const transition = SequenceTransitionEngine.evaluate({
      sequence,
      outcome,
      customerFatigueScore,
      maxFatigueThreshold,
    });

    // 3. Update Sequence State
    sequence.status = transition.newStatus;
    sequence.updatedAt = now;
    if (transition.stopCondition) {
      sequence.stopCondition = transition.stopCondition;
      sequence.stopReason = transition.stopReason;
      sequence.completedAt = now;
    }

    // 4. Record Transition History
    sequence.transitionHistory.push({
      timestamp: now,
      fromStep: stepNumber,
      toStep: transition.nextStepIndex !== undefined ? sequence.steps[transition.nextStepIndex]?.stepNumber : undefined,
      triggerEvent: outcome.eventType,
      explanation: transition.explanation,
      resultingStatus: transition.newStatus,
      stopCondition: transition.stopCondition,
    });

    let nextActionDispatched = false;

    // 5. If transitioning to a new active step, dispatch it
    if (
      transition.newStatus === 'ACTIVE' &&
      transition.nextStepIndex !== undefined &&
      transition.nextStepIndex !== sequence.currentStepIndex
    ) {
      sequence.currentStepIndex = transition.nextStepIndex;
      const nextStep = sequence.steps[sequence.currentStepIndex];

      if (nextStep && nextStep.actionType !== 'DO_NOT_RECOVER') {
        nextStep.status = 'DISPATCHED';
        nextStep.dispatchedAt = now;
        const delayMs = nextStep.delayMinutes * 60000;
        const scheduledFor = new Date(Date.now() + delayMs).toISOString();
        nextStep.scheduledAt = scheduledFor;
        nextActionDispatched = true;

        const idempotencyKey = IdempotencyGuard.generateKey({
          merchantId: sequence.merchantId,
          transactionId,
          sequenceId: sequence.id,
          stepNumber: nextStep.stepNumber,
        });

        await this.persistRecoveryAttempt({
          transactionId,
          sequenceId: sequence.id,
          stepNumber: nextStep.stepNumber,
          actionType: nextStep.actionType,
          channel: nextStep.channel,
          status: AttemptStatus.DISPATCHED,
          idempotencyKey,
          scheduledAt: scheduledFor,
        });

        try {
          await RecoveryJobQueue.scheduleJob({
            merchantId: sequence.merchantId,
            transactionId,
            sequenceId: sequence.id,
            stepNumber: nextStep.stepNumber,
            actionType: nextStep.actionType,
            channel: nextStep.channel,
            idempotencyKey,
            amount: outcome.amount || 1000,
            customerPhone: '+919876543210',
            scheduledFor,
            delayMs,
          });
        } catch {
          // resilient
        }
      }
    }

    // 6. If sequence completed (PAID), update Transaction to RECOVERED and cancel pending jobs
    if (transition.newStatus === 'COMPLETED' && transition.stopCondition === 'PAID') {
      // Cancel all remaining scheduled jobs for this sequence
      await RecoveryJobQueue.cancelSequenceJobs(sequence.id);

      try {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: PaymentStatus.RECOVERED,
            recoveredAt: new Date(),
            recoveredAmount: outcome.amount,
            executionStatus: 'SUCCEEDED',
          },
        });
      } catch {
        // in-memory fallback handled
      }

      // Emit RecoverIQ Domain Event (Phase 7.4)
      RecoverIQEventStore.emitEvent({
        merchantId: sequence.merchantId,
        type: RecoverIQEventType.RECOVERY_COMPLETED,
        aggregateType: 'recovery',
        aggregateId: sequence.id,
        payload: {
          sequenceId: sequence.id,
          transactionId,
          recoveredAmount: outcome.amount,
          finalStatus: 'COMPLETED',
        },
      }).catch(() => {});
    } else if (transition.newStatus === 'HALTED') {
      // Cancel pending jobs when halted
      await RecoveryJobQueue.cancelSequenceJobs(sequence.id);

      try {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: PaymentStatus.FAILED,
            executionStatus: 'HALTED',
          },
        });
      } catch {
        // in-memory fallback handled
      }

      // Emit RecoverIQ Domain Event (Phase 7.4)
      RecoverIQEventStore.emitEvent({
        merchantId: sequence.merchantId,
        type: RecoverIQEventType.RECOVERY_HALTED,
        aggregateType: 'recovery',
        aggregateId: sequence.id,
        payload: {
          sequenceId: sequence.id,
          transactionId,
          reason: transition.explanation,
        },
      }).catch(() => {});
    }

    IN_MEMORY_SEQUENCES.set(transactionId, sequence);

    return { sequence, nextActionDispatched };
  }

  /**
   * Resumes a paused sequence when a merchant operator approves the pending recovery step
   */
  static async handleOperatorApproval(params: {
    transactionId: string;
    approvedBy: string;
  }): Promise<RecoverySequence> {
    const { transactionId, approvedBy } = params;
    const sequence = await this.getSequence(transactionId);

    if (!sequence) {
      throw new Error(`Recovery sequence not found for transaction ${transactionId}`);
    }

    const currentStep = sequence.steps[sequence.currentStepIndex];
    const now = new Date().toISOString();

    // Emits operator approval outcome
    const outcome: StepOutcome = {
      eventType: 'OPERATOR_APPROVED',
      timestamp: now,
      metadata: { approvedBy },
    };

    // Transition state
    sequence.status = 'ACTIVE';
    sequence.updatedAt = now;
    if (currentStep) {
      currentStep.status = 'DISPATCHED';
      currentStep.dispatchedAt = now;

      await this.persistRecoveryAttempt({
        transactionId,
        stepNumber: currentStep.stepNumber,
        actionType: currentStep.actionType,
        channel: currentStep.channel,
        status: AttemptStatus.DISPATCHED,
      });
    }

    sequence.transitionHistory.push({
      timestamp: now,
      fromStep: currentStep?.stepNumber || 1,
      toStep: currentStep?.stepNumber || 1,
      triggerEvent: 'OPERATOR_APPROVED',
      explanation: `Merchant operator (${approvedBy}) approved Step ${currentStep?.stepNumber}. Dispatching ${currentStep?.actionType}.`,
      resultingStatus: 'ACTIVE',
    });

    try {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: PaymentStatus.RECOVERING,
          requiresApproval: false,
          approvedBy,
          approvedAt: new Date(),
          executionStatus: 'DISPATCHED',
        },
      });
    } catch {
      // in-memory fallback
    }

    IN_MEMORY_SEQUENCES.set(transactionId, sequence);
    return sequence;
  }

  /**
   * Halts a sequence when a merchant operator rejects the recovery recommendation
   */
  static async handleOperatorRejection(params: {
    transactionId: string;
    rejectedBy: string;
    reason?: string;
  }): Promise<RecoverySequence> {
    const { transactionId, rejectedBy, reason } = params;
    const sequence = await this.getSequence(transactionId);

    if (!sequence) {
      throw new Error(`Recovery sequence not found for transaction ${transactionId}`);
    }

    const currentStep = sequence.steps[sequence.currentStepIndex];
    const now = new Date().toISOString();

    sequence.status = 'HALTED';
    sequence.stopCondition = 'OPERATOR_REJECTED';
    sequence.stopReason = reason || `Rejected by ${rejectedBy}`;
    sequence.completedAt = now;
    sequence.updatedAt = now;

    if (currentStep) {
      currentStep.status = 'CANCELLED';
    }

    sequence.transitionHistory.push({
      timestamp: now,
      fromStep: currentStep?.stepNumber || 1,
      triggerEvent: 'OPERATOR_REJECTED',
      explanation: `Merchant operator (${rejectedBy}) rejected recovery: ${reason || 'Manual override'}. Sequence halted.`,
      resultingStatus: 'HALTED',
      stopCondition: 'OPERATOR_REJECTED',
    });

    try {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: PaymentStatus.FAILED,
          requiresApproval: false,
          approvalReason: `Declined by ${rejectedBy}: ${reason || 'Operator rejection'}`,
          executionStatus: 'HALTED',
        },
      });
    } catch {
      // in-memory fallback
    }

    IN_MEMORY_SEQUENCES.set(transactionId, sequence);
    return sequence;
  }

  /**
   * Retrieves an active or completed sequence by transaction ID
   */
  static async getSequence(transactionId: string): Promise<RecoverySequence | null> {
    return IN_MEMORY_SEQUENCES.get(transactionId) || null;
  }

  /**
   * Helper to persist a RecoveryAttempt to database if available
   */
  private static async persistRecoveryAttempt(data: {
    transactionId: string;
    sequenceId?: string;
    stepNumber: number;
    actionType: any;
    channel: string;
    status: AttemptStatus;
    idempotencyKey?: string;
    scheduledAt?: string | Date;
    cost?: number;
    outcome?: string;
    provider?: string;
  }) {
    try {
      await prisma.recoveryAttempt.create({
        data: {
          transactionId: data.transactionId,
          sequenceId: data.sequenceId,
          stepId: data.stepNumber,
          attemptNumber: data.stepNumber,
          actionType: data.actionType,
          channel: data.channel,
          status: data.status,
          provider: data.provider || 'RAZORPAY',
          idempotencyKey: data.idempotencyKey,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          dispatchedAt: new Date(),
          cost: data.cost ?? 0.0,
          outcome: data.outcome || 'DISPATCHED',
        },
      });
    } catch {
      // ignore when DB is offline
    }
  }
}

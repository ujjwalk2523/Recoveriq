import { prisma } from '../db/prisma';
import { AttemptStatus } from '@prisma/client';
import { RecoveryActionType } from '../engine/types';
import { ActionDispatcher } from '../adapters/action-dispatcher';
import { AdapterExecutionResponse } from '../adapters/adapter-types';
import { IdempotencyGuard } from './idempotency';
import { assertPaymentExecutionAllowed } from '../payments/razorpay/environment';
import { validateIntegerPaise } from '../security/input-security';
import { ApplicationError } from '../errors/application-error';
import { IN_MEMORY_TRANSACTIONS } from '../razorpay/webhooks';

export interface ExecuteActionParams {
  merchantId: string;
  transactionId: string;
  sequenceId: string;
  stepNumber: number;
  actionType: RecoveryActionType;
  amount: number;
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
  scheduledAt?: string;
  banditDecisionId?: string;
  banditAction?: string;
  banditModelVersion?: string;
}

export interface ExecutionResult extends AdapterExecutionResponse {
  idempotencyKey: string;
  isDuplicateIgnored?: boolean;
}

export class RecoveryExecutor {
  /**
   * Universal execution runner enforcing idempotency, dispatching via adapters, and recording in the Execution Ledger
   */
  static async executeAction(params: ExecuteActionParams): Promise<ExecutionResult> {
    const {
      merchantId,
      transactionId,
      sequenceId,
      stepNumber,
      actionType,
      amount,
      customerPhone,
      customerEmail,
      customerName,
      scheduledAt,
      banditDecisionId,
      banditAction,
      banditModelVersion,
    } = params;

    // 1. Generate compound Idempotency Key
    const idempotencyKey = IdempotencyGuard.generateKey({
      merchantId,
      transactionId,
      sequenceId,
      stepNumber,
    });

    // 2. Strict Idempotency Check: Prevent duplicate charges / messages
    const check = await IdempotencyGuard.check(idempotencyKey);
    if (check.exists) {
      console.log(`[RecoveryExecutor] Skipping duplicate execution for key: ${idempotencyKey}`);
      return {
        success: true,
        provider: check.cachedResult.provider || 'CACHED',
        providerReference: check.cachedResult.providerReference || 'cached_ref',
        channel: check.cachedResult.channel || 'CACHED',
        costINR: 0.0,
        status: check.cachedResult.status || 'DISPATCHED',
        message: 'Duplicate action safely skipped via Idempotency Guard.',
        idempotencyKey,
        isDuplicateIgnored: true,
      };
    }

    // 3. Money Security Validation: Amount must be an integer minor unit (paise)
    validateIntegerPaise(amount, 'amount');

    // 4. Authoritative Datastore Reconciliation (anti-tampering & tenant boundary)
    let authoritativeTxn: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        authoritativeTxn = await prisma.transaction.findFirst({
          where: { id: transactionId },
        });
      } catch {
        // ignore
      }
    }
    if (!authoritativeTxn) {
      authoritativeTxn = IN_MEMORY_TRANSACTIONS.get(transactionId);
    }

    if (authoritativeTxn) {
      if (authoritativeTxn.merchantId && authoritativeTxn.merchantId !== merchantId) {
        throw new ApplicationError({
          code: 'CROSS_TENANT_ACCESS_DENIED',
          message: `Transaction '${transactionId}' belongs to another merchant. Execution blocked.`,
          statusCode: 403,
          safeMessage: 'Cross-tenant execution denied.',
        });
      }
      if (authoritativeTxn.amount !== undefined && authoritativeTxn.amount !== amount) {
        throw new ApplicationError({
          code: 'AMOUNT_TAMPERING_DETECTED',
          message: `Execution amount (₹${amount}) does not match authoritative transaction amount (₹${authoritativeTxn.amount}).`,
          statusCode: 400,
          safeMessage: 'Payment amount cannot be modified.',
        });
      }
      if (authoritativeTxn.status === 'RECOVERED') {
        return {
          success: true,
          provider: 'RECOVERIQ_SUPPRESSION',
          providerReference: `suppress_recovered_${Date.now()}`,
          channel: 'DO_NOT_RECOVER',
          costINR: 0.0,
          status: 'DISPATCHED',
          message: 'Transaction already recovered. Recovery action safely skipped.',
          idempotencyKey,
          isDuplicateIgnored: true,
        };
      }
    }

    // 5. Live Mode & Kill Switch Safety Gate
    await assertPaymentExecutionAllowed({
      merchantId,
      transactionId,
      actionType,
    });

    const executedAt = new Date();

    // 4. Dispatch action through decoupled provider adapter
    const adapterResponse = await ActionDispatcher.dispatch({
      merchantId,
      transactionId,
      sequenceId,
      stepNumber,
      actionType,
      amount,
      customerPhone,
      customerEmail,
      customerName,
      idempotencyKey,
    });

    // 4. Record to RecoveryAttempt Execution Ledger (for ML dataset)
    try {
      await prisma.recoveryAttempt.create({
        data: {
          transactionId,
          sequenceId,
          stepId: stepNumber,
          attemptNumber: stepNumber,
          actionType,
          channel: adapterResponse.channel,
          status: adapterResponse.success ? AttemptStatus.DISPATCHED : AttemptStatus.FAILED,
          provider: adapterResponse.provider,
          providerReference: adapterResponse.providerReference,
          idempotencyKey,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          executedAt,
          cost: adapterResponse.costINR,
          outcome: adapterResponse.success ? 'DISPATCHED' : 'FAILED',
          errorMessage: adapterResponse.success ? null : adapterResponse.message,
          banditDecisionId,
          banditAction,
          banditModelVersion,
          metadata: {
            rawResponse: adapterResponse.rawResponse,
          },
        },
      });
    } catch (dbErr) {
      // ignore when DB is offline
    }

    // 5. Store Idempotency Record
    await IdempotencyGuard.record({
      key: idempotencyKey,
      transactionId,
      sequenceId,
      stepNumber,
      result: adapterResponse,
    });

    return {
      ...adapterResponse,
      idempotencyKey,
    };
  }

  /**
   * Specific convenience executor: executeImmediateRetry
   */
  static async executeImmediateRetry(params: Omit<ExecuteActionParams, 'actionType'>): Promise<ExecutionResult> {
    return this.executeAction({ ...params, actionType: 'IMMEDIATE_RETRY' });
  }

  /**
   * Specific convenience executor: executeDelayedRetry
   */
  static async executeDelayedRetry(params: Omit<ExecuteActionParams, 'actionType'>): Promise<ExecutionResult> {
    return this.executeAction({ ...params, actionType: 'OPTIMAL_DELAYED_RETRY' });
  }

  /**
   * Specific convenience executor: createPaymentLink
   */
  static async createPaymentLink(params: Omit<ExecuteActionParams, 'actionType'>): Promise<ExecutionResult> {
    return this.executeAction({ ...params, actionType: 'PAYMENT_LINK' });
  }

  /**
   * Specific convenience executor: sendWhatsAppNudge
   */
  static async sendWhatsAppNudge(params: Omit<ExecuteActionParams, 'actionType'>): Promise<ExecutionResult> {
    return this.executeAction({ ...params, actionType: 'WHATSAPP_NUDGE' });
  }

  /**
   * Specific convenience executor: requestHumanApproval
   */
  static async requestHumanApproval(params: Omit<ExecuteActionParams, 'actionType'>): Promise<ExecutionResult> {
    return this.executeAction({ ...params, actionType: 'HUMAN_ESCALATION' });
  }
}

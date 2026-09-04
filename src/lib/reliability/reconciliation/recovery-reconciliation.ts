/**
 * Phase 8.8 — Recovery Sequence & Attempt Reconciliation
 *
 * Reconciles recovery sequences, steps, and idempotency records to ensure
 * consistency between transaction status, recovery attempts, and worker queues.
 */

import { prisma } from '../../db/prisma';
import { IN_MEMORY_TRANSACTIONS } from '../../razorpay/webhooks';

export class RecoveryReconciliationService {
  /**
   * Validates whether a recovery attempt is in a safe, reconciled state.
   */
  static async reconcileRecoveryAttempt(params: {
    transactionId: string;
    sequenceId: string;
    stepNumber: number;
    idempotencyKey: string;
  }): Promise<{
    safeToProceed: boolean;
    reason: string;
    currentState: string;
  }> {
    const { transactionId, idempotencyKey } = params;

    // 1. Fetch authoritative transaction state
    let txn: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        txn = await prisma.transaction.findFirst({
          where: { id: transactionId },
        });
      } catch {
        // Fall back to memory
      }
    }
    if (!txn) {
      txn = IN_MEMORY_TRANSACTIONS.get(transactionId);
    }

    if (txn && (txn.status === 'RECOVERED' || txn.status === 'SUCCESS')) {
      return {
        safeToProceed: false,
        reason: 'Transaction is already in terminal RECOVERED state. Action suppressed.',
        currentState: txn.status,
      };
    }

    // 2. Check existing recovery attempts for this idempotency key
    if (process.env.SKIP_DB !== 'true') {
      try {
        const existingAttempt = await prisma.recoveryAttempt.findUnique({
          where: { idempotencyKey },
        });

        if (existingAttempt && existingAttempt.status === 'DISPATCHED') {
          return {
            safeToProceed: false,
            reason: 'RecoveryAttempt with matching idempotencyKey was already dispatched.',
            currentState: existingAttempt.status,
          };
        }
      } catch {
        // Fall back
      }
    }

    return {
      safeToProceed: true,
      reason: 'Authoritative transaction requires recovery; no duplicate execution found.',
      currentState: txn?.status || 'FAILED',
    };
  }
}

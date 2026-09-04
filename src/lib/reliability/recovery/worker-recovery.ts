/**
 * Phase 8.8 — Disposable Worker Recovery & Stale Lease Handler
 *
 * Implements crash recovery for distributed background workers.
 *
 * CRITICAL INVARIANT:
 * An expired lease NEVER implies that payment was not executed.
 * Before re-executing an expired job, provider state MUST be reconciled.
 */

import { getRedisClient, IRedisClient } from '../../redis/client';
import { RedisKeys } from '../../redis/keys';
import { RecoveryJob } from '../../workers/job-types';
import { StaleJobRecoveryService } from '../../workers/stale-job-recovery';
import { PaymentReconciliationService } from '../reconciliation/payment-reconciliation';
import { IdempotencyGuard } from '../../execution/idempotency';

export class WorkerRecoveryService {
  /**
   * Recovers a worker job that crashed mid-flight or whose lease expired.
   */
  static async recoverWorkerJob(
    jobId: string,
    client: IRedisClient = getRedisClient()
  ): Promise<{
    recovered: boolean;
    duplicatePaymentPrevented: boolean;
    reconciliationOutcome?: string;
    reason: string;
  }> {
    const rawJob = await client.get(RedisKeys.job(jobId));
    if (!rawJob) {
      return {
        recovered: false,
        duplicatePaymentPrevented: false,
        reason: 'Job payload not found in Redis store.',
      };
    }

    const job: RecoveryJob = JSON.parse(rawJob);

    // 1. Reconcile with provider FIRST to verify if payment was already captured
    const recon = await PaymentReconciliationService.reconcileTransaction({
      transactionId: job.transactionId,
      merchantId: job.merchantId,
      providerReference: job.idempotencyKey,
    });

    if (recon.outcome === 'CONFIRMED_SUCCESS') {
      // Payment was already captured externally prior to worker crash!
      job.status = 'COMPLETED';
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.del(RedisKeys.lease(jobId));

      return {
        recovered: true,
        duplicatePaymentPrevented: true,
        reconciliationOutcome: recon.outcome,
        reason: 'Payment confirmed captured at provider. Marked completed without re-executing (0 duplicate payments).',
      };
    }

    if (recon.requiresManualReview || recon.outcome === 'UNKNOWN') {
      job.status = 'FAILED';
      job.lastError = 'Uncertain provider state. Held for manual review to prevent duplicate payment.';
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.del(RedisKeys.lease(jobId));

      return {
        recovered: false,
        duplicatePaymentPrevented: true,
        reconciliationOutcome: recon.outcome,
        reason: 'Ambiguous payment state. Held for manual review (0 duplicate payments).',
      };
    }

    // 2. Provider confirmed NOT_FOUND or FAILURE: safe to re-queue
    const res = await StaleJobRecoveryService.recoverStaleJob(jobId, client);
    return {
      recovered: res.recovered,
      duplicatePaymentPrevented: false,
      reconciliationOutcome: recon.outcome,
      reason: res.reason,
    };
  }

  /**
   * Simulates an all-workers crash event and recovers all abandoned leases.
   */
  static async recoverAllStaleWorkerLeases(
    activeJobIds: string[],
    client: IRedisClient = getRedisClient()
  ): Promise<{
    processedCount: number;
    recoveredCount: number;
    duplicatePaymentsPrevented: number;
  }> {
    let recoveredCount = 0;
    let duplicatePaymentsPrevented = 0;

    for (const jobId of activeJobIds) {
      const res = await this.recoverWorkerJob(jobId, client);
      if (res.recovered) recoveredCount++;
      if (res.duplicatePaymentPrevented) duplicatePaymentsPrevented++;
    }

    return {
      processedCount: activeJobIds.length,
      recoveredCount,
      duplicatePaymentsPrevented,
    };
  }
}

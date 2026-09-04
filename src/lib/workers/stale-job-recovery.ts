import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { RecoveryJob } from './job-types';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { JobStateMachine } from './job-state';

export class StaleJobRecoveryService {
  /**
   * Recovers a specific stale job if its lease is expired and PostgreSQL indicates no duplicate execution.
   */
  static async recoverStaleJob(
    jobId: string,
    client: IRedisClient = getRedisClient()
  ): Promise<{ recovered: boolean; reason: string }> {
    const jobKey = RedisKeys.job(jobId);
    const leaseKey = RedisKeys.lease(jobId);

    const rawJob = await client.get(jobKey);
    if (!rawJob) {
      return { recovered: false, reason: 'Job payload not found in Redis' };
    }

    const job: RecoveryJob = JSON.parse(rawJob);

    // Only PROCESSING jobs can be stale
    if (job.status !== 'PROCESSING') {
      return { recovered: false, reason: `Job is in status '${job.status}', not PROCESSING` };
    }

    // Check if lease is still active
    const rawLease = await client.get(leaseKey);
    if (rawLease) {
      const lease = JSON.parse(rawLease);
      if (Date.now() < lease.expiresAt) {
        return { recovered: false, reason: 'Worker lease is still active' };
      }
    }

    logger.warn(`[StaleJobRecovery] Stale lease detected for job ${job.jobId} (Sequence: ${job.sequenceId}). Inspecting PostgreSQL business truth...`);

    // Invariant: PostgreSQL is the ultimate business truth
    // Check 1: Has transaction already been recovered?
    if (process.env.SKIP_DB !== 'true') {
      try {
        const txn = await prisma.transaction.findUnique({
          where: { id: job.transactionId },
          select: { status: true },
        });

        if (txn && txn.status === 'RECOVERED') {
          logger.info(`[StaleJobRecovery] Transaction ${job.transactionId} already RECOVERED in DB. Marking job COMPLETED without re-executing.`);
          job.status = 'COMPLETED';
          await client.set(jobKey, JSON.stringify(job));
          return { recovered: false, reason: 'Transaction already recovered' };
        }

        // Check 2: Was a dispatched RecoveryAttempt already recorded?
        const attempt = await prisma.recoveryAttempt.findFirst({
          where: {
            transactionId: job.transactionId,
            sequenceId: job.sequenceId,
            stepId: job.stepNumber,
            status: 'DISPATCHED',
          },
        });

        if (attempt) {
          logger.info(`[StaleJobRecovery] Successful RecoveryAttempt already recorded in DB for step #${job.stepNumber}. Marking job COMPLETED.`);
          job.status = 'COMPLETED';
          await client.set(jobKey, JSON.stringify(job));
          return { recovered: false, reason: 'Execution already succeeded' };
        }
      } catch (err: any) {
        logger.error(`[StaleJobRecovery] DB check failed during stale recovery for job ${job.jobId}: ${err.message}`);
        // If DB is unreachable, do not re-execute unsafely; wait for next cycle
        return { recovered: false, reason: 'Database temporarily unavailable' };
      }
    }

    // Safely requeue job into READY queue
    job.status = 'READY';
    job.lastError = 'Previous worker lease expired; automatically recovered and requeued.';
    await client.set(jobKey, JSON.stringify(job));
    await client.rpush(RedisKeys.readyQueue(), job.jobId);

    logger.info(`[StaleJobRecovery] Successfully requeued stale job ${job.jobId} into ready queue.`);
    return { recovered: true, reason: 'Stale job safely requeued' };
  }
}

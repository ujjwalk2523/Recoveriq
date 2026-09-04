import crypto from 'crypto';
import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { RecoveryJobQueue } from '../queue/recovery-queue';
import { RecoveryJob } from './job-types';
import { WorkerLease, WorkerLeaseService } from './worker-lease';
import { RecoveryExecutor } from '../execution/recovery-executor';
import { RecoveryOrchestrator } from '../engine/sequence-orchestrator';
import { EntitlementService } from '../billing/entitlement-service';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { getRuntimeConfig } from '../config/runtime';

export interface WorkerStats {
  workerId: string;
  status: 'STARTING' | 'RUNNING' | 'DRAINING' | 'STOPPED';
  startedAt: string;
  lastHeartbeat: string;
  activeJobs: number;
  processedCount: number;
  failedCount: number;
}

export class DistributedRecoveryWorker {
  readonly workerId: string;
  private isRunning = false;
  private isDraining = false;
  private activeJobsCount = 0;
  private processedCount = 0;
  private failedCount = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private pollTimer?: NodeJS.Timeout;
  private client: IRedisClient;

  constructor(client: IRedisClient = getRedisClient()) {
    const runtime = getRuntimeConfig();
    this.workerId = `worker_${runtime.application.environment}_${crypto.randomBytes(4).toString('hex')}`;
    this.client = client;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isDraining = false;

    logger.info(`[DistributedRecoveryWorker] Worker ${this.workerId} started.`);

    // 1. Register worker identity in Redis
    await this.updateHeartbeat('RUNNING');

    // 2. Start worker heartbeat loop (every 10s)
    const runtime = getRuntimeConfig();
    this.heartbeatTimer = setInterval(
      () => this.updateHeartbeat('RUNNING'),
      runtime.workers.heartbeatIntervalMs
    );

    // 3. Start processing loop
    this.runPollLoop();
  }

  private async updateHeartbeat(status: 'STARTING' | 'RUNNING' | 'DRAINING' | 'STOPPED'): Promise<void> {
    try {
      const stats: WorkerStats = {
        workerId: this.workerId,
        status,
        startedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        activeJobs: this.activeJobsCount,
        processedCount: this.processedCount,
        failedCount: this.failedCount,
      };

      await this.client.set(RedisKeys.worker(this.workerId), JSON.stringify(stats), { ex: 35 });
      await this.client.sadd(RedisKeys.workerRegistry(), this.workerId);
    } catch (err: any) {
      logger.warn(`[DistributedRecoveryWorker] Failed to update heartbeat for ${this.workerId}: ${err.message}`);
    }
  }

  private async runPollLoop(): Promise<void> {
    if (!this.isRunning || this.isDraining) return;

    const runtime = getRuntimeConfig();
    const maxConcurrency = runtime.workers.concurrency || 5;

    try {
      // 1. Promote any matured delayed jobs
      await RecoveryJobQueue.promoteDelayedJobs(Date.now(), this.client);

      // 2. Claim ready jobs up to concurrency capacity
      while (this.activeJobsCount < maxConcurrency && this.isRunning && !this.isDraining) {
        const claim = await RecoveryJobQueue.claimNextJob(
          this.workerId,
          runtime.workers.leaseTtlMs,
          this.client
        );
        if (!claim) break; // No more ready jobs in queue

        this.activeJobsCount++;
        // Process job asynchronously with bounded concurrency
        this.processClaimedJob(claim.job, claim.lease).finally(() => {
          this.activeJobsCount--;
        });
      }
    } catch (err: any) {
      logger.error(`[DistributedRecoveryWorker] Error in poll loop for ${this.workerId}: ${err.message}`);
    }

    if (this.isRunning && !this.isDraining) {
      this.pollTimer = setTimeout(() => this.runPollLoop(), runtime.workers.pollIntervalMs);
    }
  }

  /**
   * Orchestrates the execution of a claimed job adhering to all safety invariants.
   */
  async processClaimedJob(job: RecoveryJob, lease: WorkerLease): Promise<{ success: boolean; error?: string }> {
    const runtime = getRuntimeConfig();
    logger.info(`[DistributedRecoveryWorker] Claimed job ${job.jobId} for sequence ${job.sequenceId} (Action: ${job.actionType})`, {
      workerId: this.workerId,
      merchantId: job.merchantId,
      transactionId: job.transactionId,
      leaseId: lease.leaseId,
    });

    // 1. Start lease heartbeat
    const leaseRenewInterval = Math.max(5000, Math.floor(runtime.workers.leaseTtlMs / 3));
    const leaseTimer = setInterval(async () => {
      await WorkerLeaseService.renewLease(job.jobId, lease.leaseId, runtime.workers.leaseTtlMs, this.client);
    }, leaseRenewInterval);

    try {
      // Invariant 1: Multi-Tenant and Entitlement Safeguard
      // Check if merchant has entitlement to execute recovery actions
      if (process.env.SKIP_DB !== 'true') {
        const hasEntitlement = await EntitlementService.canExecuteRecovery(job.merchantId);
        if (!hasEntitlement) {
          logger.warn(`[DistributedRecoveryWorker] Merchant ${job.merchantId} lacks recovery entitlement (e.g. suspended). Cancelling job ${job.jobId}.`);
          await RecoveryJobQueue.cancelJob(job.jobId, this.client);
          return { success: false, error: 'Merchant subscription suspended or lacks recovery entitlement.' };
        }
      }

      // Invariant 2: PostgreSQL Business Truth Authority
      // Never execute recovery on an already recovered transaction or cancelled sequence!
      if (process.env.SKIP_DB !== 'true') {
        try {
          const txn = await prisma.transaction.findUnique({
            where: { id: job.transactionId },
            select: { status: true, merchantId: true },
          });

          if (!txn) {
            logger.error(`[DistributedRecoveryWorker] Transaction ${job.transactionId} not found in DB. Dropping job.`);
            await RecoveryJobQueue.acknowledge(job.jobId, lease.leaseId, this.client);
            return { success: false, error: 'Transaction not found in DB' };
          }

          if (txn.merchantId !== job.merchantId) {
            logger.error(`[DistributedRecoveryWorker] Tenant boundary violation! Job merchant ${job.merchantId} != Txn merchant ${txn.merchantId}. Aborting.`);
            await RecoveryJobQueue.cancelJob(job.jobId, this.client);
            return { success: false, error: 'Tenant boundary violation' };
          }

          if (txn.status === 'RECOVERED') {
            logger.info(`[DistributedRecoveryWorker] Transaction ${job.transactionId} already RECOVERED in DB. Skipping duplicate action and acknowledging job.`);
            await RecoveryJobQueue.acknowledge(job.jobId, lease.leaseId, this.client);
            return { success: true };
          }
        } catch (dbErr: any) {
          logger.error(`[DistributedRecoveryWorker] DB check failed for job ${job.jobId}: ${dbErr.message}`);
          // Re-raise to trigger infrastructure retry without executing payment
          throw dbErr;
        }
      }

      // 3. Call existing RecoveryExecutor (with IdempotencyGuard & Execution Ledger)
      const execution = await RecoveryExecutor.executeAction({
        merchantId: job.merchantId,
        transactionId: job.transactionId,
        sequenceId: job.sequenceId,
        stepNumber: job.stepNumber,
        actionType: job.actionType,
        amount: job.amount,
        customerPhone: job.customerPhone,
        customerEmail: job.customerEmail,
        customerName: job.customerName,
        scheduledAt: job.scheduledAt,
      });

      // 4. Handle Execution Result
      if (!execution.success) {
        this.failedCount++;
        // Calculate exponential backoff: 2s, 4s, 8s...
        const backoffMs = Math.min(60000, 2000 * Math.pow(2, job.attemptNumber));
        await RecoveryJobQueue.retry(job.jobId, lease.leaseId, backoffMs, execution.message, this.client);

        if (process.env.SKIP_DB !== 'true') {
          await RecoveryOrchestrator.handleStepOutcome({
            transactionId: job.transactionId,
            stepNumber: job.stepNumber,
            outcome: {
              eventType: 'ATTEMPT_FAILED',
              errorMessage: execution.message,
              timestamp: new Date().toISOString(),
            },
            customerFatigueScore: 20,
          });
        }

        return { success: false, error: execution.message };
      }

      // 5. Successfully executed -> Acknowledge job
      this.processedCount++;
      await RecoveryJobQueue.acknowledge(job.jobId, lease.leaseId, this.client);
      return { success: true };
    } catch (err: any) {
      this.failedCount++;
      logger.error(`[DistributedRecoveryWorker] Unhandled failure processing job ${job.jobId}: ${err.message}`);
      const backoffMs = 2000 * Math.pow(2, job.attemptNumber);
      await RecoveryJobQueue.retry(job.jobId, lease.leaseId, backoffMs, err.message, this.client);
      return { success: false, error: err.message };
    } finally {
      clearInterval(leaseTimer);
    }
  }

  /**
   * Graceful shutdown of worker: stops polling, drains active jobs within deadline.
   */
  async stop(timeoutMs = 8000): Promise<void> {
    if (!this.isRunning) return;
    this.isDraining = true;
    logger.info(`[DistributedRecoveryWorker] Draining worker ${this.workerId}... Waiting for ${this.activeJobsCount} active jobs to complete.`);

    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    await this.updateHeartbeat('DRAINING');

    const start = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.isRunning = false;
    await this.updateHeartbeat('STOPPED');
    await this.client.srem(RedisKeys.workerRegistry(), this.workerId);
    logger.info(`[DistributedRecoveryWorker] Worker ${this.workerId} stopped cleanly.`);
  }
}

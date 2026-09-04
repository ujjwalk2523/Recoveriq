import { RecoveryActionType } from '../engine/types';
import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { RecoveryJob, JobStatus } from '../workers/job-types';
import { WorkerLeaseService, WorkerLease } from '../workers/worker-lease';
import { logger } from '../observability/logger';

export interface RecoveryJobPayload {
  jobId: string;
  merchantId: string;
  transactionId: string;
  sequenceId: string;
  stepNumber: number;
  actionType: RecoveryActionType;
  channel?: string;
  idempotencyKey: string;
  amount: number;
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
  scheduledFor?: string; // ISO string
  delayMs: number;
  attemptsMade: number;
  maxAttempts: number;
  status: 'DELAYED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  lastError?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export type JobProcessorFn = (job: RecoveryJobPayload) => Promise<{ success: boolean; error?: string }>;

export class RecoveryJobQueue {
  private static processor: JobProcessorFn | null = null;
  private static localJobCache = new Map<string, RecoveryJobPayload>();
  private static localDlq: RecoveryJobPayload[] = [];
  private static timers = new Map<string, NodeJS.Timeout>();

  static registerWorker(fn: JobProcessorFn) {
    this.processor = fn;
  }

  static getProcessor(): JobProcessorFn | null {
    return this.processor;
  }

  static clearQueue() {
    this.localJobCache.clear();
    this.localDlq = [];
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  static getActiveJobs(): RecoveryJobPayload[] {
    return Array.from(this.localJobCache.values()).filter(
      (j) => j.status === 'ACTIVE' || j.status === 'DELAYED'
    );
  }

  static getDeadLetterJobs(): RecoveryJobPayload[] {
    return this.localDlq;
  }

  /**
   * Schedules a delayed or immediate recovery job into durable Redis queues.
   */
  static async scheduleJob(
    payload: Omit<
      RecoveryJobPayload,
      'jobId' | 'attemptsMade' | 'maxAttempts' | 'status' | 'createdAt'
    > & {
      maxAttempts?: number;
      scheduledFor?: string;
    },
    client: IRedisClient = getRedisClient()
  ): Promise<RecoveryJobPayload> {
    const jobId = `job_${payload.sequenceId}_step${payload.stepNumber}_${Date.now()}`;
    const now = new Date().toISOString();
    const scheduledTimestamp = payload.delayMs > 0 ? Date.now() + payload.delayMs : Date.now();
    const scheduledFor = payload.scheduledFor || new Date(scheduledTimestamp).toISOString();

    const job: RecoveryJob = {
      jobId,
      merchantId: payload.merchantId,
      transactionId: payload.transactionId,
      sequenceId: payload.sequenceId,
      stepNumber: payload.stepNumber,
      actionType: payload.actionType,
      channel: payload.channel,
      amount: payload.amount,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      customerName: payload.customerName,
      scheduledAt: scheduledFor,
      delayMs: payload.delayMs,
      attemptNumber: 0,
      maxAttempts: payload.maxAttempts ?? 3,
      idempotencyKey: payload.idempotencyKey,
      status: payload.delayMs > 0 ? 'PENDING' : 'READY',
      createdAt: now,
    };

    // 1. Store Job Payload in Redis
    try {
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.sadd(RedisKeys.sequenceJobs(payload.sequenceId), jobId);

      if (payload.delayMs > 0) {
        await client.zadd(RedisKeys.delayedQueue(), scheduledTimestamp, jobId);
        logger.info(
          `[RecoveryJobQueue] Enqueued DELAYED job ${jobId} (Action: ${job.actionType}, delay: ${payload.delayMs}ms, runAt: ${scheduledFor})`
        );
      } else {
        await client.rpush(RedisKeys.readyQueue(), jobId);
        logger.info(
          `[RecoveryJobQueue] Enqueued READY job ${jobId} (Action: ${job.actionType}) for immediate claiming.`
        );
      }
    } catch {
      // safe fallback if redis is disconnected
    }

    const jobPayload: RecoveryJobPayload = {
      ...payload,
      jobId,
      attemptsMade: 0,
      maxAttempts: payload.maxAttempts ?? 3,
      status: payload.delayMs > 0 ? 'DELAYED' : 'ACTIVE',
      scheduledFor,
      createdAt: now,
    };

    this.localJobCache.set(jobId, jobPayload);

    // If local processor is registered (Phase 5 compatibility), execute asynchronous callback
    if (this.processor && payload.delayMs <= 0) {
      setTimeout(() => this.processLocalJob(jobId), 10);
    } else if (this.processor && payload.delayMs > 0) {
      const timer = setTimeout(() => this.processLocalJob(jobId), payload.delayMs);
      this.timers.set(jobId, timer);
    }

    return jobPayload;
  }

  private static async processLocalJob(jobId: string) {
    const job = this.localJobCache.get(jobId);
    if (!job || job.status === 'CANCELLED' || !this.processor) return;

    job.status = 'ACTIVE';
    job.attemptsMade++;

    try {
      const outcome = await this.processor(job);
      if (outcome.success) {
        job.status = 'COMPLETED';
      } else {
        job.lastError = outcome.error;
        if (job.attemptsMade < job.maxAttempts) {
          const timer = setTimeout(() => this.processLocalJob(jobId), 1000);
          this.timers.set(jobId, timer);
        } else {
          job.status = 'FAILED';
          this.localDlq.push(job);
        }
      }
    } catch (err: any) {
      job.lastError = err.message;
      if (job.attemptsMade >= job.maxAttempts) {
        job.status = 'FAILED';
        this.localDlq.push(job);
      }
    }
  }

  /**
   * Promotes matured delayed jobs into the READY queue.
   */
  static async promoteDelayedJobs(
    nowMs: number = Date.now(),
    client: IRedisClient = getRedisClient()
  ): Promise<string[]> {
    const readyJobIds = await client.zrangebyscore(RedisKeys.delayedQueue(), '-inf', nowMs);
    const promoted: string[] = [];

    for (const jobId of readyJobIds) {
      const removed = await client.zrem(RedisKeys.delayedQueue(), jobId);
      if (removed > 0) {
        const rawJob = await client.get(RedisKeys.job(jobId));
        if (rawJob) {
          const job: RecoveryJob = JSON.parse(rawJob);
          if (job.status === 'PENDING' || job.status === 'RETRYING') {
            job.status = 'READY';
            await client.set(RedisKeys.job(jobId), JSON.stringify(job));
            await client.rpush(RedisKeys.readyQueue(), jobId);
            promoted.push(jobId);
          }
        }
      }
    }

    return promoted;
  }

  /**
   * Atomically claims the next available job from the READY queue and acquires a worker lease.
   */
  static async claimNextJob(
    workerId: string,
    leaseTtlMs = 30000,
    client: IRedisClient = getRedisClient()
  ): Promise<{ job: RecoveryJob; lease: WorkerLease } | null> {
    const jobId = await client.lpop(RedisKeys.readyQueue());
    if (!jobId) return null;

    const rawJob = await client.get(RedisKeys.job(jobId));
    if (!rawJob) return null;

    const job: RecoveryJob = JSON.parse(rawJob);

    // If job was cancelled while in queue, drop it
    if (job.status === 'CANCELLED') {
      return null;
    }

    // Acquire lease
    const lease = await WorkerLeaseService.acquireLease(jobId, workerId, leaseTtlMs, client);
    if (!lease) {
      // Lease acquisition collision; re-push to front or let next worker claim
      await client.rpush(RedisKeys.readyQueue(), jobId);
      return null;
    }

    job.status = 'PROCESSING';
    job.attemptNumber += 1;
    await client.set(RedisKeys.job(jobId), JSON.stringify(job));

    return { job, lease };
  }

  /**
   * Acknowledges successful execution of a job.
   */
  static async acknowledge(
    jobId: string,
    leaseId: string,
    client: IRedisClient = getRedisClient()
  ): Promise<boolean> {
    const isValid = await WorkerLeaseService.validateLease(jobId, leaseId, client);
    if (!isValid) {
      logger.warn(`[RecoveryJobQueue] Worker attempted to ACK job ${jobId} with expired or invalid lease ${leaseId}`);
      return false;
    }

    const rawJob = await client.get(RedisKeys.job(jobId));
    if (rawJob) {
      const job: RecoveryJob = JSON.parse(rawJob);
      job.status = 'COMPLETED';
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
    }

    const local = this.localJobCache.get(jobId);
    if (local) local.status = 'COMPLETED';

    await WorkerLeaseService.releaseLease(jobId, leaseId, client);
    logger.info(`[RecoveryJobQueue] Successfully acknowledged job ${jobId}.`);
    return true;
  }

  /**
   * Handles job failure, scheduling exponential retry or routing to Dead-Letter Queue.
   */
  static async retry(
    jobId: string,
    leaseId: string,
    backoffMs: number,
    error: string,
    client: IRedisClient = getRedisClient()
  ): Promise<'RETRIED' | 'DEAD_LETTER' | 'INVALID_LEASE'> {
    const isValid = await WorkerLeaseService.validateLease(jobId, leaseId, client);
    if (!isValid) {
      return 'INVALID_LEASE';
    }

    const rawJob = await client.get(RedisKeys.job(jobId));
    if (!rawJob) {
      await WorkerLeaseService.releaseLease(jobId, leaseId, client);
      return 'DEAD_LETTER';
    }

    const job: RecoveryJob = JSON.parse(rawJob);
    job.lastError = error;

    if (job.attemptNumber < job.maxAttempts) {
      job.status = 'RETRYING';
      const retryTime = Date.now() + backoffMs;
      job.scheduledAt = new Date(retryTime).toISOString();

      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.zadd(RedisKeys.delayedQueue(), retryTime, jobId);
      await WorkerLeaseService.releaseLease(jobId, leaseId, client);

      logger.warn(
        `[RecoveryJobQueue] Retrying job ${jobId} in ${backoffMs}ms (Attempt #${job.attemptNumber}/${job.maxAttempts}): ${error}`
      );
      return 'RETRIED';
    } else {
      job.status = 'DEAD_LETTER';
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.rpush(RedisKeys.deadLetterQueue(), jobId);
      await WorkerLeaseService.releaseLease(jobId, leaseId, client);

      const local = this.localJobCache.get(jobId);
      if (local) {
        local.status = 'FAILED';
        this.localDlq.push(local);
      }

      logger.error(
        `[RecoveryJobQueue:DLQ] Job ${jobId} exceeded max attempts (${job.maxAttempts}). Transferred to Dead-Letter Queue.`
      );
      return 'DEAD_LETTER';
    }
  }

  /**
   * Explicitly cancels a pending or delayed job.
   */
  static async cancelJob(jobId: string, client: IRedisClient = getRedisClient()): Promise<boolean> {
    const rawJob = await client.get(RedisKeys.job(jobId));
    if (rawJob) {
      const job: RecoveryJob = JSON.parse(rawJob);
      job.status = 'CANCELLED';
      await client.set(RedisKeys.job(jobId), JSON.stringify(job));
      await client.zrem(RedisKeys.delayedQueue(), jobId);
    }

    const local = this.localJobCache.get(jobId);
    if (local) {
      local.status = 'CANCELLED';
    }

    if (this.timers.has(jobId)) {
      clearTimeout(this.timers.get(jobId));
      this.timers.delete(jobId);
    }

    logger.info(`[RecoveryJobQueue] Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Cancels all pending/delayed jobs for a sequence (e.g. when payment captured).
   */
  static async cancelSequenceJobs(sequenceId: string, client: IRedisClient = getRedisClient()): Promise<number> {
    let cancelledCount = 0;

    // 1. Cancel in local cache
    for (const [jobId, job] of this.localJobCache.entries()) {
      if (job.sequenceId === sequenceId && (job.status === 'DELAYED' || job.status === 'ACTIVE')) {
        job.status = 'CANCELLED';
        cancelledCount++;
        if (this.timers.has(jobId)) {
          clearTimeout(this.timers.get(jobId));
          this.timers.delete(jobId);
        }
      }
    }

    // 2. Cancel in Redis
    try {
      const jobIds = await client.smembers(RedisKeys.sequenceJobs(sequenceId));
      for (const jid of jobIds) {
        const cancelled = await this.cancelJob(jid, client);
        if (cancelled) cancelledCount++;
      }
    } catch {
      // safe fallback
    }

    logger.info(`[RecoveryJobQueue] Cancelled ${cancelledCount} pending jobs for sequence ${sequenceId}.`);
    return cancelledCount;
  }

  /**
   * Retrieves operational queue depths.
   */
  static async getQueueDepth(client: IRedisClient = getRedisClient()): Promise<{
    ready: number;
    delayed: number;
    deadLetter: number;
  }> {
    const ready = await client.llen(RedisKeys.readyQueue());
    const delayed = await client.zcard(RedisKeys.delayedQueue());
    const deadLetter = await client.llen(RedisKeys.deadLetterQueue());

    return { ready, delayed, deadLetter };
  }

  /**
   * Retrieves a job by ID from Redis.
   */
  static async getJob(jobId: string, client: IRedisClient = getRedisClient()): Promise<RecoveryJob | null> {
    const raw = await client.get(RedisKeys.job(jobId));
    return raw ? JSON.parse(raw) : null;
  }
}

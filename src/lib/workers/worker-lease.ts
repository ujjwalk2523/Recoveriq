import crypto from 'crypto';
import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { logger } from '../observability/logger';

export interface WorkerLease {
  leaseId: string;
  jobId: string;
  workerId: string;
  acquiredAt: number;
  expiresAt: number;
}

export class WorkerLeaseService {
  /**
   * Acquires an active worker lease for a job.
   */
  static async acquireLease(
    jobId: string,
    workerId: string,
    ttlMs = 30000,
    client: IRedisClient = getRedisClient()
  ): Promise<WorkerLease | null> {
    const leaseKey = RedisKeys.lease(jobId);
    const leaseId = `lease_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const leaseData: WorkerLease = {
      leaseId,
      jobId,
      workerId,
      acquiredAt: now,
      expiresAt,
    };

    try {
      // Store serialized lease with TTL
      const res = await client.set(leaseKey, JSON.stringify(leaseData), { px: ttlMs, nx: true });
      if (res === 'OK') {
        return leaseData;
      }
      return null;
    } catch (err: any) {
      logger.warn(`[WorkerLease] Failed to acquire lease for job ${jobId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Extends the TTL of a lease if the worker still owns it.
   */
  static async renewLease(
    jobId: string,
    leaseId: string,
    ttlMs = 30000,
    client: IRedisClient = getRedisClient()
  ): Promise<boolean> {
    const leaseKey = RedisKeys.lease(jobId);
    try {
      const raw = await client.get(leaseKey);
      if (!raw) return false;

      const lease: WorkerLease = JSON.parse(raw);
      if (lease.leaseId !== leaseId) return false;

      lease.expiresAt = Date.now() + ttlMs;
      await client.set(leaseKey, JSON.stringify(lease), { px: ttlMs });
      return true;
    } catch (err: any) {
      logger.warn(`[WorkerLease] Failed to renew lease for job ${jobId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Releases a lease on job completion or failure, validating ownership.
   */
  static async releaseLease(
    jobId: string,
    leaseId: string,
    client: IRedisClient = getRedisClient()
  ): Promise<boolean> {
    const leaseKey = RedisKeys.lease(jobId);
    try {
      const raw = await client.get(leaseKey);
      if (!raw) return true; // Already gone or expired

      const lease: WorkerLease = JSON.parse(raw);
      if (lease.leaseId === leaseId) {
        await client.del(leaseKey);
        return true;
      }
      return false; // Owned by another worker lease
    } catch (err: any) {
      logger.error(`[WorkerLease] Failed to release lease for job ${jobId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Verifies if a given leaseId is still active and valid.
   */
  static async validateLease(
    jobId: string,
    leaseId: string,
    client: IRedisClient = getRedisClient()
  ): Promise<boolean> {
    const leaseKey = RedisKeys.lease(jobId);
    try {
      const raw = await client.get(leaseKey);
      if (!raw) return false;

      const lease: WorkerLease = JSON.parse(raw);
      return lease.leaseId === leaseId && Date.now() < lease.expiresAt;
    } catch {
      return false;
    }
  }
}

import crypto from 'crypto';
import { getRedisClient, IRedisClient } from './client';
import { RedisKeys } from './keys';
import { logger } from '../observability/logger';

export interface DistributedLock {
  lockName: string;
  token: string;
  ttlMs: number;
  acquiredAt: number;
  expiresAt: number;
}

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class DistributedLockService {
  /**
   * Attempts to acquire an atomic distributed lock.
   * Returns a Lock object if successful, or null if lock is currently held.
   */
  static async acquireLock(
    lockName: string,
    ttlMs = 15000,
    client: IRedisClient = getRedisClient()
  ): Promise<DistributedLock | null> {
    const key = RedisKeys.lock(lockName);
    const token = `tok_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    try {
      const result = await client.set(key, token, { px: ttlMs, nx: true });
      if (result === 'OK') {
        const now = Date.now();
        return {
          lockName,
          token,
          ttlMs,
          acquiredAt: now,
          expiresAt: now + ttlMs,
        };
      }
      return null;
    } catch (err: any) {
      logger.warn(`[DistributedLock] Error acquiring lock for '${lockName}': ${err.message}`);
      return null;
    }
  }

  /**
   * Safely releases a distributed lock ONLY if the token matches the active owner.
   */
  static async releaseLock(
    lock: DistributedLock,
    client: IRedisClient = getRedisClient()
  ): Promise<boolean> {
    const key = RedisKeys.lock(lock.lockName);
    try {
      const res = await client.eval(RELEASE_LOCK_LUA, 1, key, lock.token);
      return res === 1;
    } catch (err: any) {
      logger.error(`[DistributedLock] Error releasing lock for '${lock.lockName}': ${err.message}`);
      return false;
    }
  }

  /**
   * Executes a critical section wrapped with an atomic distributed lock.
   */
  static async withLock<T>(
    lockName: string,
    ttlMs: number,
    fn: (lock: DistributedLock) => Promise<T>,
    client: IRedisClient = getRedisClient()
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lock = await this.acquireLock(lockName, ttlMs, client);
    if (!lock) {
      return { success: false, error: `Could not acquire lock '${lockName}' (resource busy)` };
    }

    try {
      const result = await fn(lock);
      return { success: true, result };
    } finally {
      await this.releaseLock(lock, client);
    }
  }
}

import { getRuntimeEnvironment } from '../config/environment';
import { AppEnv } from '../config/env';

/**
 * Sanitizes input tokens to prevent key injection/traversal.
 */
function sanitizeKeyComponent(val: string): string {
  if (!val || typeof val !== 'string') return 'unknown';
  return val.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

export class RedisKeys {
  private static prefix(env?: AppEnv): string {
    const activeEnv = env || getRuntimeEnvironment();
    return `recoveriq:${activeEnv}`;
  }

  /**
   * Ready queue: List of job IDs waiting to be claimed by active workers.
   */
  static readyQueue(env?: AppEnv): string {
    return `${this.prefix(env)}:queue:recovery:ready`;
  }

  /**
   * Delayed queue: Sorted Set of job IDs (score = scheduled timestamp ms).
   */
  static delayedQueue(env?: AppEnv): string {
    return `${this.prefix(env)}:queue:recovery:delayed`;
  }

  /**
   * Dead-Letter Queue: List or Set of failed/exhausted job IDs.
   */
  static deadLetterQueue(env?: AppEnv): string {
    return `${this.prefix(env)}:queue:recovery:dlq`;
  }

  /**
   * Job payload storage: Hash containing the serialized RecoveryJob.
   */
  static job(jobId: string, env?: AppEnv): string {
    return `${this.prefix(env)}:job:${sanitizeKeyComponent(jobId)}`;
  }

  /**
   * Worker active lease for a job.
   */
  static lease(jobId: string, env?: AppEnv): string {
    return `${this.prefix(env)}:lease:${sanitizeKeyComponent(jobId)}`;
  }

  /**
   * Worker registration and heartbeat metadata.
   */
  static worker(workerId: string, env?: AppEnv): string {
    return `${this.prefix(env)}:worker:${sanitizeKeyComponent(workerId)}`;
  }

  /**
   * Worker registry set containing all active worker IDs.
   */
  static workerRegistry(env?: AppEnv): string {
    return `${this.prefix(env)}:workers:active`;
  }

  /**
   * Distributed mutex lock key.
   */
  static lock(lockName: string, env?: AppEnv): string {
    return `${this.prefix(env)}:lock:${sanitizeKeyComponent(lockName)}`;
  }

  /**
   * Merchant-scoped job tracking set.
   */
  static merchantJobs(merchantId: string, env?: AppEnv): string {
    return `${this.prefix(env)}:merchant:${sanitizeKeyComponent(merchantId)}:jobs`;
  }

  /**
   * Sequence-scoped pending job set for fast cancellation on captured payment.
   */
  static sequenceJobs(sequenceId: string, env?: AppEnv): string {
    return `${this.prefix(env)}:sequence:${sanitizeKeyComponent(sequenceId)}:jobs`;
  }
}

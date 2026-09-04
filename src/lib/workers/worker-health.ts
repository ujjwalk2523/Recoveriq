import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { WorkerStats } from './recovery-worker';

export type WorkerHealthStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';

export interface EvaluatedWorkerHealth {
  workerId: string;
  status: WorkerHealthStatus;
  lastHeartbeatAgeSeconds: number;
  activeJobs: number;
  processedCount: number;
  failedCount: number;
}

export class WorkerHealthService {
  /**
   * Classifies a worker's health based on last heartbeat timestamp age.
   * Heartbeat age < 30s: HEALTHY
   * Heartbeat age 30s - 60s: DEGRADED
   * Heartbeat age > 60s: OFFLINE
   */
  static classifyHeartbeatAge(ageSeconds: number): WorkerHealthStatus {
    if (ageSeconds < 30) return 'HEALTHY';
    if (ageSeconds <= 60) return 'DEGRADED';
    return 'OFFLINE';
  }

  static async getClusterHealth(client: IRedisClient = getRedisClient()): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    offline: number;
    workers: EvaluatedWorkerHealth[];
  }> {
    const workerIds = await client.smembers(RedisKeys.workerRegistry());
    const results: EvaluatedWorkerHealth[] = [];

    let healthy = 0;
    let degraded = 0;
    let offline = 0;

    for (const wid of workerIds) {
      const raw = await client.get(RedisKeys.worker(wid));
      if (!raw) {
        offline++;
        results.push({
          workerId: wid,
          status: 'OFFLINE',
          lastHeartbeatAgeSeconds: 9999,
          activeJobs: 0,
          processedCount: 0,
          failedCount: 0,
        });
        continue;
      }

      const stats: WorkerStats = JSON.parse(raw);
      const ageMs = Date.now() - new Date(stats.lastHeartbeat).getTime();
      const ageSeconds = Math.max(0, Math.floor(ageMs / 1000));
      const status = this.classifyHeartbeatAge(ageSeconds);

      if (status === 'HEALTHY') healthy++;
      else if (status === 'DEGRADED') degraded++;
      else offline++;

      results.push({
        workerId: wid,
        status,
        lastHeartbeatAgeSeconds: ageSeconds,
        activeJobs: stats.activeJobs,
        processedCount: stats.processedCount,
        failedCount: stats.failedCount,
      });
    }

    return {
      total: workerIds.length,
      healthy,
      degraded,
      offline,
      workers: results,
    };
  }
}

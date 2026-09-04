import { getRedisClient, IRedisClient } from '../redis/client';
import { RedisKeys } from '../redis/keys';
import { RecoveryJobQueue } from '../queue/recovery-queue';
import { WorkerHealthService } from './worker-health';

export interface WorkerOperationalMetrics {
  queue: {
    ready: number;
    delayed: number;
    deadLetter: number;
  };
  workers: {
    totalRegistered: number;
    healthy: number;
    degraded: number;
    offline: number;
  };
  timestamp: string;
}

export class WorkerMetricsService {
  /**
   * Aggregates operational queue depth and worker health indicators.
   * Distinct from commercial billing metrics; zero billing pollution.
   */
  static async getOperationalMetrics(client: IRedisClient = getRedisClient()): Promise<WorkerOperationalMetrics> {
    const queueDepth = await RecoveryJobQueue.getQueueDepth(client);
    const workerHealth = await WorkerHealthService.getClusterHealth(client);

    return {
      queue: queueDepth,
      workers: {
        totalRegistered: workerHealth.total,
        healthy: workerHealth.healthy,
        degraded: workerHealth.degraded,
        offline: workerHealth.offline,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

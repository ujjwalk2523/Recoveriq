/**
 * Phase 8.8 — Redis Recovery & Queue Reconstruction Service
 *
 * Implements recovery from total Redis loss, empty restarts, and queue rebuilds.
 *
 * PRINCIPLE:
 * PostgreSQL is authoritative. Redis is disposable compute and coordination state.
 */

import { getRedisClient, IRedisClient } from '../../redis/client';
import { RedisKeys } from '../../redis/keys';
import { QueueRebuildService } from './queue-rebuild';

export class RedisRecoveryService {
  /**
   * Pings Redis to check availability.
   */
  static async checkRedisHealth(client: IRedisClient = getRedisClient()): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      const pong = await client.ping();
      return { available: pong === 'PONG' };
    } catch (err: any) {
      return { available: false, error: err.message };
    }
  }

  /**
   * Reconstructs transient queue state into Redis from PostgreSQL.
   */
  static async reconstructQueuesFromPostgres(params?: {
    dryRun?: boolean;
    organizationId?: string;
    client?: IRedisClient;
  }): Promise<{
    rebuiltCount: number;
    skippedTerminalCount: number;
    staleLeasesResetCount: number;
    dryRun: boolean;
  }> {
    const client = params?.client || getRedisClient();

    // Verify Redis is responsive before attempting rebuild
    const health = await this.checkRedisHealth(client);
    if (!health.available) {
      throw new Error(`Redis recovery aborted: Redis instance is unreachable (${health.error}).`);
    }

    return QueueRebuildService.rebuildQueues({
      dryRun: params?.dryRun ?? false,
      organizationId: params?.organizationId,
      client,
    });
  }
}

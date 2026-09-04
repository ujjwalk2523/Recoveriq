/**
 * Phase 8.8 — Dependency Health Monitor & Chaos Probe
 *
 * Actively tests external dependency availability and provides controlled failure injection.
 */

import { checkDatabaseHealth } from '../../db/prisma';
import { getRedisClient } from '../../redis/client';
import {
  SystemDependency,
  DependencyStatus,
  INITIAL_DEPENDENCIES,
} from './dependency-state';

export class DependencyHealthMonitor {
  private static overriddenStatuses = new Map<string, DependencyStatus>();

  static setStatusOverride(name: string, status: DependencyStatus): void {
    this.overriddenStatuses.set(name, status);
  }

  static clearOverrides(): void {
    this.overriddenStatuses.clear();
  }

  /**
   * Checks health across all registered system dependencies.
   */
  static async checkAllDependencies(): Promise<SystemDependency[]> {
    const results: SystemDependency[] = [];

    for (const [key, dep] of Object.entries(INITIAL_DEPENDENCIES)) {
      const override = this.overriddenStatuses.get(key);
      if (override) {
        results.push({
          ...dep,
          status: override,
          lastCheckedAt: new Date().toISOString(),
          latencyMs: override === 'UNAVAILABLE' ? 5000 : dep.latencyMs,
        });
        continue;
      }

      let status: DependencyStatus = 'HEALTHY';
      let latency = dep.latencyMs;
      const start = Date.now();

      try {
        if (key === 'POSTGRESQL') {
          if (process.env.SKIP_DB !== 'true') {
            const db = await checkDatabaseHealth();
            status = db.status === 'ok' ? 'HEALTHY' : 'UNAVAILABLE';
            latency = db.latencyMs || Date.now() - start;
          }
        } else if (key === 'REDIS') {
          const client = getRedisClient();
          const pong = await client.ping().catch(() => null);
          status = pong === 'PONG' ? 'HEALTHY' : 'UNAVAILABLE';
          latency = Date.now() - start;
        }
      } catch {
        status = 'UNAVAILABLE';
        latency = Date.now() - start;
      }

      results.push({
        ...dep,
        status,
        latencyMs: latency,
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return results;
  }
}

/**
 * Phase 8.8 — Dependency Failure Matrix & Deterministic Handlers
 *
 * Implements policy enforcement when individual dependencies degrade or become unavailable.
 */

import { SystemDependency } from './dependency-state';
import { DependencyHealthMonitor } from './dependency-health';

export class DependencyRecoveryService {
  /**
   * Asserts whether payment operations are safe to proceed given current dependency states.
   */
  static async assertPaymentExecutionSafe(): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const deps = await DependencyHealthMonitor.checkAllDependencies();

    const pg = deps.find(d => d.name === 'POSTGRESQL');
    if (pg && pg.status === 'UNAVAILABLE') {
      return {
        allowed: false,
        reason: 'PostgreSQL primary is unavailable. Payment execution blocked to prevent inconsistent business state.',
      };
    }

    const rzp = deps.find(d => d.name === 'RAZORPAY');
    if (rzp && rzp.status === 'UNAVAILABLE') {
      return {
        allowed: false,
        reason: 'Razorpay provider is unavailable. Payment execution paused; job will retry when gateway recovers.',
      };
    }

    return { allowed: true };
  }

  /**
   * Selects prediction engine: ML model or heuristic fallback if ML service is unavailable.
   */
  static async resolvePredictionEngine(): Promise<{
    engine: 'ML_MODEL' | 'HEURISTIC_FALLBACK';
    isFallback: boolean;
    reason: string;
  }> {
    const deps = await DependencyHealthMonitor.checkAllDependencies();
    const ml = deps.find(d => d.name === 'ML_SERVICE');

    if (ml && ml.status === 'UNAVAILABLE') {
      return {
        engine: 'HEURISTIC_FALLBACK',
        isFallback: true,
        reason: 'ML service is currently unavailable. Using deterministic heuristic strategy fallback.',
      };
    }

    return {
      engine: 'ML_MODEL',
      isFallback: false,
      reason: 'ML service is healthy and active.',
    };
  }
}

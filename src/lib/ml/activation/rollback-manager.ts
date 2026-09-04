import { CircuitBreakerStatus, RolloutTier } from './activation-types';
import { MLHealthReport } from '../observability/observability-types';

export class RollbackManager {
  private static status: CircuitBreakerStatus = 'CLOSED';
  private static tripReason: string | null = null;
  private static trippedAt: string | null = null;
  private static lastEvaluatedHealthScore = 100;

  /**
   * Evaluates telemetry and automatically trips the circuit breaker if degraded
   */
  static evaluateHealthAndAutoRollback(healthReport: MLHealthReport): {
    circuitBreakerStatus: CircuitBreakerStatus;
    tripped: boolean;
    reason?: string;
  } {
    this.lastEvaluatedHealthScore = healthReport.overallScore;

    // Conditions that trigger automated emergency rollback
    const isDegraded = healthReport.overallScore < 70;
    const isCriticalGrade = healthReport.grade === 'CRITICAL';
    const isCriticalDrift = healthReport.drift.overallStatus === 'CRITICAL';
    const isOutcomePlunge = Math.abs(healthReport.drift.outcomeDrift.rateDelta) >= 0.18;

    if (this.status !== 'OPEN' && (isDegraded || isCriticalGrade || isCriticalDrift || isOutcomePlunge)) {
      this.status = 'OPEN';
      this.trippedAt = new Date().toISOString();
      this.tripReason = `Automated rollback triggered: ML Health=${healthReport.overallScore}/100, Grade=${healthReport.grade}, Drift=${healthReport.drift.overallStatus}, OutcomeDrop=${(healthReport.drift.outcomeDrift.rateDelta * 100).toFixed(1)}%`;

      console.warn(`[CircuitBreaker] 🚨 TRIPPED TO OPEN! ${this.tripReason}. All active traffic reverted to 0% (Heuristic Fallback).`);

      return {
        circuitBreakerStatus: 'OPEN',
        tripped: true,
        reason: this.tripReason,
      };
    }

    return {
      circuitBreakerStatus: this.status,
      tripped: this.status === 'OPEN',
      reason: this.tripReason ?? undefined,
    };
  }

  /**
   * Returns current circuit breaker status and effective rollout tier
   */
  static getEffectiveRollout(configuredTier: RolloutTier): {
    effectiveTier: RolloutTier;
    isCircuitBreakerOpen: boolean;
    tripReason: string | null;
  } {
    if (this.status === 'OPEN') {
      return {
        effectiveTier: 'SHADOW_0',
        isCircuitBreakerOpen: true,
        tripReason: this.tripReason,
      };
    }

    return {
      effectiveTier: configuredTier,
      isCircuitBreakerOpen: false,
      tripReason: null,
    };
  }

  /**
   * Manually trips the circuit breaker
   */
  static trip(reason: string): void {
    this.status = 'OPEN';
    this.tripReason = reason;
    this.trippedAt = new Date().toISOString();
    console.warn(`[CircuitBreaker] Manual trip to OPEN: ${reason}`);
  }

  /**
   * Resets the circuit breaker to CLOSED
   */
  static reset(): void {
    this.status = 'CLOSED';
    this.tripReason = null;
    this.trippedAt = null;
    console.log('[CircuitBreaker] Circuit breaker reset to CLOSED.');
  }

  static getStatus(): CircuitBreakerStatus {
    return this.status;
  }

  static getTripReason(): string | null {
    return this.tripReason;
  }
}

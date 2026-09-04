/**
 * Phase 8.8 — Recovery State Machine Model
 *
 * Validates and tracks transitions between discrete recovery states.
 */

import { DisasterRecoveryState } from '../disaster-recovery/dr-types';

const VALID_TRANSITIONS: Record<DisasterRecoveryState, DisasterRecoveryState[]> = {
  HEALTHY: ['DEGRADED', 'RECOVERING'],
  DEGRADED: ['RECOVERING', 'HEALTHY', 'MANUAL_INTERVENTION_REQUIRED'],
  RECOVERING: ['RECONCILING', 'FAILED', 'MANUAL_INTERVENTION_REQUIRED'],
  RECONCILING: ['RESTORED', 'READY', 'HEALTHY', 'FAILED', 'MANUAL_INTERVENTION_REQUIRED'],
  RESTORED: ['READY', 'HEALTHY', 'RECONCILING', 'MANUAL_INTERVENTION_REQUIRED'],
  READY: ['HEALTHY', 'DEGRADED', 'RECOVERING'],
  FAILED: ['RECOVERING', 'MANUAL_INTERVENTION_REQUIRED'],
  MANUAL_INTERVENTION_REQUIRED: ['RECOVERING', 'HEALTHY', 'READY'],
};

export class RecoveryStateManager {
  private static currentState: DisasterRecoveryState = 'HEALTHY';
  private static stateHistory: Array<{
    from: DisasterRecoveryState;
    to: DisasterRecoveryState;
    timestamp: string;
    reason: string;
  }> = [];

  static getCurrentState(): DisasterRecoveryState {
    return this.currentState;
  }

  static transitionTo(
    nextState: DisasterRecoveryState,
    reason: string
  ): { success: boolean; error?: string } {
    const from = this.currentState;
    const allowed = VALID_TRANSITIONS[from];

    if (!allowed || !allowed.includes(nextState)) {
      return {
        success: false,
        error: `Invalid recovery state transition from '${from}' to '${nextState}'.`,
      };
    }

    this.currentState = nextState;
    this.stateHistory.push({
      from,
      to: nextState,
      timestamp: new Date().toISOString(),
      reason,
    });

    return { success: true };
  }

  static getHistory() {
    return [...this.stateHistory];
  }

  static resetForTesting() {
    this.currentState = 'HEALTHY';
    this.stateHistory = [];
  }
}

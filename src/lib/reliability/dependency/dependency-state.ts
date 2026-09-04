/**
 * Phase 8.8 — Dependency State Contracts & Criticality Matrix
 *
 * Classifies external platform dependencies and their operational criticality.
 */

export type DependencyStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'RECOVERING';
export type DependencyCriticality = 'CRITICAL' | 'NON_CRITICAL';

export interface SystemDependency {
  name: 'POSTGRESQL' | 'REDIS' | 'RAZORPAY' | 'ML_SERVICE' | 'EMAIL' | 'WHATSAPP';
  displayName: string;
  criticality: DependencyCriticality;
  status: DependencyStatus;
  lastCheckedAt: string;
  latencyMs: number;
  failureBehavior: string;
  recoveryProcedure: string;
}

export const INITIAL_DEPENDENCIES: Record<string, SystemDependency> = {
  POSTGRESQL: {
    name: 'POSTGRESQL',
    displayName: 'PostgreSQL Primary Database',
    criticality: 'CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 1,
    failureBehavior: 'Halt all business writes and payment mutations immediately (Fail-Closed).',
    recoveryProcedure: 'Verify connection pool, restore standby or point-in-time backup, re-verify schema and audit chains.',
  },
  REDIS: {
    name: 'REDIS',
    displayName: 'Redis Distributed Cache & Queues',
    criticality: 'CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 1,
    failureBehavior: 'Pause distributed worker dispatch; preserve PostgreSQL authoritative state.',
    recoveryProcedure: 'Restart/provision Redis instance, run QueueRebuildService to reconstruct active jobs from PostgreSQL.',
  },
  RAZORPAY: {
    name: 'RAZORPAY',
    displayName: 'Razorpay Payment Gateway Adapter',
    criticality: 'CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 20,
    failureBehavior: 'Do NOT execute payments; queue jobs for delayed retry; do not record false customer payment failures.',
    recoveryProcedure: 'Reconcile in-flight transactions with PaymentReconciliationService once provider health recovers.',
  },
  ML_SERVICE: {
    name: 'ML_SERVICE',
    displayName: 'Autonomous ML Prediction & Bandit Engine',
    criticality: 'NON_CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 5,
    failureBehavior: 'Fallback to deterministic heuristic recovery strategies without blocking payments.',
    recoveryProcedure: 'Verify model calibration, feature store latency, and reload policy weights.',
  },
  WHATSAPP: {
    name: 'WHATSAPP',
    displayName: 'WhatsApp Business API Provider',
    criticality: 'NON_CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 25,
    failureBehavior: 'Queue customer recovery notifications with exponential backoff; fallback to email or link.',
    recoveryProcedure: 'Drain retry queue and verify Meta Cloud API token validity.',
  },
  EMAIL: {
    name: 'EMAIL',
    displayName: 'Transactional Email Gateway (Resend / SMTP)',
    criticality: 'NON_CRITICAL',
    status: 'HEALTHY',
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 15,
    failureBehavior: 'Buffer outbound notifications; retry upon service restoration.',
    recoveryProcedure: 'Drain buffered outbound notification queue.',
  },
};

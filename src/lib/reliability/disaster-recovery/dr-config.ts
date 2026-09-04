/**
 * Phase 8.8 — Disaster Recovery Configuration & RPO/RTO Objectives
 *
 * Defines recovery objectives (RPO / RTO), retention classes, and timeout envelopes.
 */

export interface SystemRecoveryObjective {
  domain: string;
  targetRpoMinutes: number; // Max allowable data loss window
  targetRtoMinutes: number; // Max allowable recovery time window
  criticality: 'TIER_0_CRITICAL' | 'TIER_1_ESSENTIAL' | 'TIER_2_OPERATIONAL';
  description: string;
}

export const RECOVERY_OBJECTIVES: Record<string, SystemRecoveryObjective> = {
  database: {
    domain: 'PostgreSQL Database',
    targetRpoMinutes: 5, // Point-in-time recovery to 5 mins
    targetRtoMinutes: 30, // Standby restore within 30 mins
    criticality: 'TIER_0_CRITICAL',
    description: 'Authoritative system of record for all platform state',
  },
  payment_execution: {
    domain: 'Payment Execution & Idempotency',
    targetRpoMinutes: 0, // Zero transaction loss; reconciliation if uncertain
    targetRtoMinutes: 15,
    criticality: 'TIER_0_CRITICAL',
    description: 'Autonomous payment recovery and gateway retry workflows',
  },
  audit_ledger: {
    domain: 'Immutable Audit Ledger',
    targetRpoMinutes: 0, // Zero audit record loss
    targetRtoMinutes: 15,
    criticality: 'TIER_0_CRITICAL',
    description: 'Cryptographic append-only compliance audit trail',
  },
  redis: {
    domain: 'Redis Queue & Distributed Coordination',
    targetRpoMinutes: 0, // Reconstructed from PostgreSQL on loss
    targetRtoMinutes: 10,
    criticality: 'TIER_1_ESSENTIAL',
    description: 'Transient queues, worker locks, and rate limit counters',
  },
  workers: {
    domain: 'Distributed Recovery Workers',
    targetRpoMinutes: 0, // Disposable compute; state resides in DB/Redis
    targetRtoMinutes: 5,
    criticality: 'TIER_1_ESSENTIAL',
    description: 'Background recovery execution workers',
  },
  webhooks: {
    domain: 'Developer & Inbound Webhooks',
    targetRpoMinutes: 15,
    targetRtoMinutes: 30,
    criticality: 'TIER_1_ESSENTIAL',
    description: 'Inbound gateway webhooks and outbound developer event dispatch',
  },
  billing: {
    domain: 'SaaS Billing & Invoices',
    targetRpoMinutes: 5,
    targetRtoMinutes: 60,
    criticality: 'TIER_2_OPERATIONAL',
    description: 'Subscription lifecycle, usage metering, and invoice generation',
  },
};

export const DR_CONFIG = {
  defaultDatabaseIdentifier: 'recoveriq-pg-primary',
  defaultRetentionClass: 'STANDARD_30D',
  maxAllowedBackupAgeHours: 24,
  maxStaleLeaseSeconds: 60,
  reconciliationBatchSize: 100,
  maxConsecutiveFailuresBeforeManualIntervention: 3,
};

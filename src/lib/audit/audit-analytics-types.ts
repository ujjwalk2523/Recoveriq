/**
 * RecoverIQ — Enterprise Audit Analytics Types & Interfaces (Phase 8.7.2)
 */

import { ActorType, AuditCategory, AuditSeverity, AuditResult, AuditEventRecord } from './audit-types';

export const TIME_WINDOWS = [
  'LAST_24_HOURS',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'CUSTOM',
] as const;

export type AuditTimeWindow = (typeof TIME_WINDOWS)[number];

export interface TimeWindowFilter {
  window?: AuditTimeWindow;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditActivitySummary {
  organizationId: string;
  timeWindow: AuditTimeWindow;
  startDate: string;
  endDate: string;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  deniedEvents: number;
  criticalEvents: number;
  highSeverityEvents: number;
  uniqueActors: number;
  uniqueResources: number;
  uniqueSessions: number;
  uniqueApiKeys: number;
}

export interface AuditTimeSeriesPoint {
  timestamp: string; // Bucket start time in ISO 8601 UTC
  eventCount: number;
  successCount: number;
  failureCount: number;
  deniedCount: number;
}

export interface AuditCategoryMetric {
  category: AuditCategory;
  count: number;
  percentage: number;
}

export interface AuditActionMetric {
  action: string;
  count: number;
  successCount: number;
  failureCount: number;
  deniedCount: number;
  lastOccurredAt: string;
}

export interface AuditActorMetric {
  actorId: string;
  actorType: ActorType;
  displayName: string | null;
  email: string | null;
  eventCount: number;
  successCount: number;
  failureCount: number;
  deniedCount: number;
  highSeverityCount: number;
  criticalCount: number;
  lastActivityAt: string;
}

export interface AuditActorProfile {
  actorId: string;
  actorType: ActorType;
  displayName: string | null;
  email: string | null;
  totalEvents: number;
  firstActivityAt: string;
  lastActivityAt: string;
  actionBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  resultBreakdown: {
    success: number;
    failure: number;
    denied: number;
  };
  resourcesTouched: Array<{
    type: string;
    id: string;
    eventCount: number;
  }>;
  recentTimeline: AuditEventRecord[];
}

export interface AuditResourceMetric {
  resourceType: string;
  resourceId: string;
  eventCount: number;
  uniqueActors: number;
  actions: string[];
  firstActivityAt: string;
  lastActivityAt: string;
  failureCount: number;
  deniedCount: number;
}

export interface AuditSecuritySummary {
  criticalEvents: number;
  highSeverityEvents: number;
  securityCategoryEvents: number;
  authorizationDenials: number;
  authFailureRate: number; // 0.00 to 1.00
  loginSuccessCount: number;
  loginFailureCount: number;
  mfaSuccessCount: number;
  mfaFailureCount: number;
  mfaFailureRate: number; // 0.00 to 1.00
  passwordResetRequests: number;
  passwordResetCompletions: number;
  sessionCreations: number;
  sessionRevocations: number;
  logoutAllCount: number;
  ssoLoginCount: number;
  apiKeyLifecycleEvents: number;
  securityPolicyChanges: number;
}

export interface AuditInvestigationTimeline {
  correlationKey: 'requestId' | 'sessionId' | 'actorId' | 'resourceId';
  correlationValue: string;
  totalEvents: number;
  events: AuditEventRecord[];
}

export const ANOMALY_SEVERITIES = [
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const ANOMALY_TYPES = [
  'ACTOR_ACTIVITY_SPIKE',
  'DENIAL_SPIKE',
  'AUTHENTICATION_FAILURE_SPIKE',
  'CRITICAL_SEVERITY_BURST',
  'API_KEY_ACTIVITY_SPIKE',
  'ADMINISTRATIVE_BURST',
  'RESOURCE_CONCENTRATION',
] as const;

export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export interface AuditAnomaly {
  fingerprint: string;
  organizationId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  actorId?: string;
  actorType?: ActorType;
  resourceType?: string;
  resourceId?: string;
  observedValue: number;
  baselineValue: number;
  deviationMultiple: number;
  explanation: string;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface AnomalyDetectionResult {
  organizationId: string;
  baselineStatus: 'NORMAL' | 'ANOMALOUS' | 'INSUFFICIENT_DATA';
  totalCheckedEvents: number;
  anomalies: AuditAnomaly[];
}

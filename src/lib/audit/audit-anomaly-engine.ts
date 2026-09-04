/**
 * RecoverIQ — Deterministic Audit Anomaly Detection Engine (Phase 8.7.2)
 *
 * Implements explainable statistical anomaly detection over immutable audit ledger evidence.
 * ZERO EXTERNAL ML, ZERO LLM INFERENCE, DETERMINISTIC & TESTABLE.
 * NEVER MUTATES HISTORICAL AUDIT EVIDENCE.
 */

import crypto from 'crypto';
import { IN_MEMORY_AUDIT_LEDGER } from './audit-repository';
import { prisma } from '@/lib/db/prisma';
import {
  AuditAnomaly,
  AnomalyDetectionResult,
  AnomalyType,
  AnomalySeverity,
} from './audit-analytics-types';
import { AuditEventRecord, ActorType, AuditCategory } from './audit-types';

export class AuditAnomalyEngine {
  private static readonly MIN_EVENTS_FOR_BASELINE = 10;
  private static readonly ACTIVITY_SPIKE_THRESHOLD = 3.0; // 3x baseline
  private static readonly DENIAL_SPIKE_THRESHOLD = 2.5;

  /**
   * Generates a deterministic, stable fingerprint for anomaly deduplication.
   */
  static generateFingerprint(
    organizationId: string,
    type: AnomalyType,
    target: string,
    timeBucket: string
  ): string {
    const raw = `${organizationId}:${type}:${target}:${timeBucket}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24);
  }

  /**
   * Evaluates organization audit history and returns explainable anomalies.
   */
  static async detectAnomalies(params: {
    organizationId: string;
    lookbackDays?: number;
    recentWindowHours?: number;
  }): Promise<AnomalyDetectionResult> {
    const { organizationId } = params;
    const lookbackDays = params.lookbackDays ?? 30;
    const recentWindowHours = params.recentWindowHours ?? 2;

    const now = Date.now();
    const lookbackStart = new Date(now - lookbackDays * 24 * 60 * 60 * 1000);
    const recentStart = new Date(now - recentWindowHours * 60 * 60 * 1000);

    // Fetch all events for the organization
    let events: AuditEventRecord[] = [];

    if (process.env.SKIP_DB !== 'true') {
      try {
        const rows = await prisma.auditLog.findMany({
          where: {
            organizationId,
            occurredAt: { gte: lookbackStart },
          },
          orderBy: { sequenceNumber: 'asc' },
          take: 100000,
        });

        if (rows.length > 0) {
          events = rows.map(r => ({
            id: r.id,
            organizationId: r.organizationId,
            merchantId: r.merchantId,
            actor: {
              type: r.actorType as ActorType,
              id: r.actorId,
              displayName: r.actorDisplayName || r.actorName,
              email: r.actorEmail,
            },
            action: r.action,
            category: (r.category || 'SYSTEM') as AuditCategory,
            severity: (r.severity || 'INFO') as any,
            result: (r.result || 'SUCCESS') as any,
            resource: {
              type: r.resourceType || r.entityType,
              id: r.resourceId || r.entityId,
            },
            requestId: r.requestId,
            sessionId: r.sessionId,
            ipHash: r.ipHash,
            userAgentSummary: r.userAgentSummary,
            metadata: r.metadata ? JSON.parse(r.metadata) : null,
            previousState: r.previousState ? JSON.parse(r.previousState) : null,
            newState: r.newState ? JSON.parse(r.newState) : null,
            integrity: {
              sequenceNumber: r.sequenceNumber ?? 0,
              eventHash: r.eventHash || r.integrityHash || '',
              previousEventHash: r.previousEventHash,
              schemaVersion: r.schemaVersion ?? 1,
            },
            occurredAt: (r.occurredAt || r.timestamp).toISOString(),
            createdAt: (r.createdAt || r.timestamp).toISOString(),
          }));
        }
      } catch {
        // Fallback to in-memory ledger
      }
    }

    if (events.length === 0) {
      events = IN_MEMORY_AUDIT_LEDGER.filter(
        e => e.organizationId === organizationId && new Date(e.occurredAt) >= lookbackStart
      );
    }

    // Safety Guard: Insufficient data check
    if (events.length < this.MIN_EVENTS_FOR_BASELINE) {
      return {
        organizationId,
        baselineStatus: 'INSUFFICIENT_DATA',
        totalCheckedEvents: events.length,
        anomalies: [],
      };
    }

    const historicalEvents: AuditEventRecord[] = [];
    const recentEvents: AuditEventRecord[] = [];

    for (const e of events) {
      const t = new Date(e.occurredAt).getTime();
      if (t >= recentStart.getTime()) {
        recentEvents.push(e);
      } else {
        historicalEvents.push(e);
      }
    }

    const anomalies: AuditAnomaly[] = [];
    const currentHourBucket = new Date(Math.floor(now / 3600000) * 3600000).toISOString();

    // -------------------------------------------------------------------------
    // Signal 1: Actor Activity Spike
    // -------------------------------------------------------------------------
    const historicalActorCounts = new Map<string, number>();
    for (const e of historicalEvents) {
      const aKey = e.actor.id || `anon_${e.actor.type}`;
      historicalActorCounts.set(aKey, (historicalActorCounts.get(aKey) || 0) + 1);
    }

    // Baseline window duration in hours
    const baselineHours = Math.max((recentStart.getTime() - lookbackStart.getTime()) / 3600000, 1);

    const recentActorCounts = new Map<string, { count: number; actor: any }>();
    for (const e of recentEvents) {
      const aKey = e.actor.id || `anon_${e.actor.type}`;
      const entry = recentActorCounts.get(aKey) || { count: 0, actor: e.actor };
      entry.count++;
      recentActorCounts.set(aKey, entry);
    }

    for (const [actorKey, { count: recentCount, actor }] of recentActorCounts.entries()) {
      const historicalTotal = historicalActorCounts.get(actorKey) || 0;
      const hourlyBaseline = historicalTotal > 0 ? historicalTotal / baselineHours : 1.0;
      const expectedInRecent = Math.max(hourlyBaseline * recentWindowHours, 2.0);

      const multiple = recentCount / expectedInRecent;

      if (recentCount >= 5 && multiple >= this.ACTIVITY_SPIKE_THRESHOLD) {
        const severity: AnomalySeverity =
          multiple >= 10.0 ? 'CRITICAL' : multiple >= 5.0 ? 'HIGH' : 'MEDIUM';

        anomalies.push({
          fingerprint: this.generateFingerprint(
            organizationId,
            'ACTOR_ACTIVITY_SPIKE',
            actorKey,
            currentHourBucket
          ),
          organizationId,
          anomalyType: 'ACTOR_ACTIVITY_SPIKE',
          severity,
          actorId: actor.id || actorKey,
          actorType: actor.type,
          observedValue: recentCount,
          baselineValue: Math.round(expectedInRecent * 10) / 10,
          deviationMultiple: Math.round(multiple * 100) / 100,
          explanation: `Actor '${actor.displayName || actor.id || actor.type}' executed ${recentCount} actions in the last ${recentWindowHours}h, exceeding the baseline of ${Math.round(expectedInRecent * 10) / 10} by ${Math.round(multiple * 10) / 10}x.`,
          firstObservedAt: recentEvents[0]?.occurredAt || new Date().toISOString(),
          lastObservedAt: recentEvents[recentEvents.length - 1]?.occurredAt || new Date().toISOString(),
        });
      }
    }

    // -------------------------------------------------------------------------
    // Signal 2: Authorization Denial Spike
    // -------------------------------------------------------------------------
    const recentDenials = recentEvents.filter(e => e.result === 'DENIED');
    const historicalDenials = historicalEvents.filter(e => e.result === 'DENIED');

    const historicalDenialRate =
      historicalEvents.length > 0 ? historicalDenials.length / baselineHours : 0.2;
    const expectedDenialsInRecent = Math.max(historicalDenialRate * recentWindowHours, 1.0);

    if (recentDenials.length >= 3 && recentDenials.length / expectedDenialsInRecent >= this.DENIAL_SPIKE_THRESHOLD) {
      const mult = Math.round((recentDenials.length / expectedDenialsInRecent) * 100) / 100;
      anomalies.push({
        fingerprint: this.generateFingerprint(
          organizationId,
          'DENIAL_SPIKE',
          'all_denials',
          currentHourBucket
        ),
        organizationId,
        anomalyType: 'DENIAL_SPIKE',
        severity: mult >= 5.0 ? 'HIGH' : 'MEDIUM',
        observedValue: recentDenials.length,
        baselineValue: Math.round(expectedDenialsInRecent * 10) / 10,
        deviationMultiple: mult,
        explanation: `Observed ${recentDenials.length} authorization denials in the past ${recentWindowHours}h, exceeding the historical baseline of ${Math.round(expectedDenialsInRecent * 10) / 10} by ${mult}x.`,
        firstObservedAt: recentDenials[0].occurredAt,
        lastObservedAt: recentDenials[recentDenials.length - 1].occurredAt,
      });
    }

    // -------------------------------------------------------------------------
    // Signal 3: Authentication Failure Spike (Brute Force / Password Spray)
    // -------------------------------------------------------------------------
    const recentAuthFailures = recentEvents.filter(
      e => e.category === 'AUTHENTICATION' && e.result === 'FAILURE'
    );

    if (recentAuthFailures.length >= 5) {
      anomalies.push({
        fingerprint: this.generateFingerprint(
          organizationId,
          'AUTHENTICATION_FAILURE_SPIKE',
          'auth_failures',
          currentHourBucket
        ),
        organizationId,
        anomalyType: 'AUTHENTICATION_FAILURE_SPIKE',
        severity: recentAuthFailures.length >= 15 ? 'CRITICAL' : 'HIGH',
        observedValue: recentAuthFailures.length,
        baselineValue: 1.0,
        deviationMultiple: recentAuthFailures.length,
        explanation: `Detected burst of ${recentAuthFailures.length} authentication failures within ${recentWindowHours}h, indicating potential credential spraying or repeated failed login attempts.`,
        firstObservedAt: recentAuthFailures[0].occurredAt,
        lastObservedAt: recentAuthFailures[recentAuthFailures.length - 1].occurredAt,
      });
    }

    // -------------------------------------------------------------------------
    // Signal 4: Critical Severity Burst
    // -------------------------------------------------------------------------
    const recentCritical = recentEvents.filter(e => e.severity === 'CRITICAL');
    if (recentCritical.length >= 2) {
      anomalies.push({
        fingerprint: this.generateFingerprint(
          organizationId,
          'CRITICAL_SEVERITY_BURST',
          'critical_ops',
          currentHourBucket
        ),
        organizationId,
        anomalyType: 'CRITICAL_SEVERITY_BURST',
        severity: 'CRITICAL',
        observedValue: recentCritical.length,
        baselineValue: 0.1,
        deviationMultiple: recentCritical.length * 10,
        explanation: `Concentration of ${recentCritical.length} critical administrative/security operations occurred within ${recentWindowHours}h.`,
        firstObservedAt: recentCritical[0].occurredAt,
        lastObservedAt: recentCritical[recentCritical.length - 1].occurredAt,
      });
    }

    // -------------------------------------------------------------------------
    // Signal 5: Resource Access Concentration
    // -------------------------------------------------------------------------
    const actorResources = new Map<string, Set<string>>();
    for (const e of recentEvents) {
      const aKey = e.actor.id || e.actor.type;
      const resSet = actorResources.get(aKey) || new Set<string>();
      resSet.add(`${e.resource.type}:${e.resource.id}`);
      actorResources.set(aKey, resSet);
    }

    for (const [aKey, resSet] of actorResources.entries()) {
      if (resSet.size >= 8) {
        anomalies.push({
          fingerprint: this.generateFingerprint(
            organizationId,
            'RESOURCE_CONCENTRATION',
            aKey,
            currentHourBucket
          ),
          organizationId,
          anomalyType: 'RESOURCE_CONCENTRATION',
          severity: 'MEDIUM',
          actorId: aKey,
          observedValue: resSet.size,
          baselineValue: 2.0,
          deviationMultiple: Math.round((resSet.size / 2.0) * 10) / 10,
          explanation: `Actor '${aKey}' accessed ${resSet.size} distinct resources within ${recentWindowHours}h, significantly broader than normal access concentration.`,
          firstObservedAt: recentEvents[0]?.occurredAt || new Date().toISOString(),
          lastObservedAt: recentEvents[recentEvents.length - 1]?.occurredAt || new Date().toISOString(),
        });
      }
    }

    return {
      organizationId,
      baselineStatus: anomalies.length > 0 ? 'ANOMALOUS' : 'NORMAL',
      totalCheckedEvents: events.length,
      anomalies,
    };
  }
}

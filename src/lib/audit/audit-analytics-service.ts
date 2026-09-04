/**
 * RecoverIQ — Enterprise Audit Analytics & Investigation Service (Phase 8.7.2)
 *
 * Provides read-only derived analytics, metrics aggregations, actor/resource profiling,
 * and correlated investigation timelines from the immutable audit ledger.
 * NEVER WRITES TO OR MUTATES THE AUDIT LOG.
 */

import { prisma } from '@/lib/db/prisma';
import { ApplicationError } from '@/lib/errors/application-error';
import { IN_MEMORY_AUDIT_LEDGER } from './audit-repository';
import { AuditRedactor } from './audit-redactor';
import {
  AuditTimeWindow,
  TimeWindowFilter,
  AuditActivitySummary,
  AuditTimeSeriesPoint,
  AuditCategoryMetric,
  AuditActionMetric,
  AuditActorMetric,
  AuditActorProfile,
  AuditResourceMetric,
  AuditSecuritySummary,
  AuditInvestigationTimeline,
} from './audit-analytics-types';
import { AuditEventRecord, ActorType, AuditCategory } from './audit-types';

export class AuditAnalyticsService {
  /**
   * Resolves normalized UTC date bounds from a TimeWindowFilter.
   */
  static resolveTimeRange(filter: TimeWindowFilter): {
    window: AuditTimeWindow;
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const window = filter.window || 'LAST_7_DAYS';

    if (window === 'CUSTOM') {
      if (!filter.startDate || !filter.endDate) {
        throw new ApplicationError({
          code: 'INVALID_TIME_RANGE',
          message: 'Both startDate and endDate are required for CUSTOM time window.',
          statusCode: 400,
          safeMessage: 'Please provide valid start and end dates.',
        });
      }
      const s = new Date(filter.startDate);
      const e = new Date(filter.endDate);

      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        throw new ApplicationError({
          code: 'MALFORMED_DATE',
          message: 'Invalid ISO date string provided for time range.',
          statusCode: 400,
          safeMessage: 'Please provide valid date strings.',
        });
      }

      if (s >= e) {
        throw new ApplicationError({
          code: 'INVALID_TIME_ORDER',
          message: 'startDate must strictly precede endDate.',
          statusCode: 400,
          safeMessage: 'Start date must be before end date.',
        });
      }

      // Max window safety limit: 180 days
      const maxMs = 180 * 24 * 60 * 60 * 1000;
      if (e.getTime() - s.getTime() > maxMs) {
        throw new ApplicationError({
          code: 'TIME_RANGE_TOO_LARGE',
          message: 'Custom query range cannot exceed 180 days.',
          statusCode: 400,
          safeMessage: 'Time range cannot exceed 180 days.',
        });
      }

      return { window: 'CUSTOM', startDate: s, endDate: e };
    }

    let startMs = now.getTime();
    switch (window) {
      case 'LAST_24_HOURS':
        startMs -= 24 * 60 * 60 * 1000;
        break;
      case 'LAST_7_DAYS':
        startMs -= 7 * 24 * 60 * 60 * 1000;
        break;
      case 'LAST_30_DAYS':
        startMs -= 30 * 24 * 60 * 60 * 1000;
        break;
      case 'LAST_90_DAYS':
        startMs -= 90 * 24 * 60 * 60 * 1000;
        break;
    }

    return {
      window,
      startDate: new Date(startMs),
      endDate: now,
    };
  }

  /**
   * Helper to retrieve scoped audit events within date range (from DB or memory fallback).
   */
  private static async getScopedEvents(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    merchantId?: string
  ): Promise<AuditEventRecord[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const rows = await prisma.auditLog.findMany({
          where: {
            organizationId,
            ...(merchantId ? { merchantId } : {}),
            occurredAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { sequenceNumber: 'desc' },
          take: 100000,
        });

        if (rows.length > 0) {
          return rows.map(r => ({
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
        // Fall through to in-memory ledger
      }
    }

    return IN_MEMORY_AUDIT_LEDGER.filter(e => {
      if (e.organizationId !== organizationId) return false;
      if (merchantId && e.merchantId !== merchantId) return false;
      const t = new Date(e.occurredAt).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
  }

  /**
   * Generates organization-scoped activity overview and metric distributions.
   */
  static async getActivitySummary(params: {
    organizationId: string;
    filter?: TimeWindowFilter;
    merchantId?: string;
  }): Promise<{
    summary: AuditActivitySummary;
    categories: AuditCategoryMetric[];
    topActions: AuditActionMetric[];
    severityDistribution: Record<string, number>;
    resultDistribution: Record<string, number>;
  }> {
    const { window, startDate, endDate } = this.resolveTimeRange(params.filter || {});
    const events = await this.getScopedEvents(params.organizationId, startDate, endDate, params.merchantId);

    let successful = 0;
    let failed = 0;
    let denied = 0;
    let critical = 0;
    let high = 0;

    const uniqueActors = new Set<string>();
    const uniqueResources = new Set<string>();
    const uniqueSessions = new Set<string>();
    const uniqueApiKeys = new Set<string>();

    const categoryMap = new Map<AuditCategory, number>();
    const actionMap = new Map<
      string,
      { count: number; success: number; failure: number; denied: number; lastTime: string }
    >();
    const severityMap: Record<string, number> = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const resultMap: Record<string, number> = { SUCCESS: 0, FAILURE: 0, DENIED: 0, PARTIAL: 0 };

    for (const ev of events) {
      // Results
      if (ev.result === 'SUCCESS') successful++;
      else if (ev.result === 'FAILURE') failed++;
      else if (ev.result === 'DENIED') denied++;
      resultMap[ev.result] = (resultMap[ev.result] || 0) + 1;

      // Severity
      if (ev.severity === 'CRITICAL') critical++;
      else if (ev.severity === 'HIGH') high++;
      severityMap[ev.severity] = (severityMap[ev.severity] || 0) + 1;

      // Uniques
      if (ev.actor.id) uniqueActors.add(ev.actor.id);
      if (ev.resource.id) uniqueResources.add(`${ev.resource.type}:${ev.resource.id}`);
      if (ev.sessionId) uniqueSessions.add(ev.sessionId);
      if (ev.actor.type === 'API_KEY' && ev.actor.id) uniqueApiKeys.add(ev.actor.id);

      // Category breakdown
      categoryMap.set(ev.category, (categoryMap.get(ev.category) || 0) + 1);

      // Action breakdown
      const act = actionMap.get(ev.action) || {
        count: 0,
        success: 0,
        failure: 0,
        denied: 0,
        lastTime: ev.occurredAt,
      };
      act.count++;
      if (ev.result === 'SUCCESS') act.success++;
      else if (ev.result === 'FAILURE') act.failure++;
      else if (ev.result === 'DENIED') act.denied++;
      if (new Date(ev.occurredAt) > new Date(act.lastTime)) {
        act.lastTime = ev.occurredAt;
      }
      actionMap.set(ev.action, act);
    }

    const total = events.length;

    const categories: AuditCategoryMetric[] = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topActions: AuditActionMetric[] = Array.from(actionMap.entries())
      .map(([action, stats]) => ({
        action,
        count: stats.count,
        successCount: stats.success,
        failureCount: stats.failure,
        deniedCount: stats.denied,
        lastOccurredAt: stats.lastTime,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    const summary: AuditActivitySummary = {
      organizationId: params.organizationId,
      timeWindow: window,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalEvents: total,
      successfulEvents: successful,
      failedEvents: failed,
      deniedEvents: denied,
      criticalEvents: critical,
      highSeverityEvents: high,
      uniqueActors: uniqueActors.size,
      uniqueResources: uniqueResources.size,
      uniqueSessions: uniqueSessions.size,
      uniqueApiKeys: uniqueApiKeys.size,
    };

    return {
      summary,
      categories,
      topActions,
      severityDistribution: severityMap,
      resultDistribution: resultMap,
    };
  }

  /**
   * Generates bucketed time-series points for volume trend analysis.
   */
  static async getTimeSeries(params: {
    organizationId: string;
    filter?: TimeWindowFilter;
    merchantId?: string;
    bucketSize?: '5m' | '1h' | '1d';
  }): Promise<{
    bucketSize: string;
    points: AuditTimeSeriesPoint[];
  }> {
    const { startDate, endDate } = this.resolveTimeRange(params.filter || {});
    const durationMs = endDate.getTime() - startDate.getTime();

    // Determine optimal bucket interval
    let bucketMs = 24 * 60 * 60 * 1000; // 1 day
    let bucketLabel = '1d';

    if (params.bucketSize === '5m' || durationMs <= 24 * 60 * 60 * 1000) {
      bucketMs = 60 * 60 * 1000; // 1 hour
      bucketLabel = '1h';
    } else if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
      bucketMs = 6 * 60 * 60 * 1000; // 6 hours
      bucketLabel = '6h';
    }

    const events = await this.getScopedEvents(params.organizationId, startDate, endDate, params.merchantId);

    // Initialize buckets
    const bucketMap = new Map<number, AuditTimeSeriesPoint>();
    let currentBucket = Math.floor(startDate.getTime() / bucketMs) * bucketMs;
    const endBucket = Math.floor(endDate.getTime() / bucketMs) * bucketMs;

    while (currentBucket <= endBucket) {
      bucketMap.set(currentBucket, {
        timestamp: new Date(currentBucket).toISOString(),
        eventCount: 0,
        successCount: 0,
        failureCount: 0,
        deniedCount: 0,
      });
      currentBucket += bucketMs;
    }

    // Populate events into buckets
    for (const ev of events) {
      const evTime = new Date(ev.occurredAt).getTime();
      const bKey = Math.floor(evTime / bucketMs) * bucketMs;
      const point = bucketMap.get(bKey);
      if (point) {
        point.eventCount++;
        if (ev.result === 'SUCCESS') point.successCount++;
        else if (ev.result === 'FAILURE') point.failureCount++;
        else if (ev.result === 'DENIED') point.deniedCount++;
      }
    }

    const points = Array.from(bucketMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return { bucketSize: bucketLabel, points };
  }

  /**
   * Generates actor-level analytics and ranking.
   */
  static async getActorAnalytics(params: {
    organizationId: string;
    filter?: TimeWindowFilter;
    limit?: number;
  }): Promise<AuditActorMetric[]> {
    const { startDate, endDate } = this.resolveTimeRange(params.filter || {});
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const events = await this.getScopedEvents(params.organizationId, startDate, endDate);

    const actors = new Map<string, AuditActorMetric>();

    for (const ev of events) {
      const key = ev.actor.id || `anon_${ev.actor.type}`;
      let record = actors.get(key);

      if (!record) {
        record = {
          actorId: ev.actor.id || 'anonymous',
          actorType: ev.actor.type,
          displayName: ev.actor.displayName,
          email: ev.actor.email,
          eventCount: 0,
          successCount: 0,
          failureCount: 0,
          deniedCount: 0,
          highSeverityCount: 0,
          criticalCount: 0,
          lastActivityAt: ev.occurredAt,
        };
        actors.set(key, record);
      }

      record.eventCount++;
      if (ev.result === 'SUCCESS') record.successCount++;
      else if (ev.result === 'FAILURE') record.failureCount++;
      else if (ev.result === 'DENIED') record.deniedCount++;

      if (ev.severity === 'HIGH') record.highSeverityCount++;
      else if (ev.severity === 'CRITICAL') record.criticalCount++;

      if (new Date(ev.occurredAt) > new Date(record.lastActivityAt)) {
        record.lastActivityAt = ev.occurredAt;
      }
    }

    return Array.from(actors.values())
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, limit);
  }

  /**
   * Generates a deep investigative profile for a single actor.
   */
  static async getActorProfile(params: {
    organizationId: string;
    actorId: string;
    limit?: number;
  }): Promise<AuditActorProfile | null> {
    const { organizationId, actorId } = params;
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    const allEvents = await this.getScopedEvents(
      organizationId,
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      new Date()
    );

    const actorEvents = allEvents.filter(e => e.actor.id === actorId);
    if (actorEvents.length === 0) {
      return null;
    }

    // Sort chronologically ascending for first/last
    actorEvents.sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const firstActivityAt = actorEvents[0].occurredAt;
    const lastActivityAt = actorEvents[actorEvents.length - 1].occurredAt;

    const actionMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const resultBreakdown = { success: 0, failure: 0, denied: 0 };
    const resourceMap = new Map<string, { type: string; id: string; eventCount: number }>();

    for (const ev of actorEvents) {
      actionMap[ev.action] = (actionMap[ev.action] || 0) + 1;
      categoryMap[ev.category] = (categoryMap[ev.category] || 0) + 1;

      if (ev.result === 'SUCCESS') resultBreakdown.success++;
      else if (ev.result === 'FAILURE') resultBreakdown.failure++;
      else if (ev.result === 'DENIED') resultBreakdown.denied++;

      const rKey = `${ev.resource.type}:${ev.resource.id}`;
      const rObj = resourceMap.get(rKey) || { type: ev.resource.type, id: ev.resource.id, eventCount: 0 };
      rObj.eventCount++;
      resourceMap.set(rKey, rObj);
    }

    // Recent events descending
    const recent = actorEvents
      .slice()
      .reverse()
      .slice(0, limit)
      .map(e => AuditRedactor.redact(e));

    const first = actorEvents[0];
    return {
      actorId,
      actorType: first.actor.type,
      displayName: first.actor.displayName,
      email: first.actor.email,
      totalEvents: actorEvents.length,
      firstActivityAt,
      lastActivityAt,
      actionBreakdown: actionMap,
      categoryBreakdown: categoryMap,
      resultBreakdown,
      resourcesTouched: Array.from(resourceMap.values()).sort((a, b) => b.eventCount - a.eventCount),
      recentTimeline: recent,
    };
  }

  /**
   * Generates resource-level audit metrics and lifecycle history.
   */
  static async getResourceAnalytics(params: {
    organizationId: string;
    resourceType?: string;
    resourceId?: string;
    filter?: TimeWindowFilter;
    limit?: number;
  }): Promise<AuditResourceMetric[]> {
    const { startDate, endDate } = this.resolveTimeRange(params.filter || {});
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const events = await this.getScopedEvents(params.organizationId, startDate, endDate);

    let filtered = events;
    if (params.resourceType) filtered = filtered.filter(e => e.resource.type === params.resourceType);
    if (params.resourceId) filtered = filtered.filter(e => e.resource.id === params.resourceId);

    const resourceMap = new Map<
      string,
      {
        resourceType: string;
        resourceId: string;
        eventCount: number;
        actors: Set<string>;
        actions: Set<string>;
        firstTime: string;
        lastTime: string;
        failures: number;
        denials: number;
      }
    >();

    for (const ev of filtered) {
      const key = `${ev.resource.type}:${ev.resource.id}`;
      let item = resourceMap.get(key);

      if (!item) {
        item = {
          resourceType: ev.resource.type,
          resourceId: ev.resource.id,
          eventCount: 0,
          actors: new Set<string>(),
          actions: new Set<string>(),
          firstTime: ev.occurredAt,
          lastTime: ev.occurredAt,
          failures: 0,
          denials: 0,
        };
        resourceMap.set(key, item);
      }

      item.eventCount++;
      if (ev.actor.id) item.actors.add(ev.actor.id);
      item.actions.add(ev.action);

      if (ev.result === 'FAILURE') item.failures++;
      else if (ev.result === 'DENIED') item.denials++;

      if (new Date(ev.occurredAt) < new Date(item.firstTime)) item.firstTime = ev.occurredAt;
      if (new Date(ev.occurredAt) > new Date(item.lastTime)) item.lastTime = ev.occurredAt;
    }

    return Array.from(resourceMap.values())
      .map(r => ({
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        eventCount: r.eventCount,
        uniqueActors: r.actors.size,
        actions: Array.from(r.actions),
        firstActivityAt: r.firstTime,
        lastActivityAt: r.lastTime,
        failureCount: r.failures,
        deniedCount: r.denials,
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, limit);
  }

  /**
   * Generates security, authentication, and authorization failure metrics.
   */
  static async getSecurityAnalytics(params: {
    organizationId: string;
    filter?: TimeWindowFilter;
  }): Promise<AuditSecuritySummary> {
    const { startDate, endDate } = this.resolveTimeRange(params.filter || {});
    const events = await this.getScopedEvents(params.organizationId, startDate, endDate);

    let critical = 0;
    let high = 0;
    let secCategory = 0;
    let denials = 0;

    let loginSuccess = 0;
    let loginFailure = 0;
    let mfaSuccess = 0;
    let mfaFailure = 0;
    let pwResetReq = 0;
    let pwResetComp = 0;
    let sessCreated = 0;
    let sessRevoked = 0;
    let logoutAll = 0;
    let ssoLogins = 0;
    let apiKeyEvents = 0;
    let policyChanges = 0;

    for (const ev of events) {
      if (ev.severity === 'CRITICAL') critical++;
      if (ev.severity === 'HIGH') high++;
      if (ev.category === 'SECURITY') secCategory++;
      if (ev.result === 'DENIED') denials++;

      switch (ev.action) {
        case 'AUTH_LOGIN_SUCCESS':
          loginSuccess++;
          break;
        case 'AUTH_LOGIN_FAILURE':
          loginFailure++;
          break;
        case 'AUTH_MFA_CHALLENGE_SUCCESS':
        case 'AUTH_MFA_VERIFIED':
          mfaSuccess++;
          break;
        case 'AUTH_MFA_CHALLENGE_FAILURE':
          mfaFailure++;
          break;
        case 'AUTH_PASSWORD_RESET_REQUESTED':
          pwResetReq++;
          break;
        case 'AUTH_PASSWORD_RESET_COMPLETED':
          pwResetComp++;
          break;
        case 'AUTH_SESSION_CREATED':
          sessCreated++;
          break;
        case 'AUTH_SESSION_REVOKED':
          sessRevoked++;
          break;
        case 'AUTH_LOGOUT_ALL':
        case 'AUTH_SESSION_REVOKED_ALL':
          logoutAll++;
          break;
        case 'AUTH_SSO_LOGIN':
          ssoLogins++;
          break;
        case 'API_KEY_CREATED':
        case 'API_KEY_ROTATED':
        case 'API_KEY_REVOKED':
          apiKeyEvents++;
          break;
        case 'SECURITY_POLICY_CHANGED':
        case 'POLICY_CHANGED':
          policyChanges++;
          break;
      }
    }

    const totalLogins = loginSuccess + loginFailure;
    const authFailureRate = totalLogins > 0 ? Math.round((loginFailure / totalLogins) * 10000) / 10000 : 0;

    const totalMfa = mfaSuccess + mfaFailure;
    const mfaFailureRate = totalMfa > 0 ? Math.round((mfaFailure / totalMfa) * 10000) / 10000 : 0;

    return {
      criticalEvents: critical,
      highSeverityEvents: high,
      securityCategoryEvents: secCategory,
      authorizationDenials: denials,
      authFailureRate,
      loginSuccessCount: loginSuccess,
      loginFailureCount: loginFailure,
      mfaSuccessCount: mfaSuccess,
      mfaFailureCount: mfaFailure,
      mfaFailureRate,
      passwordResetRequests: pwResetReq,
      passwordResetCompletions: pwResetComp,
      sessionCreations: sessCreated,
      sessionRevocations: sessRevoked,
      logoutAllCount: logoutAll,
      ssoLoginCount: ssoLogins,
      apiKeyLifecycleEvents: apiKeyEvents,
      securityPolicyChanges: policyChanges,
    };
  }

  /**
   * Retrieves an investigation timeline correlated by requestId, sessionId, actorId, or resourceId.
   */
  static async getInvestigationTimeline(params: {
    organizationId: string;
    correlationKey: 'requestId' | 'sessionId' | 'actorId' | 'resourceId';
    correlationValue: string;
    limit?: number;
  }): Promise<AuditInvestigationTimeline> {
    const { organizationId, correlationKey, correlationValue } = params;
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    // Retrieve scoped organization events over past 90 days
    const events = await this.getScopedEvents(
      organizationId,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      new Date()
    );

    const correlated = events.filter(e => {
      if (correlationKey === 'requestId') return e.requestId === correlationValue;
      if (correlationKey === 'sessionId') return e.sessionId === correlationValue;
      if (correlationKey === 'actorId') return e.actor.id === correlationValue;
      if (correlationKey === 'resourceId') return e.resource.id === correlationValue;
      return false;
    });

    // Sort chronologically ascending for timeline progression
    correlated.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const scrubbed = correlated.slice(0, limit).map(e => AuditRedactor.redact(e));

    return {
      correlationKey,
      correlationValue,
      totalEvents: correlated.length,
      events: scrubbed,
    };
  }
}

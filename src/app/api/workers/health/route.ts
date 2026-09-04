import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { WorkerMetricsService } from '@/lib/workers/worker-metrics';
import { resolveRequestId } from '@/lib/observability/request-context';

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers.get('x-request-id'));

  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Unauthorized: Worker cluster health restricted to OWNER or ADMIN.',
            requestId,
          },
        },
        {
          status: 403,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    const metrics = await WorkerMetricsService.getOperationalMetrics();
    const overallStatus =
      metrics.workers.offline > 0 && metrics.workers.healthy === 0 ? 'unhealthy' : 'healthy';

    const payload = {
      status: overallStatus,
      workers: {
        active: metrics.workers.totalRegistered,
        healthy: metrics.workers.healthy,
        degraded: metrics.workers.degraded,
        offline: metrics.workers.offline,
      },
      queue: {
        ready: metrics.queue.ready,
        delayed: metrics.queue.delayed,
        deadLetter: metrics.queue.deadLetter,
      },
      timestamp: metrics.timestamp,
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'X-Request-ID': requestId,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Authentication required for worker diagnostics.',
          requestId,
        },
      },
      {
        status: 401,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }
}

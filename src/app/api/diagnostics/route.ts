import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { getRuntimeConfig } from '@/lib/config/runtime';
import { checkDatabaseHealth } from '@/lib/db/prisma';
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
            message: 'Unauthorized: Operational diagnostics restricted to OWNER or ADMIN.',
            requestId,
          },
        },
        {
          status: 403,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    const runtime = getRuntimeConfig();
    const dbHealth = await checkDatabaseHealth();

    const diagnosticsPayload = {
      application: runtime.application,
      database: {
        configured: runtime.database.configured,
        status: dbHealth.status,
        latencyMs: dbHealth.latencyMs,
      },
      razorpay: {
        provider: runtime.razorpay.provider,
        environment: runtime.razorpay.environment,
        status: runtime.razorpay.configured ? 'READY' : 'UNCONFIGURED',
        webhookConfigured: true,
        executionEnabled: runtime.razorpay.executionEnabled,
        keyPrefix: runtime.razorpay.keyPrefix,
      },
      ml: {
        configured: runtime.ml.configured,
      },
      workers: {
        enabled: runtime.workers.enabled,
      },
      observability: {
        logLevel: runtime.observability.logLevel,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(diagnosticsPayload, {
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
          message: err.message || 'Authentication required for diagnostics.',
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

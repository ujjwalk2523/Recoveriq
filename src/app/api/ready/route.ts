import { NextRequest, NextResponse } from 'next/server';
import { validateEnvironmentSafety } from '@/lib/config/environment';
import { checkDatabaseHealth } from '@/lib/db/prisma';
import { resolveRequestId } from '@/lib/observability/request-context';

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers.get('x-request-id'));

  let configStatus: 'ok' | 'failed' = 'ok';
  let dbStatus: 'ok' | 'failed' = 'ok';

  // 1. Verify Configuration Safety
  try {
    validateEnvironmentSafety();
  } catch {
    configStatus = 'failed';
  }

  // 2. Verify Database Connectivity Ping
  try {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.status !== 'ok') {
      dbStatus = 'failed';
    }
  } catch {
    dbStatus = 'failed';
  }

  const isReady = configStatus === 'ok' && dbStatus === 'ok';

  const responsePayload = {
    status: isReady ? 'ready' : 'not_ready',
    checks: {
      configuration: configStatus,
      database: dbStatus,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(responsePayload, {
    status: isReady ? 200 : 503,
    headers: {
      'X-Request-ID': requestId,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

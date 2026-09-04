import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnvironment } from '@/lib/config/environment';
import { APP_VERSION, SERVICE_NAME } from '@/lib/config/version';
import { resolveRequestId } from '@/lib/observability/request-context';

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers.get('x-request-id'));

  const responsePayload = {
    status: 'ok',
    service: SERVICE_NAME,
    environment: getRuntimeEnvironment(),
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'X-Request-ID': requestId,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

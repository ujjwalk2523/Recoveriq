import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { ApiRequestLogger } from '@/lib/api/request-log';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10))) : 20;

    const logs = await ApiRequestLogger.getRecentLogs(session.merchantId, limit);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch API logs' },
      { status: 500 }
    );
  }
}

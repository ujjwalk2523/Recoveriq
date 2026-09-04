import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { AuditService } from '@/lib/services/audit.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const logs = await AuditService.getLogs(session.merchantId);

    return NextResponse.json({
      success: true,
      count: logs.length,
      auditLogs: logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

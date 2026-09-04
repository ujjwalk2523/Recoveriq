import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { DisasterRecoveryService } from '@/lib/reliability/disaster-recovery/disaster-recovery-service';
import { requirePermission } from '@/lib/security/authorization';
import { ApplicationError } from '@/lib/errors/application-error';

export async function POST(req: NextRequest) {
  try {
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    requirePermission(context, 'SECURITY_POLICY_MANAGE');

    const body = await req.json().catch(() => ({}));
    const { backupId, environment } = body;

    if (!backupId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'backupId is required' } },
        { status: 400 }
      );
    }

    const verification = await DisasterRecoveryService.runRestoreVerification({
      backupId,
      organizationId: orgId,
      environment: environment || 'isolated_verification',
    });

    return NextResponse.json({ verification }, { status: 200 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

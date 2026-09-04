import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { RedisRecoveryService } from '@/lib/reliability/recovery/redis-recovery';
import { requirePermission } from '@/lib/security/authorization';
import { AuditRepository } from '@/lib/audit/audit-repository';
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

    // Audit queue rebuild start
    try {
      await AuditRepository.append({
        organizationId: orgId,
        actor: { type: 'USER', id: context.userId || context.principal },
        action: 'REDIS_REBUILD_STARTED',
        category: 'SECURITY',
        severity: 'HIGH',
        result: 'SUCCESS',
        resource: { type: 'QUEUE_ENGINE', id: 'redis_ready_queue' },
        metadata: { triggeredBy: context.userId || context.principal },
      });
    } catch {
      // Non-blocking
    }

    // Execute idempotent reconstruction
    const result = await RedisRecoveryService.reconstructQueuesFromPostgres({
      dryRun: false,
      organizationId: orgId,
    });

    // Audit completion
    try {
      await AuditRepository.append({
        organizationId: orgId,
        actor: { type: 'USER', id: context.userId || context.principal },
        action: 'REDIS_REBUILD_COMPLETED',
        category: 'SECURITY',
        severity: 'INFO',
        result: 'SUCCESS',
        resource: { type: 'QUEUE_ENGINE', id: 'redis_ready_queue' },
        metadata: {
          rebuiltCount: result.rebuiltCount,
          skippedTerminalCount: result.skippedTerminalCount,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ result }, { status: 200 });
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

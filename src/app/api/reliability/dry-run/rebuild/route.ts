import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { QueueRebuildService } from '@/lib/reliability/recovery/queue-rebuild';
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

    // Dry-run queue reconstruction: never mutates Redis or schedules executions
    const dryRunResult = await QueueRebuildService.rebuildQueues({
      dryRun: true,
      organizationId: orgId,
    });

    return NextResponse.json(
      {
        dryRunResult,
        disclaimer: 'Dry-run calculation only; zero queues or jobs were modified in Redis.',
      },
      { status: 200 }
    );
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

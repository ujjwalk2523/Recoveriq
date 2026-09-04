import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { ReconciliationService } from '@/lib/reliability/reconciliation/reconciliation-service';
import { requirePermission } from '@/lib/security/authorization';
import { ApplicationError } from '@/lib/errors/application-error';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { resolution, notes, providerReference } = body;

    // If manual resolution requested
    if (resolution) {
      const resolved = ReconciliationService.resolveManualReview(
        id,
        resolution,
        context.userId || context.principal,
        notes || 'Resolved via reliability administration console'
      );

      if (!resolved) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `Transaction '${id}' not found in manual review queue` } },
          { status: 404 }
        );
      }

      return NextResponse.json({ result: resolved }, { status: 200 });
    }

    // Default: run automated reconciliation check against provider
    const result = await ReconciliationService.reconcileTransaction({
      transactionId: id,
      merchantId: orgId,
      providerReference,
    });

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

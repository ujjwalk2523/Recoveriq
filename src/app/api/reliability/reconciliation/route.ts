import { NextRequest, NextResponse } from 'next/server';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { ReconciliationService } from '@/lib/reliability/reconciliation/reconciliation-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest) {
  try {
    const context = await resolveSecurityContext(req);
    const orgId = context.organizationId || context.merchantId;

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const manualReviewQueue = ReconciliationService.getManualReviewQueue();
    const webhookGaps = await ReconciliationService.detectWebhookGaps(15);

    return NextResponse.json(
      {
        reconciliation: {
          manualReviewQueue,
          webhookGaps,
          totalPending: manualReviewQueue.length + webhookGaps.length,
        },
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

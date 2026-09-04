import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SsoService } from '@/lib/identity/sso-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTenantContext(req);
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const orgId = session.organizationId || session.merchantId;
  const idp = await SsoService.getIdentityProvider(orgId);

  if (!idp) {
    return NextResponse.json({ success: false, error: 'Identity Provider not found' }, { status: 404 });
  }

  const testResult = await SsoService.testIdentityProvider(idp);

  return NextResponse.json({
    success: testResult.valid,
    message: testResult.message,
  });
}

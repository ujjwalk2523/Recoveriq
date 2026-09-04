import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SsoService } from '@/lib/identity/sso-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTenantContext(req);
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id: domainId } = await params;
  const orgId = session.organizationId || session.merchantId;

  const result = await SsoService.verifyDomain(orgId, domainId);
  if (!result.verified) {
    return NextResponse.json({ success: false, error: result.error || 'Domain verification failed.' }, { status: 400 });
  }

  await SecurityEventService.recordSecurityEvent({
    merchantId: session.merchantId || orgId,
    actorId: session.userId,
    actorType: 'USER',
    action: 'AUTH_DOMAIN_VERIFIED' as any,
    entityType: 'ORGANIZATION_DOMAIN',
    entityId: domainId,
    details: { domain: result.domain?.domain },
  });

  return NextResponse.json({
    success: true,
    message: `Domain ${result.domain?.domain} verified successfully.`,
    domain: result.domain,
  });
}

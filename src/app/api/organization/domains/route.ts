import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SsoService } from '@/lib/identity/sso-service';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const session = await getTenantContext(req);
  const orgId = session.organizationId || session.merchantId;

  let domains: any[] = [];
  try {
    domains = await prisma.organizationDomain.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    // fallback
  }

  return NextResponse.json({
    success: true,
    domains,
  });
}

export async function POST(req: NextRequest) {
  const session = await getTenantContext(req);
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const orgId = session.organizationId || session.merchantId;

  try {
    const body = await req.json().catch(() => ({}));
    const rawDomain = typeof body.domain === 'string' ? body.domain : '';

    if (!rawDomain) {
      return NextResponse.json({ success: false, error: 'Domain name is required.' }, { status: 400 });
    }

    const domain = await SsoService.addDomain(orgId, rawDomain);

    return NextResponse.json({
      success: true,
      domain,
      verificationRecord: {
        type: 'TXT',
        host: '@',
        value: `recoveriq-verification=${domain.verificationTokenHash.substring(0, 32)}`,
      },
      message: 'Domain added. Please add the DNS TXT record and click Verify.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to add domain.' }, { status: 400 });
  }
}

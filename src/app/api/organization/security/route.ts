import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SsoService } from '@/lib/identity/sso-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function GET(req: NextRequest) {
  const session = await getTenantContext(req);
  const orgId = session.organizationId || session.merchantId;

  const idp = await SsoService.getIdentityProvider(orgId);

  return NextResponse.json({
    success: true,
    securitySettings: {
      organizationId: orgId,
      ssoConfigured: Boolean(idp),
      enforceSso: idp?.enforceSso ?? false,
      jitEnabled: idp?.jitEnabled ?? false,
      allowedDomains: idp?.allowedDomains ?? [],
      defaultRole: idp?.defaultRole ?? 'OPERATOR',
      enforceMfa: false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getTenantContext(req);
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Only organization OWNER or ADMIN can update security settings.' }, { status: 403 });
  }

  // Step-up authentication check
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  const orgId = session.organizationId || session.merchantId;

  try {
    const body = await req.json().catch(() => ({}));
    const { enforceSso, jitEnabled, defaultRole } = body;

    const idp = await SsoService.getIdentityProvider(orgId);
    if (!idp && enforceSso) {
      return NextResponse.json(
        { success: false, error: 'Cannot enforce SSO without an active Identity Provider configured.' },
        { status: 400 }
      );
    }

    if (idp) {
      await SsoService.configureIdentityProvider(orgId, {
        providerType: idp.providerType,
        issuer: idp.issuer,
        clientId: idp.clientId,
        allowedDomains: (idp.allowedDomains as string[]) || [],
        enforceSso: enforceSso !== undefined ? enforceSso : idp.enforceSso,
        jitEnabled: jitEnabled !== undefined ? jitEnabled : idp.jitEnabled,
        defaultRole: defaultRole || idp.defaultRole,
      });
    }

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || orgId,
      actorId: session.userId,
      actorType: 'USER',
      action: 'SECURITY_SETTING_CHANGED',
      entityType: 'ORGANIZATION',
      entityId: orgId,
      details: { enforceSso, jitEnabled, defaultRole },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization security settings updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to update security settings.' }, { status: 400 });
  }
}

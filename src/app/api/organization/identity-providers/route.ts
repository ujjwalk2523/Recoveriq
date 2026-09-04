import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { SsoService } from '@/lib/identity/sso-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function GET(req: NextRequest) {
  const session = await getTenantContext(req);
  const orgId = session.organizationId || session.merchantId;

  const idp = await SsoService.getIdentityProvider(orgId);

  // Redact encrypted secret in response
  const sanitizedIdp = idp
    ? {
        ...idp,
        encryptedClientSecret: undefined,
        clientSecretIv: undefined,
        clientSecretTag: undefined,
        hasClientSecret: Boolean(idp.encryptedClientSecret),
      }
    : null;

  return NextResponse.json({
    success: true,
    identityProvider: sanitizedIdp,
  });
}

export async function POST(req: NextRequest) {
  const session = await getTenantContext(req);
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Only organization OWNER or ADMIN can configure SSO.' }, { status: 403 });
  }

  // Require recent authentication for configuring IdP
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  const orgId = session.organizationId || session.merchantId;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      providerType = 'OIDC',
      issuer,
      clientId,
      clientSecret,
      authorizationEndpoint,
      tokenEndpoint,
      userinfoEndpoint,
      jwksUri,
      allowedDomains = [],
      enforceSso = false,
      jitEnabled = false,
      defaultRole = 'OPERATOR',
    } = body;

    if (!issuer || !clientId) {
      return NextResponse.json({ success: false, error: 'Issuer and Client ID are required.' }, { status: 400 });
    }

    const idp = await SsoService.configureIdentityProvider(orgId, {
      providerType,
      issuer,
      clientId,
      clientSecret,
      authorizationEndpoint,
      tokenEndpoint,
      userinfoEndpoint,
      jwksUri,
      allowedDomains,
      enforceSso,
      jitEnabled,
      defaultRole,
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || orgId,
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_SSO_CONFIGURATION_CHANGED' as any,
      entityType: 'ORGANIZATION',
      entityId: orgId,
      details: { issuer, clientId, providerType, enforceSso, jitEnabled },
    });

    return NextResponse.json({
      success: true,
      message: 'Identity Provider configured successfully.',
      identityProvider: {
        id: idp.id,
        providerType: idp.providerType,
        issuer: idp.issuer,
        clientId: idp.clientId,
        allowedDomains: idp.allowedDomains,
        enforceSso: idp.enforceSso,
        jitEnabled: idp.jitEnabled,
        defaultRole: idp.defaultRole,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to configure Identity Provider.' }, { status: 400 });
  }
}

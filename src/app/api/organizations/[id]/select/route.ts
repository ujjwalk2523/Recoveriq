import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { verifyCsrf } from '@/lib/security/csrf';
import { OrganizationService } from '@/lib/organization/organization-service';
import { MemberService } from '@/lib/organization/member-service';
import { ApplicationError } from '@/lib/errors/application-error';
import { AuditService } from '@/lib/services/audit.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyCsrf(req);
    const session = await getTenantContext(req, true);
    const { id: targetOrgId } = await params;

    // 1. Verify organization exists and is ACTIVE
    const org = await OrganizationService.getOrganizationById(targetOrgId);
    if (!org || org.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: 'Organization is not active or does not exist.',
        statusCode: 400,
        safeMessage: 'Cannot switch to an inactive organization.',
      });
    }

    // 2. Verify user has active membership in target organization
    const member = await MemberService.getMember(targetOrgId, session.userId);
    if (!member || member.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'NOT_A_MEMBER',
        message: `User '${session.userId}' is not an active member of organization '${targetOrgId}'.`,
        statusCode: 403,
        safeMessage: 'You are not an active member of this organization.',
      });
    }

    // 3. Create updated session with target organization context and member's role in that organization
    const updatedSession = {
      ...session,
      role: member.role, // role is strictly derived from target organization membership
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
      lastActiveAt: Date.now(),
    };

    const newSessionToken = signSessionToken(updatedSession);

    await AuditService.logEvent({
      merchantId: org.id,
      actorType: 'USER',
      actorName: session.userId,
      action: 'ORGANIZATION_SWITCHED',
      entityType: 'ORGANIZATION',
      entityId: org.id,
      details: `User ${session.email} switched active context to organization '${org.name}'.`,
    });

    const res = NextResponse.json({
      success: true,
      activeOrganization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: member.role,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, newSessionToken, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

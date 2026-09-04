import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { verifyCsrf } from '@/lib/security/csrf';
import { OrganizationService } from '@/lib/organization/organization-service';
import { MemberService } from '@/lib/organization/member-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    // Return organizations where the user is a member
    const allMembers = await MemberService.listMembers(session.organizationId || session.merchantId);
    const org = await OrganizationService.getOrganizationById(session.organizationId || session.merchantId);

    const organizations = org ? [org] : [];
    return NextResponse.json({
      organizations,
      activeOrganizationId: session.organizationId || session.merchantId,
    });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const session = await getTenantContext(req, true); // strict in production
    const body = await req.json();

    const { name, slug } = body;
    const org = await OrganizationService.createOrganization({
      name,
      slug,
      createdBy: session.userId,
      actorRole: session.role,
    });

    // Add creating user as the initial OWNER of the new organization
    const { IN_MEMORY_MEMBERS } = await import('@/lib/organization/member-service');
    IN_MEMORY_MEMBERS.push({
      id: `mem_${Date.now()}`,
      organizationId: org.id,
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, organization: org }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

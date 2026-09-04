import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { verifyCsrf } from '@/lib/security/csrf';
import { resolveSecurityContext } from '@/lib/security/security-context';
import { requireOrganizationAccess, requirePermission, requireOwner } from '@/lib/security/authorization';
import { OrganizationService } from '@/lib/organization/organization-service';
import { ApplicationError } from '@/lib/errors/application-error';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'ORGANIZATION_VIEW');

    const org = await OrganizationService.getOrganizationById(id);
    if (!org) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Organization not found' } }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requirePermission(context, 'ORGANIZATION_UPDATE');

    const body = await req.json();
    const updated = await OrganizationService.updateOrganization(id, body, context.userId || 'SYSTEM');

    return NextResponse.json({ success: true, organization: updated });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    verifyCsrf(req);
    const context = await resolveSecurityContext(req);
    requireOrganizationAccess(context, id);
    requireOwner(context); // Only OWNER can delete/suspend organization

    const deleted = await OrganizationService.deleteOrganization(id, context.userId || 'SYSTEM');
    return NextResponse.json({ success: true, organization: deleted });
  } catch (err: any) {
    if (err instanceof ApplicationError) {
      return NextResponse.json(err.toSafeResponse(), { status: err.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

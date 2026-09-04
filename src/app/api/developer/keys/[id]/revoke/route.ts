import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { ApiKeyService } from '@/lib/api/auth/api-key-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantContext(req);

    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only OWNER or ADMIN may revoke API keys.' },
        { status: 403 }
      );
    }

    const { id: keyId } = await params;
    const revokedKey = await ApiKeyService.revokeApiKey(
      keyId,
      session.merchantId,
      session.email || session.role
    );

    return NextResponse.json({
      success: true,
      apiKey: revokedKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

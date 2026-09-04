import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, canModifyPolicies } from '@/lib/auth/tenant';
import { ApiKeyService } from '@/lib/api/auth/api-key-service';
import { ApiKeyEnvironment } from '@prisma/client';
import { ALL_API_SCOPES, ApiScope } from '@/lib/api/scopes';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    const keys = await ApiKeyService.listApiKeys(session.merchantId);

    return NextResponse.json({
      success: true,
      keys,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantContext(req);

    // RBAC: Only OWNER and ADMIN may create keys
    if (!canModifyPolicies(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only OWNER or ADMIN may create API keys.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, environment = 'TEST', scopes = [] } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API key name is required.' },
        { status: 400 }
      );
    }

    // Validate environment
    const targetEnv =
      environment === 'LIVE' ? ApiKeyEnvironment.LIVE : ApiKeyEnvironment.TEST;

    // Validate scopes
    const validScopes: ApiScope[] = (scopes as string[]).filter((s) =>
      ALL_API_SCOPES.includes(s as ApiScope)
    ) as ApiScope[];

    if (validScopes.length === 0) {
      // Default to read-only basic scopes if none provided
      validScopes.push(ApiScope.TRANSACTIONS_READ, ApiScope.RECOVERY_READ);
    }

    const result = await ApiKeyService.createApiKey({
      merchantId: session.merchantId,
      name: name.trim(),
      environment: targetEnv,
      scopes: validScopes,
      createdBy: session.email || session.role,
    });

    return NextResponse.json({
      success: true,
      apiKey: result.apiKey,
      rawSecret: result.rawSecret, // ONLY time rawSecret is ever returned
      warning: 'Store this secret securely. It will never be shown again.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create API key' },
      { status: 500 }
    );
  }
}

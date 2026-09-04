import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/tenant';

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantContext(req);
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
      merchant: {
        id: session.merchantId,
        name: session.merchantName,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

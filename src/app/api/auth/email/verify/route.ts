import { NextRequest, NextResponse } from 'next/server';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ success: false, error: 'Verification token is required.' }, { status: 400 });
    }

    const result = await AccountRecoveryService.verifyEmail(token);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (result.userId) {
      await SecurityEventService.recordSecurityEvent({
        merchantId: 'system',
        actorId: result.userId,
        actorType: 'USER',
        action: 'AUTH_EMAIL_VERIFIED' as any,
        entityType: 'AUTH',
        entityId: result.userId,
        details: { verifiedAt: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You may now access all platform features.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Verification failed.' }, { status: 400 });
  }
}

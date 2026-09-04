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

    const result = await AccountRecoveryService.verifyEmailChange(token);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await SecurityEventService.recordSecurityEvent({
      merchantId: 'system',
      actorId: 'system',
      actorType: 'USER',
      action: 'AUTH_EMAIL_CHANGE_COMPLETED' as any,
      entityType: 'AUTH',
      entityId: result.newEmail || 'unknown',
      details: { newEmail: result.newEmail },
    });

    return NextResponse.json({
      success: true,
      message: 'Email address updated successfully.',
      newEmail: result.newEmail,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Verification failed.' }, { status: 400 });
  }
}

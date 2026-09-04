import { NextRequest, NextResponse } from 'next/server';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!token || !newPassword) {
      return NextResponse.json({ success: false, error: 'Token and new password are required.' }, { status: 400 });
    }

    // Rate limit password reset attempts per IP
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`reset:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const result = await AccountRecoveryService.resetPassword(token, newPassword);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new credentials.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Password reset failed.' }, { status: 400 });
  }
}

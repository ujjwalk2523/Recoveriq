import { NextRequest, NextResponse } from 'next/server';
import { UserIdentityService } from '@/lib/identity/user-identity-service';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';
import { sanitizePlainText } from '@/lib/security/input-security';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? sanitizePlainText(body.email, 120) : '';

    if (!rawEmail) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    const email = UserIdentityService.normalizeEmail(rawEmail);

    // Rate limiting
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`resend:${ip}:${email}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another email.` },
        { status: 429 }
      );
    }

    const user = await UserIdentityService.getUserByEmail(email);
    if (user && !user.emailVerifiedAt) {
      await AccountRecoveryService.sendEmailVerification(user.id, user.email);
    }

    return NextResponse.json({
      success: true,
      message: 'If the account exists and is unverified, a verification email has been resent.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Failed to resend verification email.' }, { status: 500 });
  }
}

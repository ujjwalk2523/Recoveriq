import { NextRequest, NextResponse } from 'next/server';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';
import { sanitizePlainText } from '@/lib/security/input-security';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? sanitizePlainText(body.email, 120) : '';

    if (!rawEmail) {
      return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
    }

    // Rate limiting
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`forgot:${ip}:${rawEmail}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    // Non-enumerating generic response
    const result = await AccountRecoveryService.requestPasswordReset(rawEmail);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: true, message: 'If an account exists with this email address, a password reset link has been sent.' }
    );
  }
}

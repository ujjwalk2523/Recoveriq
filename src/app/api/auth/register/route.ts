import { NextRequest, NextResponse } from 'next/server';
import { UserIdentityService } from '@/lib/identity/user-identity-service';
import { PasswordPolicyService } from '@/lib/identity/password-policy-service';
import { AccountRecoveryService } from '@/lib/identity/account-recovery-service';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';
import { SecurityEventService } from '@/lib/security/security-events';
import { sanitizePlainText } from '@/lib/security/input-security';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? sanitizePlainText(body.email, 120) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? sanitizePlainText(body.displayName, 80) : undefined;

    if (!rawEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Rate limiting for registrations
    const rateLimit = await SecurityRateLimiter.checkLoginAttempt(`reg:${ip}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many registration attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    // Validate password policy
    const policyResult = PasswordPolicyService.validatePassword(password);
    if (!policyResult.valid) {
      return NextResponse.json(
        { success: false, error: policyResult.errors.join(' ') },
        { status: 400 }
      );
    }

    // Create user identity
    const { user } = await UserIdentityService.createUser({
      email: rawEmail,
      password,
      displayName,
      emailVerified: false,
    });

    // Send verification email
    await AccountRecoveryService.sendEmailVerification(user.id, user.email);

    await SecurityEventService.recordSecurityEvent({
      merchantId: 'system',
      actorId: user.id,
      actorType: 'USER',
      action: 'AUTH_LOGIN_SUCCESS' as any,
      entityType: 'USER',
      entityId: user.id,
      details: { email: user.emailNormalized, event: 'REGISTER' },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create account.' },
      { status: 400 }
    );
  }
}

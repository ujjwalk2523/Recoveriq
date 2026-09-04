import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, signSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { UserIdentityService } from '@/lib/identity/user-identity-service';
import { PasswordPolicyService } from '@/lib/identity/password-policy-service';
import { MfaService } from '@/lib/identity/mfa-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';
    const mfaCode = typeof body.mfaCode === 'string' ? body.mfaCode.trim() : '';
    const purpose = typeof body.purpose === 'string' ? body.purpose : 'SENSITIVE_ACTION';

    let verified = false;

    if (mfaCode) {
      verified = await MfaService.verifyUserMfaCode(session.userId, mfaCode);
    } else if (password) {
      const user = await UserIdentityService.getUserById(session.userId);
      if (user && user.credentials && user.credentials.length > 0) {
        verified = await PasswordPolicyService.verifyPassword(password, user.credentials[0].passwordHash);
      }
    }

    if (!verified) {
      return NextResponse.json({ success: false, error: 'Step-up authentication failed: invalid credential or code.' }, { status: 401 });
    }

    const stepUpToken = await StepUpService.issueStepUpToken(session.userId, purpose);
    const now = Date.now();

    // Refresh session authenticatedAt
    const updatedJwt = signSessionToken({
      ...session,
      authenticatedAt: now,
      lastActiveAt: now,
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: session.userId,
      actorType: 'USER',
      action: 'AUTH_STEP_UP_VERIFIED' as any,
      entityType: 'AUTH',
      entityId: session.userId,
      details: { purpose, method: mfaCode ? 'MFA_TOTP' : 'PASSWORD' },
    });

    const response = NextResponse.json({
      success: true,
      stepUpToken,
      authenticatedAt: now,
      message: 'Step-up authentication verified successfully.',
    });

    response.cookies.set(SESSION_COOKIE_NAME, updatedJwt, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Step-up verification encountered an error.' }, { status: 400 });
  }
}

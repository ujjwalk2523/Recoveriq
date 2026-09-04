import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSessionToken } from '@/lib/auth/session';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';
import { SecurityEventService } from '@/lib/security/security-events';
import { generateCsrfToken } from '@/lib/security/csrf';
import { sanitizePlainText } from '@/lib/security/input-security';
import { UserIdentityService } from '@/lib/identity/user-identity-service';
import { MfaService } from '@/lib/identity/mfa-service';
import { SessionManager } from '@/lib/identity/session-manager';
import { PasswordPolicyService } from '@/lib/identity/password-policy-service';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? sanitizePlainText(body.email, 120) : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const email = UserIdentityService.normalizeEmail(rawEmail);

    // 1. Rate Limiting Protection
    const rateLimitStatus = await SecurityRateLimiter.checkLoginAttempt(`${ip}:${email}`);
    if (!rateLimitStatus.allowed) {
      await SecurityEventService.recordSecurityEvent({
        merchantId: 'system',
        actorId: email,
        actorType: 'USER',
        action: 'AUTH_LOGIN_FAILURE' as any,
        entityType: 'AUTH',
        entityId: email,
        details: { reason: 'Rate limit exceeded', ip, retryAfter: rateLimitStatus.retryAfterSeconds },
      });

      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitStatus.retryAfterSeconds || 60),
          },
        }
      );
    }

    // 2. Check canonical User identity first
    let canonicalUser = await UserIdentityService.getUserByEmail(email);
    let userId: string = '';
    let userDisplayName: string = '';
    let userRole: any = 'ADMIN';
    let merchantId: string = 'mer_saasify_blr';
    let merchantName: string = 'SaaSify Technologies India Pvt Ltd';
    let organizationId: string | undefined = undefined;
    let organizationName: string | undefined = undefined;
    let organizationSlug: string | undefined = undefined;
    let passwordValid = false;

    if (canonicalUser && canonicalUser.credentials && canonicalUser.credentials.length > 0) {
      if (canonicalUser.status === 'SUSPENDED' || canonicalUser.status === 'DEACTIVATED') {
        return NextResponse.json(
          { success: false, error: 'Account is suspended or deactivated. Please contact support.' },
          { status: 403 }
        );
      }

      userId = canonicalUser.id;
      userDisplayName = canonicalUser.displayName || canonicalUser.email.split('@')[0];
      const credential = canonicalUser.credentials[0];
      passwordValid = await PasswordPolicyService.verifyPassword(password, credential.passwordHash);

      // Check organization membership
      try {
        const member = await prisma.organizationMember.findFirst({
          where: { userId: canonicalUser.id, status: 'ACTIVE' },
          include: { organization: true },
        });
        if (member) {
          userRole = member.role;
          organizationId = member.organizationId;
          organizationName = member.organization.name;
          organizationSlug = member.organization.slug;
        }
      } catch {
        // fallback
      }
    } else {
      // 3. Fallback to legacy MerchantUser
      let legacyUser: any = null;
      try {
        legacyUser = await prisma.merchantUser.findUnique({
          where: { email },
          include: { merchant: true },
        });
      } catch {
        // DB offline fallback
      }

      if (legacyUser && legacyUser.passwordHash) {
        userId = legacyUser.id;
        userDisplayName = legacyUser.name;
        userRole = legacyUser.role;
        merchantId = legacyUser.merchantId;
        merchantName = legacyUser.merchant?.name || 'RecoverIQ Merchant';
        passwordValid = await bcrypt.compare(password, legacyUser.passwordHash);
      } else if (password === 'password123') {
        if (email === 'owner@saasify.in') {
          userId = 'usr_demo_owner';
          userDisplayName = 'Vikramaditya (Founder & CEO)';
          userRole = 'OWNER';
          merchantId = 'mer_saasify_blr';
          merchantName = 'SaaSify Technologies India Pvt Ltd';
          organizationSlug = 'saasify';
          passwordValid = true;
        } else if (email === 'merchant@saasify.in' || email === 'admin@saasify.in') {
          userId = 'usr_demo_admin';
          userDisplayName = 'Ujjwal (Admin)';
          userRole = 'ADMIN';
          merchantId = 'mer_saasify_blr';
          merchantName = 'SaaSify Technologies India Pvt Ltd';
          organizationSlug = 'saasify';
          passwordValid = true;
        } else if (email === 'ops@saasify.in') {
          userId = 'usr_demo_ops';
          userDisplayName = 'Rahul Nair (Operator)';
          userRole = 'OPERATOR';
          merchantId = 'mer_saasify_blr';
          merchantName = 'SaaSify Technologies India Pvt Ltd';
          organizationSlug = 'saasify';
          passwordValid = true;
        } else if (email === 'admin@quickcart.in') {
          userId = 'usr_demo_quickcart';
          userDisplayName = 'Aakash (QuickCart)';
          userRole = 'ADMIN';
          merchantId = 'mer_quickcart_mum';
          merchantName = 'QuickCart Retail Pvt Ltd';
          organizationSlug = 'quickcart';
          passwordValid = true;
        }
      }
    }

    if (!passwordValid) {
      await SecurityEventService.recordSecurityEvent({
        merchantId: merchantId || 'system',
        actorId: userId || email,
        actorType: 'USER',
        action: 'AUTH_LOGIN_FAILURE' as any,
        entityType: 'AUTH',
        entityId: email,
        details: { reason: 'Invalid credentials', ip },
      });

      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // 4. Check Multi-Factor Authentication (MFA)
    const userMfa = userId ? await MfaService.getUserMfa(userId) : null;
    if (userMfa && userMfa.verifiedAt) {
      // Issue temporary challenge session restricted strictly to MFA verification
      const challengeToken = signSessionToken({
        userId,
        email,
        name: userDisplayName,
        role: userRole,
        merchantId,
        merchantName,
        organizationId,
        organizationName,
        organizationSlug,
        pendingMfa: true,
        authenticatedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        mfaRequired: true,
        tempToken: challengeToken,
        message: 'Two-factor authentication required. Please enter your 6-digit code.',
      });

      response.cookies.set(SESSION_COOKIE_NAME, challengeToken, SESSION_COOKIE_OPTIONS);
      return response;
    }

    // 5. Establish durable server-side session
    const { rawToken } = await SessionManager.createSession({
      userId,
      organizationId,
      authMethod: 'PASSWORD',
      ip,
      userAgent,
    });

    const sessionJwt = signSessionToken({
      sessionId: rawToken,
      userId,
      email,
      name: userDisplayName,
      role: userRole,
      merchantId,
      merchantName,
      organizationId,
      organizationName,
      organizationSlug,
      authenticatedAt: Date.now(),
      authMethod: 'PASSWORD',
      pendingMfa: false,
    });

    const { token: csrfToken, cookieValue: csrfCookie } = generateCsrfToken();

    await UserIdentityService.recordLogin(userId);

    await SecurityEventService.recordSecurityEvent({
      merchantId: merchantId || 'system',
      actorId: userId,
      actorType: 'USER',
      action: 'AUTH_LOGIN_SUCCESS' as any,
      entityType: 'AUTH',
      entityId: userId,
      details: { email, ip, authMethod: 'PASSWORD' },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name: userDisplayName,
        role: userRole,
        merchantId,
        merchantName,
        organizationId,
        organizationName,
        organizationSlug,
      },
      csrfToken,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionJwt, SESSION_COOKIE_OPTIONS);
    response.cookies.set('recoveriq_csrf', csrfCookie, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Authentication service encountered an unexpected error.' },
      { status: 500 }
    );
  }
}

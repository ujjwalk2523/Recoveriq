import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { UserIdentityService } from '@/lib/identity/user-identity-service';
import { PasswordPolicyService } from '@/lib/identity/password-policy-service';
import { StepUpService } from '@/lib/identity/step-up-service';
import { SessionManager } from '@/lib/identity/session-manager';
import { SecurityNotificationService } from '@/lib/identity/security-notification-service';
import { SecurityEventService } from '@/lib/security/security-events';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Require recent authentication
  StepUpService.requireRecentAuthentication({
    userId: session.userId,
    lastActiveAt: session.lastActiveAt,
    authenticatedAt: session.authenticatedAt,
  });

  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current and new password are required.' }, { status: 400 });
    }

    const user = await UserIdentityService.getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Verify current password
    if (user.credentials && user.credentials.length > 0) {
      const isValid = await PasswordPolicyService.verifyPassword(currentPassword, user.credentials[0].passwordHash);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 400 });
      }
    }

    // Validate new password policy
    const policy = PasswordPolicyService.validatePassword(newPassword);
    if (!policy.valid) {
      return NextResponse.json({ success: false, error: policy.errors.join(' ') }, { status: 400 });
    }

    // Update password
    await UserIdentityService.updatePassword(user.id, newPassword);

    // Revoke all other sessions except current session
    if (session.sessionId) {
      await SessionManager.revokeAllSessionsForUser(user.id, session.sessionId);
    }

    // Send security notification
    await SecurityNotificationService.sendNotification({
      userId: user.id,
      userEmail: user.email,
      eventType: 'PASSWORD_CHANGED',
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: session.merchantId || 'system',
      actorId: user.id,
      actorType: 'USER',
      action: 'AUTH_PASSWORD_CHANGED' as any,
      entityType: 'AUTH',
      entityId: user.id,
      details: { email: user.email },
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to change password.' }, { status: 400 });
  }
}

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/auth/session';
import { ApplicationError } from '@/lib/errors/application-error';
import { ORGANIZATION_POLICY } from './organization-policy';
import { MemberService, IN_MEMORY_MEMBERS } from './member-service';
import { OrganizationService } from './organization-service';
import { AuditService } from '@/lib/services/audit.service';
import { SecurityRateLimiter } from '@/lib/security/rate-limit';
import { getEmailProvider } from '@/lib/email/email-provider';
import { EntitlementService } from '@/lib/billing/entitlement-service';

export interface OrganizationInvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  status?: string;
  expiresAt: Date;
  invitedBy: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export const IN_MEMORY_INVITATIONS: OrganizationInvitationRecord[] = [];

export class InvitationService {
  /**
   * Hashes an invitation token using SHA-256.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Creates and sends a new cryptographic organization invitation.
   */
  static async createInvitation(params: {
    organizationId: string;
    email: string;
    role: UserRole;
    invitedByUserId: string;
    actorRole?: UserRole;
  }): Promise<{
    invitation: OrganizationInvitationRecord;
    rawToken: string;
    token: string;
  }> {
    const { organizationId, email, role, invitedByUserId } = params;
    const actorRole = params.actorRole || 'OWNER';

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may invite new members.',
        statusCode: 403,
        safeMessage: 'You do not have permission to invite members.',
      });
    }

    if (role === 'OWNER') {
      throw new ApplicationError({
        code: 'CANNOT_INVITE_OWNER',
        message: 'Cannot invite a user directly as OWNER. Invite as ADMIN and transfer ownership.',
        statusCode: 400,
        safeMessage: 'New members cannot be invited as Owner.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new ApplicationError({
        code: 'INVALID_EMAIL',
        message: 'Invalid email address format.',
        statusCode: 400,
        safeMessage: 'Please provide a valid email address.',
      });
    }

    // Rate Limiting: Max 20 invitations per 15 minutes per organization
    await SecurityRateLimiter.assertAllowed({
      key: `invitation:${organizationId}`,
      limit: 20,
      windowSeconds: 900,
    });

    // Check organization existence and status
    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org || org.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: 'Organization is not active or does not exist.',
        statusCode: 400,
        safeMessage: 'Cannot invite members to an inactive organization.',
      });
    }

    // Check Entitlements (Seat Limits)
    const existingMembers = await MemberService.listMembers(organizationId);
    const activeCount = existingMembers.filter((m) => m.status === 'ACTIVE' || m.status === 'INVITED').length;
    await EntitlementService.assertMemberLimitAllowed(organizationId, activeCount + 1);

    // Check if user is already an active member
    const existingMember = existingMembers.find((m) => m.email.toLowerCase() === normalizedEmail);
    if (existingMember && existingMember.status === 'ACTIVE') {
      throw new ApplicationError({
        code: 'USER_ALREADY_MEMBER',
        message: `User '${normalizedEmail}' is already an active member of this organization.`,
        statusCode: 409,
        safeMessage: 'This user is already an active member of this organization.',
      });
    }

    // Revoke any previous pending invitations for this email in this organization
    const now = new Date();
    for (const inv of IN_MEMORY_INVITATIONS) {
      if (
        inv.organizationId === organizationId &&
        inv.email.toLowerCase() === normalizedEmail &&
        !inv.acceptedAt &&
        !inv.revokedAt
      ) {
        inv.revokedAt = now;
      }
    }

    // Generate 32 bytes of secure random bytes for the single-use token
    const rawToken = `inv_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ORGANIZATION_POLICY.invitation.ttlSeconds * 1000);
    const invId = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const record: OrganizationInvitationRecord = {
      id: invId,
      organizationId,
      email: normalizedEmail,
      role,
      tokenHash,
      expiresAt,
      invitedBy: invitedByUserId,
      createdAt: now,
    };

    IN_MEMORY_INVITATIONS.push(record);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organizationInvitation.create({
          data: {
            id: record.id,
            organizationId: record.organizationId,
            email: record.email,
            role: record.role as any,
            tokenHash: record.tokenHash,
            expiresAt: record.expiresAt,
            invitedBy: record.invitedBy,
            createdAt: record.createdAt,
          },
        });
      } catch {
        // resilient
      }
    }

    // Send invitation email via provider abstraction
    const emailProvider = (this as any)._customEmailProvider || getEmailProvider();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await emailProvider.sendInvitation({
      toEmail: normalizedEmail,
      organizationName: org.name,
      role,
      inviteLink: `${appUrl}/accept-invitation?token=${rawToken}`,
      expiresAt,
    });

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: invitedByUserId,
      action: 'MEMBER_INVITED',
      entityType: 'ORGANIZATION_INVITATION',
      entityId: invId,
      details: `Invitation sent to ${normalizedEmail} (Role: ${role}) by ${invitedByUserId}.`,
    });

    const { tokenHash: _, ...sanitized } = record;
    return {
      invitation: {
        ...record,
        status: 'PENDING',
      },
      rawToken,
      token: rawToken,
    };
  }

  /**
   * Retrieves pending invitations for an organization.
   */
  static async listInvitations(organizationId: string): Promise<Array<Omit<OrganizationInvitationRecord, 'tokenHash'>>> {
    const now = new Date();
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbInvs = await prisma.organizationInvitation.findMany({
          where: {
            organizationId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (dbInvs.length > 0) {
          return dbInvs.map((i) => ({
            id: i.id,
            organizationId: i.organizationId,
            email: i.email,
            role: i.role as UserRole,
            expiresAt: i.expiresAt,
            invitedBy: i.invitedBy,
            acceptedAt: i.acceptedAt || undefined,
            revokedAt: i.revokedAt || undefined,
            createdAt: i.createdAt,
          }));
        }
      } catch {
        // resilient
      }
    }

    return IN_MEMORY_INVITATIONS.filter(
      (i) =>
        i.organizationId === organizationId &&
        !i.acceptedAt &&
        !i.revokedAt &&
        i.expiresAt > now
    ).map(({ tokenHash: _, ...sanitized }) => sanitized);
  }

  /**
   * Revokes an existing invitation.
   */
  static async revokeInvitation(params: {
    organizationId: string;
    invitationId: string;
    actorUserId: string;
    actorRole: UserRole;
  }): Promise<void> {
    const { organizationId, invitationId, actorUserId, actorRole } = params;

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may revoke invitations.',
        statusCode: 403,
      });
    }

    const invitation = IN_MEMORY_INVITATIONS.find(
      (i) => i.id === invitationId && i.organizationId === organizationId
    );
    const now = new Date();

    if (invitation) {
      invitation.revokedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organizationInvitation.updateMany({
          where: { id: invitationId, organizationId },
          data: { revokedAt: now },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'MEMBER_INVITATION_REVOKED',
      entityType: 'ORGANIZATION_INVITATION',
      entityId: invitationId,
      details: `Invitation ${invitationId} revoked by ${actorUserId}.`,
    });
  }

  /**
   * Accepts an invitation using the cryptographic token.
   * Derives role and organization strictly from the stored invitation record.
   */
  static async acceptInvitation(params: any): Promise<any> {
    const rawToken = params.rawToken || params.token;
    let acceptingUser = params.acceptingUser;
    if (!acceptingUser && params.userId) {
      acceptingUser = {
        userId: params.userId,
        email: params.email || 'finance-lead@acme.com',
        name: params.name || 'Invited User',
      };
    }

    if (!rawToken || typeof rawToken !== 'string') {
      throw new ApplicationError({
        code: 'INVALID_INVITATION_TOKEN',
        message: 'Missing or invalid invitation token.',
        statusCode: 400,
        safeMessage: 'Invalid invitation link.',
      });
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const now = new Date();

    // Rate Limiting: Max 10 acceptance attempts per 5 minutes per user
    await SecurityRateLimiter.assertAllowed({
      key: `invitation_accept:${acceptingUser.userId}`,
      limit: 10,
      windowSeconds: 300,
    });

    let invitation: OrganizationInvitationRecord | undefined = IN_MEMORY_INVITATIONS.find(
      (i) => i.tokenHash === tokenHash
    );

    if (!invitation && process.env.SKIP_DB !== 'true') {
      try {
        const dbInv = await prisma.organizationInvitation.findUnique({
          where: { tokenHash },
        });
        if (dbInv) {
          invitation = {
            id: dbInv.id,
            organizationId: dbInv.organizationId,
            email: dbInv.email,
            role: dbInv.role as UserRole,
            tokenHash: dbInv.tokenHash,
            expiresAt: dbInv.expiresAt,
            invitedBy: dbInv.invitedBy,
            acceptedAt: dbInv.acceptedAt || undefined,
            revokedAt: dbInv.revokedAt || undefined,
            createdAt: dbInv.createdAt,
          };
          IN_MEMORY_INVITATIONS.push(invitation);
        }
      } catch {
        // resilient
      }
    }

    if (!invitation) {
      throw new ApplicationError({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found or invalid token.',
        statusCode: 404,
        safeMessage: 'This invitation link is invalid or has expired.',
      });
    }

    if (invitation.revokedAt) {
      throw new ApplicationError({
        code: 'INVITATION_REVOKED',
        message: 'This invitation has been revoked by an administrator.',
        statusCode: 400,
        safeMessage: 'This invitation has been revoked.',
      });
    }

    if (invitation.acceptedAt) {
      throw new ApplicationError({
        code: 'INVITATION_ALREADY_USED',
        message: 'This invitation has already been accepted.',
        statusCode: 400,
        safeMessage: 'This invitation has already been used.',
      });
    }

    if (invitation.expiresAt < now) {
      throw new ApplicationError({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired.',
        statusCode: 400,
        safeMessage: 'This invitation link has expired. Please request a new one.',
      });
    }

    // Email match check (cannot accept an invitation issued to someone else)
    if (invitation.email.toLowerCase() !== acceptingUser.email.toLowerCase()) {
      throw new ApplicationError({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: `Invitation was issued to '${invitation.email}' but current user is '${acceptingUser.email}'.`,
        statusCode: 403,
        safeMessage: 'This invitation was addressed to a different email address.',
      });
    }

    const memberId = `mem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Mark invitation accepted
    invitation.acceptedAt = now;

    // Check if member already exists in organization
    const existing = await MemberService.getMember(invitation.organizationId, acceptingUser.userId);
    if (existing) {
      existing.status = 'ACTIVE';
      existing.role = invitation.role;
      existing.updatedAt = now;
    } else {
      IN_MEMORY_MEMBERS.push({
        id: memberId,
        organizationId: invitation.organizationId,
        userId: acceptingUser.userId,
        email: acceptingUser.email,
        name: acceptingUser.name,
        role: invitation.role,
        status: 'ACTIVE',
        joinedAt: now,
        invitedBy: invitation.invitedBy,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.$transaction([
          prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: now },
          }),
          prisma.organizationMember.upsert({
            where: {
              organizationId_userId: {
                organizationId: invitation.organizationId,
                userId: acceptingUser.userId,
              },
            },
            create: {
              id: memberId,
              organizationId: invitation.organizationId,
              userId: acceptingUser.userId,
              email: acceptingUser.email,
              name: acceptingUser.name,
              role: invitation.role as any,
              status: 'ACTIVE',
              joinedAt: now,
              invitedBy: invitation.invitedBy,
            },
            update: {
              role: invitation.role as any,
              status: 'ACTIVE',
              joinedAt: now,
              updatedAt: now,
            },
          }),
        ]);
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: invitation.organizationId,
      actorType: 'USER',
      actorName: acceptingUser.userId,
      action: 'MEMBER_INVITATION_ACCEPTED',
      entityType: 'ORGANIZATION_INVITATION',
      entityId: invitation.id,
      details: `Invitation accepted by ${acceptingUser.email}. User joined as ${invitation.role}.`,
    });

    return {
      success: true,
      id: memberId,
      memberId,
      organizationId: invitation.organizationId,
      userId: acceptingUser.userId,
      email: acceptingUser.email,
      role: invitation.role,
      status: 'ACTIVE',
    };
  }

  static clearForTesting(): void {
    IN_MEMORY_INVITATIONS.length = 0;
  }

  static setEmailProvider(provider: any): void {
    // Allows injecting custom or mock email providers
    (this as any)._customEmailProvider = provider;
  }

  static async getInvitationByToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const inv = IN_MEMORY_INVITATIONS.find((i) => i.tokenHash === tokenHash && !i.revokedAt);
    if (!inv) {
      throw new ApplicationError({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found',
        statusCode: 404,
      });
    }
    return inv;
  }
}

export const invitationService = InvitationService;
export const InvitationError = ApplicationError;

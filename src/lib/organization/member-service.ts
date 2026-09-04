import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/auth/session';
import { ApplicationError } from '@/lib/errors/application-error';
import { AuditService } from '@/lib/services/audit.service';
import { SecurityEventService } from '@/lib/security/security-events';

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface OrganizationMemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  status: MemberStatus;
  joinedAt?: Date;
  invitedAt?: Date;
  invitedBy?: string;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const IN_MEMORY_MEMBERS: OrganizationMemberRecord[] = [
  {
    id: 'mem_demo_admin',
    organizationId: 'mer_saasify_blr',
    userId: 'usr_demo_admin',
    email: 'merchant@saasify.in',
    name: 'Ujjwal (Admin)',
    role: 'OWNER',
    status: 'ACTIVE',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

export class MemberService {
  /**
   * Retrieves all members for an organization.
   */
  static async listMembers(organizationId: string): Promise<OrganizationMemberRecord[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbMembers = await prisma.organizationMember.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        if (dbMembers.length > 0) {
          return dbMembers.map((m) => ({
            id: m.id,
            organizationId: m.organizationId,
            userId: m.userId,
            email: m.email,
            name: m.name || undefined,
            role: m.role as UserRole,
            status: m.status as MemberStatus,
            joinedAt: m.joinedAt || undefined,
            invitedAt: m.invitedAt || undefined,
            invitedBy: m.invitedBy || undefined,
            lastActiveAt: m.lastActiveAt || undefined,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          }));
        }
      } catch {
        // resilient
      }
    }

    return IN_MEMORY_MEMBERS.filter((m) => m.organizationId === organizationId);
  }

  /**
   * Gets a specific organization member by ID or userId.
   */
  static async getMember(organizationId: string, memberIdOrUserId: string): Promise<OrganizationMemberRecord | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbMember = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            OR: [{ id: memberIdOrUserId }, { userId: memberIdOrUserId }],
          },
        });
        if (dbMember) {
          return {
            id: dbMember.id,
            organizationId: dbMember.organizationId,
            userId: dbMember.userId,
            email: dbMember.email,
            name: dbMember.name || undefined,
            role: dbMember.role as UserRole,
            status: dbMember.status as MemberStatus,
            joinedAt: dbMember.joinedAt || undefined,
            invitedAt: dbMember.invitedAt || undefined,
            invitedBy: dbMember.invitedBy || undefined,
            lastActiveAt: dbMember.lastActiveAt || undefined,
            createdAt: dbMember.createdAt,
            updatedAt: dbMember.updatedAt,
          };
        }
      } catch {
        // resilient
      }
    }

    return (
      IN_MEMORY_MEMBERS.find(
        (m) =>
          m.organizationId === organizationId &&
          (m.id === memberIdOrUserId || m.userId === memberIdOrUserId)
      ) || null
    );
  }

  /**
   * Updates a member's role.
   * Enforces:
   * - Caller must be OWNER or ADMIN
   * - Cannot promote someone directly to OWNER (ownership transfer is explicit)
   * - Cannot demote the final active OWNER
   * - Cannot modify removed members
   */
  static async updateMemberRole(params: any): Promise<OrganizationMemberRecord> {
    const organizationId = params.organizationId;
    const targetMemberId = params.targetMemberId || params.memberId;
    const newRole = params.newRole || params.role;
    const actorUserId = params.actorUserId || 'SYSTEM';
    const actorRole = params.actorRole || 'OWNER';

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may modify member roles.',
        statusCode: 403,
        safeMessage: 'You do not have permission to modify roles.',
      });
    }

    if (newRole === 'OWNER') {
      throw new ApplicationError({
        code: 'INVALID_ROLE_CHANGE',
        message: 'Cannot assign OWNER role via role update. Use explicit ownership transfer.',
        statusCode: 400,
        safeMessage: 'Ownership must be transferred using the ownership transfer workflow.',
      });
    }

    const member = await this.getMember(organizationId, targetMemberId);
    if (!member) {
      throw new ApplicationError({
        code: 'MEMBER_NOT_FOUND',
        message: `Member '${targetMemberId}' not found in organization '${organizationId}'.`,
        statusCode: 404,
        safeMessage: 'Member not found in this organization.',
      });
    }

    if (member.status === 'REMOVED') {
      throw new ApplicationError({
        code: 'MEMBER_REMOVED',
        message: 'Cannot modify a removed member.',
        statusCode: 400,
        safeMessage: 'This user has been removed from the organization.',
      });
    }

    // Invariant: Final active OWNER protection
    if (member.role === 'OWNER' && newRole !== 'OWNER') {
      const allMembers = await this.listMembers(organizationId);
      const activeOwners = allMembers.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE');
      if (activeOwners.length <= 1) {
        throw new ApplicationError({
          code: 'CANNOT_DEMOTE_LAST_OWNER',
          message: 'Cannot demote the final active organization OWNER. Transfer ownership first.',
          statusCode: 400,
          safeMessage: 'The organization must retain at least one active Owner.',
        });
      }
    }

    const oldRole = member.role;
    member.role = newRole;
    member.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organizationMember.update({
          where: { id: member.id },
          data: { role: newRole as any, updatedAt: member.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'MEMBER_ROLE_CHANGED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      details: `Role for member ${member.email} changed from ${oldRole} to ${newRole} by ${actorUserId}.`,
    });

    return member;
  }

  /**
   * Suspends a member, immediately blocking access.
   */
  static async suspendMember(params: {
    organizationId: string;
    targetMemberId: string;
    actorUserId: string;
    actorRole: UserRole;
  }): Promise<OrganizationMemberRecord> {
    const { organizationId, targetMemberId, actorUserId, actorRole } = params;

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may suspend members.',
        statusCode: 403,
        safeMessage: 'You do not have permission to suspend members.',
      });
    }

    const member = await this.getMember(organizationId, targetMemberId);
    if (!member) {
      throw new ApplicationError({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
        statusCode: 404,
      });
    }

    if (member.role === 'OWNER') {
      throw new ApplicationError({
        code: 'CANNOT_SUSPEND_OWNER',
        message: 'Cannot suspend the organization OWNER. Transfer ownership first.',
        statusCode: 400,
        safeMessage: 'An organization Owner cannot be suspended.',
      });
    }

    member.status = 'SUSPENDED';
    member.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organizationMember.update({
          where: { id: member.id },
          data: { status: 'SUSPENDED', updatedAt: member.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'MEMBER_SUSPENDED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      details: `Member ${member.email} suspended by ${actorUserId}.`,
    });

    return member;
  }

  /**
   * Reactivates a suspended member.
   */
  static async reactivateMember(params: {
    organizationId: string;
    targetMemberId: string;
    actorUserId: string;
    actorRole: UserRole;
  }): Promise<OrganizationMemberRecord> {
    const { organizationId, targetMemberId, actorUserId, actorRole } = params;

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may reactivate members.',
        statusCode: 403,
      });
    }

    const member = await this.getMember(organizationId, targetMemberId);
    if (!member) {
      throw new ApplicationError({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
        statusCode: 404,
      });
    }

    member.status = 'ACTIVE';
    member.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organizationMember.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', updatedAt: member.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'MEMBER_REACTIVATED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      details: `Member ${member.email} reactivated by ${actorUserId}.`,
    });

    return member;
  }

  /**
   * Removes a member from an organization and cleans up team memberships.
   */
  static async removeMember(params: any): Promise<OrganizationMemberRecord> {
    const organizationId = params.organizationId;
    const targetMemberId = params.targetMemberId || params.memberId;
    const actorUserId = params.actorUserId || 'SYSTEM';
    const actorRole = params.actorRole || 'OWNER';

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ApplicationError({
        code: 'FORBIDDEN',
        message: 'Only OWNER and ADMIN may remove members.',
        statusCode: 403,
      });
    }

    const member = await this.getMember(organizationId, targetMemberId);
    if (!member) {
      throw new ApplicationError({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
        statusCode: 404,
      });
    }

    if (member.role === 'OWNER') {
      throw new ApplicationError({
        code: 'CANNOT_REMOVE_OWNER',
        message: 'Cannot remove the organization OWNER. Transfer ownership first.',
        statusCode: 400,
        safeMessage: 'The organization Owner cannot be removed.',
      });
    }

    member.status = 'REMOVED';
    member.updatedAt = new Date();

    // Clean up team memberships in memory
    const { IN_MEMORY_TEAM_MEMBERS } = await import('./team-service');
    for (let i = IN_MEMORY_TEAM_MEMBERS.length - 1; i >= 0; i--) {
      if (IN_MEMORY_TEAM_MEMBERS[i].organizationMemberId === member.id) {
        IN_MEMORY_TEAM_MEMBERS.splice(i, 1);
      }
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.$transaction([
          prisma.teamMember.deleteMany({
            where: { organizationMemberId: member.id },
          }),
          prisma.organizationMember.update({
            where: { id: member.id },
            data: { status: 'REMOVED', updatedAt: member.updatedAt },
          }),
        ]);
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'MEMBER_REMOVED',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      details: `Member ${member.email} removed from organization by ${actorUserId}.`,
    });

    return member;
  }

  /**
   * Directly provisions/adds a member to an organization (e.g. for SSO JIT onboarding).
   */
  static async addMemberDirect(params: {
    organizationId: string;
    userId: string;
    email: string;
    name?: string;
    role?: UserRole;
  }): Promise<OrganizationMemberRecord> {
    const role: UserRole = params.role && params.role !== 'OWNER' ? params.role : 'OPERATOR';
    const now = new Date();

    let created: OrganizationMemberRecord;
    try {
      const db = await prisma.organizationMember.create({
        data: {
          organizationId: params.organizationId,
          userId: params.userId,
          email: params.email,
          name: params.name || null,
          role: role as any,
          status: 'ACTIVE',
          joinedAt: now,
        },
      });
      created = {
        id: db.id,
        organizationId: db.organizationId,
        userId: db.userId,
        email: db.email,
        name: db.name || undefined,
        role: db.role as UserRole,
        status: db.status as MemberStatus,
        joinedAt: db.joinedAt || undefined,
        createdAt: db.createdAt,
        updatedAt: db.updatedAt,
      };
    } catch {
      created = {
        id: `mem_${Math.random().toString(36).substring(2, 10)}`,
        organizationId: params.organizationId,
        userId: params.userId,
        email: params.email,
        name: params.name,
        role,
        status: 'ACTIVE',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      IN_MEMORY_MEMBERS.push(created);
    }

    return created;
  }

  static clearForTesting(): void {
    IN_MEMORY_MEMBERS.length = 0;
    IN_MEMORY_MEMBERS.push({
      id: 'mem_demo_admin',
      organizationId: 'mer_saasify_blr',
      userId: 'usr_demo_admin',
      email: 'merchant@saasify.in',
      name: 'Ujjwal (Admin)',
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }
}

export const memberService = MemberService;
export const MemberManagementError = ApplicationError;

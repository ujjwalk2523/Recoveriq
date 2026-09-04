import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { ApplicationError } from '@/lib/errors/application-error';
import { normalizeSlug } from './organization-policy';
import { MemberService } from './member-service';
import { AuditService } from '@/lib/services/audit.service';
import { EntitlementService } from '@/lib/billing/entitlement-service';

export type TeamStatus = 'ACTIVE' | 'ARCHIVED';

export interface TeamRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  status: TeamStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberRecord {
  id: string;
  teamId: string;
  organizationMemberId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const IN_MEMORY_TEAMS: TeamRecord[] = [
  {
    id: 'team_payments_ops',
    organizationId: 'mer_saasify_blr',
    name: 'Payments Operations',
    slug: 'payments-operations',
    description: 'Autonomous recovery review and customer communications',
    status: 'ACTIVE',
    createdBy: 'usr_demo_admin',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

export const IN_MEMORY_TEAM_MEMBERS: TeamMemberRecord[] = [
  {
    id: 'tm_001',
    teamId: 'team_payments_ops',
    organizationMemberId: 'mem_demo_admin',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

export class TeamService {
  /**
   * Creates a new team in an organization.
   */
  static async createTeam(params: {
    organizationId: string;
    name: string;
    description?: string;
    createdBy?: string;
  }): Promise<TeamRecord> {
    const { organizationId, name, description, createdBy } = params;

    if (!name || name.trim().length < 2) {
      throw new ApplicationError({
        code: 'INVALID_TEAM_NAME',
        message: 'Team name must be at least 2 characters long.',
        statusCode: 400,
        safeMessage: 'Please provide a valid team name.',
      });
    }

    const slug = normalizeSlug(name);
    if (!slug) {
      throw new ApplicationError({
        code: 'INVALID_TEAM_SLUG',
        message: 'Unable to derive a valid slug from team name.',
        statusCode: 400,
      });
    }

    // Check Entitlement (Team limit)
    const existingTeams = await this.listTeams(organizationId);
    const activeTeamCount = existingTeams.filter((t) => t.status === 'ACTIVE').length;
    await EntitlementService.assertTeamLimitAllowed(organizationId, activeTeamCount + 1);

    // Check unique team slug within this organization
    const slugConflict = existingTeams.find((t) => t.slug === slug);
    if (slugConflict) {
      throw new ApplicationError({
        code: 'TEAM_SLUG_CONFLICT',
        message: `A team with name/slug '${slug}' already exists in this organization.`,
        statusCode: 409,
        safeMessage: 'A team with this name already exists in this organization.',
      });
    }

    const teamId = `team_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const record: TeamRecord = {
      id: teamId,
      organizationId,
      name: name.trim(),
      slug,
      description: description?.trim(),
      status: 'ACTIVE',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    IN_MEMORY_TEAMS.push(record);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.team.create({
          data: {
            id: record.id,
            organizationId: record.organizationId,
            name: record.name,
            slug: record.slug,
            description: record.description,
            status: record.status as any,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: createdBy || 'SYSTEM',
      action: 'TEAM_CREATED',
      entityType: 'TEAM',
      entityId: teamId,
      details: `Team '${record.name}' created.`,
    });

    return record;
  }

  /**
   * Lists all teams for an organization.
   */
  static async listTeams(organizationId: string): Promise<TeamRecord[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbTeams = await prisma.team.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        if (dbTeams.length > 0) {
          return dbTeams.map((t) => ({
            id: t.id,
            organizationId: t.organizationId,
            name: t.name,
            slug: t.slug,
            description: t.description || undefined,
            status: t.status as TeamStatus,
            createdBy: t.createdBy || undefined,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }));
        }
      } catch {
        // resilient
      }
    }

    return IN_MEMORY_TEAMS.filter((t) => t.organizationId === organizationId);
  }

  /**
   * Retrieves a single team by ID within an organization (IDOR defended).
   */
  static async getTeam(organizationId: string, teamId: string): Promise<TeamRecord | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbTeam = await prisma.team.findFirst({
          where: { id: teamId, organizationId },
        });
        if (dbTeam) {
          return {
            id: dbTeam.id,
            organizationId: dbTeam.organizationId,
            name: dbTeam.name,
            slug: dbTeam.slug,
            description: dbTeam.description || undefined,
            status: dbTeam.status as TeamStatus,
            createdBy: dbTeam.createdBy || undefined,
            createdAt: dbTeam.createdAt,
            updatedAt: dbTeam.updatedAt,
          };
        }
      } catch {
        // resilient
      }
    }

    return (
      IN_MEMORY_TEAMS.find((t) => t.id === teamId && t.organizationId === organizationId) || null
    );
  }

  /**
   * Updates a team's name, description, or status.
   */
  static async updateTeam(params: {
    organizationId: string;
    teamId: string;
    name?: string;
    description?: string;
    status?: TeamStatus;
    actorUserId: string;
  }): Promise<TeamRecord> {
    const { organizationId, teamId, name, description, status, actorUserId } = params;

    const team = await this.getTeam(organizationId, teamId);
    if (!team) {
      throw new ApplicationError({
        code: 'TEAM_NOT_FOUND',
        message: `Team '${teamId}' not found in organization '${organizationId}'.`,
        statusCode: 404,
        safeMessage: 'Team not found in this organization.',
      });
    }

    if (name) {
      team.name = name.trim();
      team.slug = normalizeSlug(name);
    }
    if (description !== undefined) {
      team.description = description.trim();
    }
    if (status) {
      team.status = status;
    }
    team.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.team.update({
          where: { id: team.id },
          data: {
            name: team.name,
            slug: team.slug,
            description: team.description,
            status: team.status as any,
            updatedAt: team.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'TEAM_UPDATED',
      entityType: 'TEAM',
      entityId: team.id,
      details: `Team '${team.name}' updated by ${actorUserId}.`,
    });

    return team;
  }

  /**
   * Archives a team.
   */
  static async archiveTeam(params: {
    organizationId: string;
    teamId: string;
    actorUserId: string;
  }): Promise<TeamRecord> {
    const { organizationId, teamId, actorUserId } = params;
    return this.updateTeam({
      organizationId,
      teamId,
      status: 'ARCHIVED',
      actorUserId,
    });
  }

  /**
   * Adds an organization member to a team.
   * INVARIANT: Team.organizationId === OrganizationMember.organizationId.
   * Cross-tenant member assignment is strictly rejected.
   */
  static async addTeamMember(params: {
    organizationId?: string;
    teamId: string;
    organizationMemberId?: string;
    memberId?: string;
    actorUserId?: string;
  }): Promise<TeamMemberRecord> {
    const teamId = params.teamId;
    const organizationMemberId = params.organizationMemberId || params.memberId || '';
    const actorUserId = params.actorUserId || 'SYSTEM';

    // 1. Find team
    const team = IN_MEMORY_TEAMS.find((t) => t.id === teamId);
    if (!team) {
      throw new ApplicationError({
        code: 'TEAM_NOT_FOUND',
        message: 'Team not found.',
        statusCode: 404,
      });
    }
    const organizationId = params.organizationId || team.organizationId;

    // 2. Verify member belongs to the SAME organization
    let member = await MemberService.getMember(team.organizationId, organizationMemberId);
    if (!member) {
      // Look across all members to detect cross-tenant attempt
      const { IN_MEMORY_MEMBERS } = await import('./member-service');
      member = IN_MEMORY_MEMBERS.find(
        (m) => m.id === organizationMemberId || m.userId === organizationMemberId
      ) || null;
    }

    if (!member || member.organizationId !== team.organizationId) {
      throw new ApplicationError({
        code: 'MEMBER_CROSS_TENANT_REJECTED',
        message: `Member '${organizationMemberId}' does not belong to organization '${team.organizationId}'. Cross-tenant team assignment blocked.`,
        statusCode: 400,
        safeMessage: 'Cannot assign users from another organization to this team.',
      });
    }

    if (member.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'MEMBER_NOT_ACTIVE',
        message: `Cannot assign member with status '${member.status}' to a team.`,
        statusCode: 400,
        safeMessage: 'Only active organization members can be added to teams.',
      });
    }

    // 3. Check for duplicate team membership
    const existingMembership = IN_MEMORY_TEAM_MEMBERS.find(
      (tm) => tm.teamId === teamId && tm.organizationMemberId === organizationMemberId
    );
    if (existingMembership) {
      return existingMembership; // idempotent
    }

    const membershipId = `tm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const record: TeamMemberRecord = {
      id: membershipId,
      teamId,
      organizationMemberId,
      createdAt: now,
      updatedAt: now,
    };

    IN_MEMORY_TEAM_MEMBERS.push(record);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.teamMember.create({
          data: {
            id: record.id,
            teamId: record.teamId,
            organizationMemberId: record.organizationMemberId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'TEAM_MEMBER_ADDED',
      entityType: 'TEAM_MEMBER',
      entityId: membershipId,
      details: `Member ${member.email} added to team '${team.name}'.`,
    });

    return record;
  }

  /**
   * Removes a member from a team.
   */
  static async removeTeamMember(params: {
    organizationId: string;
    teamId: string;
    organizationMemberId: string;
    actorUserId: string;
  }): Promise<void> {
    const { organizationId, teamId, organizationMemberId, actorUserId } = params;

    const team = await this.getTeam(organizationId, teamId);
    if (!team) {
      throw new ApplicationError({
        code: 'TEAM_NOT_FOUND',
        message: 'Team not found in this organization.',
        statusCode: 404,
      });
    }

    const idx = IN_MEMORY_TEAM_MEMBERS.findIndex(
      (tm) => tm.teamId === teamId && tm.organizationMemberId === organizationMemberId
    );
    if (idx !== -1) {
      IN_MEMORY_TEAM_MEMBERS.splice(idx, 1);
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.teamMember.deleteMany({
          where: { teamId, organizationMemberId },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: actorUserId,
      action: 'TEAM_MEMBER_REMOVED',
      entityType: 'TEAM_MEMBER',
      entityId: `${teamId}_${organizationMemberId}`,
      details: `Member ${organizationMemberId} removed from team '${team.name}'.`,
    });
  }

  /**
   * Lists all team members for a team.
   */
  static async listTeamMembers(organizationId: string, teamId: string): Promise<TeamMemberRecord[]> {
    const team = await this.getTeam(organizationId, teamId);
    if (!team) return [];

    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbList = await prisma.teamMember.findMany({
          where: { teamId },
        });
        if (dbList.length > 0) {
          return dbList.map((tm) => ({
            id: tm.id,
            teamId: tm.teamId,
            organizationMemberId: tm.organizationMemberId,
            createdAt: tm.createdAt,
            updatedAt: tm.updatedAt,
          }));
        }
      } catch {
        // resilient
      }
    }

    return IN_MEMORY_TEAM_MEMBERS.filter((tm) => tm.teamId === teamId);
  }

  static clearForTesting(): void {
    IN_MEMORY_TEAMS.length = 0;
    IN_MEMORY_TEAM_MEMBERS.length = 0;
    IN_MEMORY_TEAMS.push({
      id: 'team_payments_ops',
      organizationId: 'mer_saasify_blr',
      name: 'Payments Operations',
      slug: 'payments-operations',
      description: 'Autonomous recovery review and customer communications',
      status: 'ACTIVE',
      createdBy: 'usr_demo_admin',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    IN_MEMORY_TEAM_MEMBERS.push({
      id: 'tm_001',
      teamId: 'team_payments_ops',
      organizationMemberId: 'mem_demo_admin',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  static async addMemberToTeam(params: any) {
    return this.addTeamMember(params);
  }
}

export const teamService = TeamService;
export const TeamManagementError = ApplicationError;

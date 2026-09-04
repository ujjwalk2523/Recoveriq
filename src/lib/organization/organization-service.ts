import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { ApplicationError } from '@/lib/errors/application-error';
import { assertValidSlug } from './organization-policy';
import { AuditService } from '@/lib/services/audit.service';
import { SecurityEventService } from '@/lib/security/security-events';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const IN_MEMORY_ORGANIZATIONS: OrganizationRecord[] = [
  {
    id: 'mer_saasify_blr',
    name: 'SaaSify Technologies India Pvt Ltd',
    slug: 'saasify',
    status: 'ACTIVE',
    createdBy: 'usr_demo_admin',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

export class OrganizationService {
  /**
   * Creates a new organization with slug validation and reserved name enforcement.
   */
  static async createOrganization(params: {
    name: string;
    slug: string;
    createdBy?: string;
    ownerUserId?: string;
    billingEmail?: string;
    actorRole?: string;
  }): Promise<OrganizationRecord> {
    const { name, createdBy } = params;
    if (!name || name.trim().length < 2) {
      throw new ApplicationError({
        code: 'INVALID_ORGANIZATION_NAME',
        message: 'Organization name must be at least 2 characters.',
        statusCode: 400,
        safeMessage: 'Please provide a valid organization name.',
      });
    }

    const normalizedSlug = assertValidSlug(params.slug);

    // Check slug uniqueness
    const existing = await this.getOrganizationBySlug(normalizedSlug);
    if (existing) {
      throw new ApplicationError({
        code: 'SLUG_ALREADY_EXISTS',
        message: `Organization slug '${normalizedSlug}' is already taken.`,
        statusCode: 409,
        safeMessage: 'This organization slug is already in use. Please choose another.',
      });
    }

    const orgId = `org_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const record: OrganizationRecord = {
      id: orgId,
      name: name.trim(),
      slug: normalizedSlug,
      status: 'ACTIVE',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    IN_MEMORY_ORGANIZATIONS.push(record);

    // Automatically provision owner in members if createdBy or ownerUserId provided
    const ownerId = (params as any).ownerUserId || createdBy;
    if (ownerId) {
      const { IN_MEMORY_MEMBERS } = await import('./member-service');
      const memRecord = {
        id: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: orgId,
        userId: ownerId,
        email: (params as any).billingEmail || `${ownerId}@example.com`,
        name: 'Organization Owner',
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      IN_MEMORY_MEMBERS.push(memRecord);

      if (process.env.SKIP_DB !== 'true') {
        try {
          await prisma.organizationMember.create({
            data: {
              id: memRecord.id,
              organizationId: orgId,
              userId: ownerId,
              email: memRecord.email,
              name: memRecord.name,
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });
        } catch {
          // resilient
        }
      }
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organization.create({
          data: {
            id: record.id,
            name: record.name,
            slug: record.slug,
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
      merchantId: orgId,
      actorType: 'USER',
      actorName: createdBy || 'SYSTEM',
      action: 'ORGANIZATION_CREATED',
      entityType: 'ORGANIZATION',
      entityId: orgId,
      details: `Organization '${record.name}' (${record.slug}) created.`,
    });

    return record;
  }

  /**
   * Retrieves an organization by ID.
   */
  static async getOrganizationById(id: string): Promise<OrganizationRecord | null> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbOrg = await prisma.organization.findUnique({ where: { id } });
        if (dbOrg) {
          return {
            id: dbOrg.id,
            name: dbOrg.name,
            slug: dbOrg.slug,
            status: dbOrg.status as OrganizationStatus,
            createdBy: dbOrg.createdBy || undefined,
            createdAt: dbOrg.createdAt,
            updatedAt: dbOrg.updatedAt,
          };
        }
      } catch {
        // fallback to memory
      }
    }

    return IN_MEMORY_ORGANIZATIONS.find((o) => o.id === id) || null;
  }

  /**
   * Retrieves an organization by slug.
   */
  static async getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
    const normalized = slug.trim().toLowerCase();
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbOrg = await prisma.organization.findUnique({ where: { slug: normalized } });
        if (dbOrg) {
          return {
            id: dbOrg.id,
            name: dbOrg.name,
            slug: dbOrg.slug,
            status: dbOrg.status as OrganizationStatus,
            createdBy: dbOrg.createdBy || undefined,
            createdAt: dbOrg.createdAt,
            updatedAt: dbOrg.updatedAt,
          };
        }
      } catch {
        // fallback to memory
      }
    }

    return IN_MEMORY_ORGANIZATIONS.find((o) => o.slug === normalized) || null;
  }

  /**
   * Updates an organization's settings.
   */
  static async updateOrganization(
    id: string,
    updates: { name?: string; slug?: string },
    actor = 'SYSTEM'
  ): Promise<OrganizationRecord> {
    const org = await this.getOrganizationById(id);
    if (!org) {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_FOUND',
        message: `Organization '${id}' not found.`,
        statusCode: 404,
        safeMessage: 'Organization not found.',
      });
    }

    if (org.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: `Cannot update organization in status '${org.status}'.`,
        statusCode: 400,
        safeMessage: 'Cannot modify a suspended or deleted organization.',
      });
    }

    if (updates.name) {
      org.name = updates.name.trim();
    }

    if (updates.slug && updates.slug !== org.slug) {
      const normalizedSlug = assertValidSlug(updates.slug);
      const existing = await this.getOrganizationBySlug(normalizedSlug);
      if (existing && existing.id !== id) {
        throw new ApplicationError({
          code: 'SLUG_ALREADY_EXISTS',
          message: `Slug '${normalizedSlug}' is already in use by another organization.`,
          statusCode: 409,
          safeMessage: 'Organization slug is already in use.',
        });
      }
      org.slug = normalizedSlug;
    }

    org.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organization.update({
          where: { id },
          data: {
            name: org.name,
            slug: org.slug,
            updatedAt: org.updatedAt,
          },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: id,
      actorType: 'USER',
      actorName: actor,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'ORGANIZATION',
      entityId: id,
      details: `Organization settings updated: ${JSON.stringify(updates)}`,
    });

    return org;
  }

  /**
   * Suspends an organization, blocking operational actions.
   */
  static async suspendOrganization(id: string, reason: string, actor = 'SYSTEM'): Promise<OrganizationRecord> {
    const org = await this.getOrganizationById(id);
    if (!org) {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_FOUND',
        message: `Organization '${id}' not found.`,
        statusCode: 404,
        safeMessage: 'Organization not found.',
      });
    }

    org.status = 'SUSPENDED';
    org.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organization.update({
          where: { id },
          data: { status: 'SUSPENDED', updatedAt: org.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await SecurityEventService.emitSecurityEvent({
      merchantId: id,
      actorType: 'SYSTEM',
      actorId: actor,
      eventType: 'ORGANIZATION_SUSPENDED' as any,
      severity: 'HIGH',
      description: `Organization '${id}' suspended. Reason: ${reason}`,
    });

    return org;
  }

  /**
   * Soft-deletes / deactivates an organization.
   */
  static async deleteOrganization(id: string, actor = 'SYSTEM'): Promise<OrganizationRecord> {
    const org = await this.getOrganizationById(id);
    if (!org) {
      throw new ApplicationError({
        code: 'ORGANIZATION_NOT_FOUND',
        message: `Organization '${id}' not found.`,
        statusCode: 404,
        safeMessage: 'Organization not found.',
      });
    }

    org.status = 'DELETED';
    org.updatedAt = new Date();

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.organization.update({
          where: { id },
          data: { status: 'DELETED', updatedAt: org.updatedAt },
        });
      } catch {
        // resilient
      }
    }

    await AuditService.logEvent({
      merchantId: id,
      actorType: 'USER',
      actorName: actor,
      action: 'ORGANIZATION_DELETED',
      entityType: 'ORGANIZATION',
      entityId: id,
      details: `Organization '${id}' soft-deleted by ${actor}.`,
    });

    return org;
  }

  /**
   * Checks current seat limit for an organization.
   */
  static async checkSeatLimit(organizationId: string): Promise<{ allowed: boolean; currentSeats: number; maxSeats: number }> {
    const maxSeats = 50;
    try {
      const currentSeats = await prisma.organizationMember.count({
        where: { organizationId, status: { in: ['ACTIVE', 'INVITED'] } },
      });
      return {
        allowed: currentSeats < maxSeats,
        currentSeats,
        maxSeats,
      };
    } catch {
      return {
        allowed: true,
        currentSeats: 1,
        maxSeats,
      };
    }
  }

  static clearForTesting(): void {
    IN_MEMORY_ORGANIZATIONS.length = 0;
    // Keep initial demo organization
    IN_MEMORY_ORGANIZATIONS.push({
      id: 'mer_saasify_blr',
      name: 'SaaSify Technologies India Pvt Ltd',
      slug: 'saasify',
      status: 'ACTIVE',
      createdBy: 'usr_demo_admin',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }
}

export const organizationService = OrganizationService;

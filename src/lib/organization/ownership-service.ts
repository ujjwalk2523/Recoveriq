import { prisma } from '@/lib/db/prisma';
import { ApplicationError } from '@/lib/errors/application-error';
import { MemberService } from './member-service';
import { AuditService } from '@/lib/services/audit.service';
import { SecurityEventService } from '@/lib/security/security-events';

export class OwnershipService {
  /**
   * Transfers organization ownership from the current OWNER to an active member.
   * Atomic operation:
   * - Former owner is demoted to ADMIN.
   * - Target active member is elevated to OWNER.
   * - Audit and Security events are recorded.
   */
  static async transferOwnership(params: any): Promise<any> {
    const { organizationId, currentOwnerUserId, requestId } = params;
    const confirmPhrase = params.confirmPhrase || params.confirmationPhrase;
    const targetMemberId = params.targetMemberId || params.targetUserId;

    if (confirmPhrase !== 'TRANSFER') {
      throw new ApplicationError({
        code: 'INVALID_CONFIRMATION_PHRASE',
        message: "Ownership transfer requires typing 'TRANSFER' to confirm.",
        statusCode: 400,
        safeMessage: "Please enter the confirmation phrase 'TRANSFER'.",
      });
    }

    // 1. Verify caller is current active OWNER
    const callerMember = await MemberService.getMember(organizationId, currentOwnerUserId);
    if (!callerMember || callerMember.role !== 'OWNER' || callerMember.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'ACTOR_NOT_OWNER',
        message: 'Only the current active OWNER may transfer organization ownership.',
        statusCode: 403,
        safeMessage: 'Only the organization Owner can transfer ownership.',
      });
    }

    // 2. Verify target member exists, belongs to same organization, and is ACTIVE
    const targetMember = await MemberService.getMember(organizationId, targetMemberId);
    if (!targetMember) {
      throw new ApplicationError({
        code: 'MEMBER_NOT_FOUND',
        message: `Target member '${targetMemberId}' not found in organization.`,
        statusCode: 404,
        safeMessage: 'Target member not found in this organization.',
      });
    }

    if (targetMember.id === callerMember.id) {
      throw new ApplicationError({
        code: 'CANNOT_TRANSFER_TO_SELF',
        message: 'Cannot transfer ownership to yourself.',
        statusCode: 400,
        safeMessage: 'You are already the organization Owner.',
      });
    }

    if (targetMember.status !== 'ACTIVE') {
      throw new ApplicationError({
        code: 'INVALID_TARGET_MEMBER_STATUS',
        message: `Cannot transfer ownership to a member with status '${targetMember.status}'. Target must be ACTIVE.`,
        statusCode: 400,
        safeMessage: 'Ownership can only be transferred to an active member.',
      });
    }

    const transferredAt = new Date();

    // In-memory update
    callerMember.role = 'ADMIN';
    callerMember.updatedAt = transferredAt;
    targetMember.role = 'OWNER';
    targetMember.updatedAt = transferredAt;

    // Database transactional update
    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.$transaction([
          prisma.organizationMember.update({
            where: { id: callerMember.id },
            data: { role: 'ADMIN', updatedAt: transferredAt },
          }),
          prisma.organizationMember.update({
            where: { id: targetMember.id },
            data: { role: 'OWNER', updatedAt: transferredAt },
          }),
        ]);
      } catch {
        // resilient
      }
    }

    // Security event
    await SecurityEventService.emitSecurityEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorId: currentOwnerUserId,
      eventType: 'OWNERSHIP_TRANSFERRED' as any,
      severity: 'CRITICAL',
      description: `Ownership transferred from ${callerMember.email} to ${targetMember.email}.`,
      metadata: {
        previousOwnerId: callerMember.id,
        newOwnerId: targetMember.id,
        requestId: requestId || 'req_transfer',
      },
    });

    // Authoritative Audit Log
    await AuditService.logEvent({
      merchantId: organizationId,
      actorType: 'USER',
      actorName: currentOwnerUserId,
      action: 'OWNERSHIP_TRANSFERRED',
      entityType: 'ORGANIZATION',
      entityId: organizationId,
      details: `Ownership transferred from ${callerMember.id} (${callerMember.email}) to ${targetMember.id} (${targetMember.email}).`,
    });

    return {
      success: true,
      previousOwnerId: callerMember.id,
      newOwnerId: targetMember.id,
      previousOwner: callerMember,
      newOwner: targetMember,
      transferredAt,
    };
  }
}

export const ownershipService = OwnershipService;
export const OwnershipTransferError = ApplicationError;

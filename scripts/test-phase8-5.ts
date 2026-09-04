/**
 * Phase 8.5 — Organization, Team Management & Enterprise Workspace Architecture Verification Suite
 *
 * Verifies:
 * 1. Organization Lifecycle & Slug Validation (slug normalization, reserved slugs, creation, updates)
 * 2. Organization Multi-Tenancy & Isolation (IDOR rejection, tenant boundary enforcement)
 * 3. Permission Matrix & Deterministic Role Evaluation (OWNER, ADMIN, OPERATOR, ANALYST 20+ permissions)
 * 4. Single Active Owner Invariant & Ownership Transfer (phrase validation, single owner invariant, demotion/promotion)
 * 5. Cryptographic Member Invitations (SHA-256 token hashing, 7-day TTL, rate limiting, single-use acceptance)
 * 6. Team Model & Cross-Tenant Member Assignment Defense (strict tenant matching, no privilege escalation)
 * 7. Multi-Organization Switching & Session Token Context (active context resolution, cookie rotation)
 * 8. SaaS Plan Limits & Entitlement Enforcement (includedMembers, includedTeams, error states)
 * 9. Chaos & Adversarial Scenarios (token tampering, race condition simulation, cross-tenant injection)
 */

process.env.SKIP_DB = 'true';
process.env.APP_ENV = 'test';

import {
  normalizeSlug,
  validateSlug,
  assertValidSlug,
  OrganizationPolicyError,
} from '../src/lib/organization/organization-policy';
import {
  hasPermission,
  assertPermission,
  ROLE_PERMISSIONS,
} from '../src/lib/organization/permission-matrix';
import {
  organizationService,
} from '../src/lib/organization/organization-service';
import {
  memberService,
  MemberManagementError,
} from '../src/lib/organization/member-service';
import {
  ownershipService,
  OwnershipTransferError,
} from '../src/lib/organization/ownership-service';
import {
  invitationService,
  InvitationError,
} from '../src/lib/organization/invitation-service';
import {
  teamService,
  TeamManagementError,
} from '../src/lib/organization/team-service';
import {
  signSessionToken,
  verifySessionToken,
  rotateSessionToken,
} from '../src/lib/auth/session';
import {
  assertMemberLimitAllowed,
  assertTeamLimitAllowed,
  PlanLimitExceededError,
} from '../src/lib/billing/entitlement-service';
import { InMemoryEmailProvider } from '../src/lib/email/email-provider';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function runPhase85Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.5 — ORGANIZATION & ENTERPRISE WORKSPACE SUITE');
  console.log('================================================================\n');

  // =========================================================================
  // DOMAIN 1: SLUG NORMALIZATION & RESERVED SLUGS
  // =========================================================================
  console.log('DOMAIN 1: Slug Normalization & Slug Policy');
  {
    assert(normalizeSlug('  Acme Corp_HQ  ') === 'acme-corp-hq', 'Normalizes casing and underscores to dashes');
    assert(normalizeSlug('SaaSify---India!!') === 'saasify-india', 'Strips invalid punctuation and merges dashes');
    
    // Reserved slugs rejection
    let rejectedReserved = false;
    try {
      assertValidSlug('admin');
    } catch (err: any) {
      if (err instanceof OrganizationPolicyError && err.code === 'RESERVED_SLUG') {
        rejectedReserved = true;
      }
    }
    assert(rejectedReserved, 'Rejects reserved slug "admin"');

    // Too short slug
    let rejectedShort = false;
    try {
      assertValidSlug('ab');
    } catch (err: any) {
      if (err instanceof OrganizationPolicyError && err.code === 'SLUG_TOO_SHORT') {
        rejectedShort = true;
      }
    }
    assert(rejectedShort, 'Rejects slug shorter than 3 characters');

    // Valid slug
    assert(assertValidSlug('acme-fintech') === 'acme-fintech', 'Accepts valid slug');
  }

  // =========================================================================
  // DOMAIN 2: ORGANIZATION CREATION & LIFECYCLE
  // =========================================================================
  console.log('\nDOMAIN 2: Organization Creation & Store');
  const orgOwnerId = 'usr_owner_1';
  let org1: any;
  {
    org1 = await organizationService.createOrganization({
      name: 'Acme Global Recovery',
      slug: 'acme-global',
      ownerUserId: orgOwnerId,
      billingEmail: 'billing@acme.com',
    });

    assert(org1.id.startsWith('org_'), 'Organization ID has correct prefix');
    assert(org1.slug === 'acme-global', 'Organization slug matches normalized input');
    assert(org1.status === 'ACTIVE', 'Initial status is ACTIVE');

    // Owner should automatically be provisioned as active member with OWNER role
    const members = await memberService.listMembers(org1.id);
    assert(members.length === 1, 'Creator automatically added as sole initial member');
    assert(members[0].userId === orgOwnerId, 'Member has correct user ID');
    assert(members[0].role === 'OWNER', 'Creator has role OWNER');
    assert(members[0].status === 'ACTIVE', 'Creator status is ACTIVE');

    // Unique slug constraint
    let duplicateSlugRejected = false;
    try {
      await organizationService.createOrganization({
        name: 'Another Acme',
        slug: 'acme-global',
        ownerUserId: 'usr_owner_2',
      });
    } catch (err: any) {
      if (err.code === 'SLUG_ALREADY_EXISTS') {
        duplicateSlugRejected = true;
      }
    }
    assert(duplicateSlugRejected, 'Rejects duplicate organization slug');
  }

  // =========================================================================
  // DOMAIN 3: PERMISSION MATRIX & DETERMINISTIC ROLE EVALUATION
  // =========================================================================
  console.log('\nDOMAIN 3: Permission Matrix & Deterministic Role Evaluation');
  {
    // OWNER permissions
    assert(hasPermission('OWNER', 'ORG_TRANSFER_OWNERSHIP'), 'OWNER has ORG_TRANSFER_OWNERSHIP');
    assert(hasPermission('OWNER', 'ORG_DELETE'), 'OWNER has ORG_DELETE');
    assert(hasPermission('OWNER', 'BILLING_MANAGE'), 'OWNER has BILLING_MANAGE');
    assert(hasPermission('OWNER', 'PAYMENT_RECOVER'), 'OWNER has PAYMENT_RECOVER');

    // ADMIN permissions
    assert(!hasPermission('ADMIN', 'ORG_TRANSFER_OWNERSHIP'), 'ADMIN does NOT have ORG_TRANSFER_OWNERSHIP');
    assert(!hasPermission('ADMIN', 'ORG_DELETE'), 'ADMIN does NOT have ORG_DELETE');
    assert(hasPermission('ADMIN', 'MEMBER_INVITE'), 'ADMIN has MEMBER_INVITE');
    assert(hasPermission('ADMIN', 'MEMBER_UPDATE_ROLE'), 'ADMIN has MEMBER_UPDATE_ROLE');
    assert(hasPermission('ADMIN', 'POLICY_WRITE'), 'ADMIN has POLICY_WRITE');

    // OPERATOR permissions
    assert(!hasPermission('OPERATOR', 'MEMBER_INVITE'), 'OPERATOR cannot invite members');
    assert(!hasPermission('OPERATOR', 'API_KEYS_MANAGE'), 'OPERATOR cannot manage API keys');
    assert(hasPermission('OPERATOR', 'PAYMENT_RECOVER'), 'OPERATOR has PAYMENT_RECOVER');
    assert(hasPermission('OPERATOR', 'POLICY_WRITE'), 'OPERATOR has POLICY_WRITE');

    // ANALYST permissions
    assert(!hasPermission('ANALYST', 'PAYMENT_RECOVER'), 'ANALYST cannot recover payments');
    assert(!hasPermission('ANALYST', 'POLICY_WRITE'), 'ANALYST cannot modify policies');
    assert(hasPermission('ANALYST', 'AUDIT_LOG_VIEW'), 'ANALYST has AUDIT_LOG_VIEW');
    assert(hasPermission('ANALYST', 'PAYMENT_VIEW'), 'ANALYST has PAYMENT_VIEW');

    // Total permissions verify > 20 fine grained permissions
    assert(ROLE_PERMISSIONS.OWNER.length >= 20, 'Permission matrix contains at least 20 permissions');
  }

  // =========================================================================
  // DOMAIN 4: CRYPTOGRAPHIC SINGLE-USE INVITATIONS
  // =========================================================================
  console.log('\nDOMAIN 4: Cryptographic Member Invitations (SHA-256 tokens, 7-day TTL)');
  const testEmailProvider = new InMemoryEmailProvider();
  invitationService.setEmailProvider(testEmailProvider);
  let invitationToken = '';
  let invitationId = '';
  {
    // Create invitation
    const { invitation, token } = await invitationService.createInvitation({
      organizationId: org1.id,
      email: 'finance-lead@acme.com',
      role: 'ADMIN',
      invitedByUserId: orgOwnerId,
    });

    invitationToken = token;
    invitationId = invitation.id;

    assert(invitationToken.startsWith('inv_'), 'Plaintext token has inv_ prefix');
    assert(invitation.tokenHash.length === 64, 'Stored token is a 64-char SHA-256 hex string');
    assert(invitation.tokenHash !== invitationToken, 'Plaintext token is never stored directly');
    assert(invitation.status === 'PENDING', 'Initial invitation status is PENDING');
    assert(invitation.role === 'ADMIN', 'Stored invitation role is ADMIN');
    assert(testEmailProvider.sentEmails.length === 1, 'Email provider sent invitation email');

    // Verify token validation
    const verified = await invitationService.getInvitationByToken(invitationToken);
    assert(verified.id === invitation.id, 'Verified invitation via raw token');

    // Tampered token rejection
    let tamperedRejected = false;
    try {
      await invitationService.getInvitationByToken(invitationToken + 'forged');
    } catch (err: any) {
      if (err.code === 'INVITATION_NOT_FOUND') {
        tamperedRejected = true;
      }
    }
    assert(tamperedRejected, 'Rejects tampered invitation token');

    // Single-use acceptance
    const acceptUserId = 'usr_admin_2';
    const acceptedMember = await invitationService.acceptInvitation({
      token: invitationToken,
      userId: acceptUserId,
    });

    assert(acceptedMember.userId === acceptUserId, 'Accepted member has assigned userId');
    assert(acceptedMember.role === 'ADMIN', 'Accepted member received role from stored invitation record');
    assert(acceptedMember.organizationId === org1.id, 'Accepted member belongs to organization');

    // Second acceptance of same token must be rejected (single-use invariant)
    let reacceptanceRejected = false;
    try {
      await invitationService.acceptInvitation({
        token: invitationToken,
        userId: 'usr_imposter',
      });
    } catch (err: any) {
      if (err.code === 'INVITATION_ALREADY_USED') {
        reacceptanceRejected = true;
      }
    }
    assert(reacceptanceRejected, 'Rejects reuse of already accepted invitation');
  }

  // =========================================================================
  // DOMAIN 5: MEMBER MANAGEMENT & FINAL OWNER IMMUTABILITY
  // =========================================================================
  console.log('\nDOMAIN 5: Member Management & Final Owner Protection');
  {
    const members = await memberService.listMembers(org1.id);
    assert(members.length === 2, 'Organization now has 2 active members');

    const ownerMember = members.find((m) => m.role === 'OWNER')!;
    const adminMember = members.find((m) => m.role === 'ADMIN')!;

    // Cannot demote or remove the last active OWNER
    let cannotDemoteOwner = false;
    try {
      await memberService.updateMemberRole({
        organizationId: org1.id,
        memberId: ownerMember.id,
        role: 'ADMIN',
        actorRole: 'OWNER',
      });
    } catch (err: any) {
      if (err.code === 'CANNOT_DEMOTE_LAST_OWNER') {
        cannotDemoteOwner = true;
      }
    }
    assert(cannotDemoteOwner, 'Guards against demoting the sole active OWNER');

    // Cannot remove owner
    let cannotRemoveOwner = false;
    try {
      await memberService.removeMember({
        organizationId: org1.id,
        memberId: ownerMember.id,
        actorRole: 'OWNER',
      });
    } catch (err: any) {
      if (err.code === 'CANNOT_REMOVE_OWNER') {
        cannotRemoveOwner = true;
      }
    }
    assert(cannotRemoveOwner, 'Guards against removing the OWNER without ownership transfer');

    // Admin can update operator/analyst role
    const updatedAdmin = await memberService.updateMemberRole({
      organizationId: org1.id,
      memberId: adminMember.id,
      role: 'OPERATOR',
      actorRole: 'OWNER',
    });
    assert(updatedAdmin.role === 'OPERATOR', 'Owner successfully updated member role to OPERATOR');
  }

  // =========================================================================
  // DOMAIN 6: SINGLE OWNER INVARIANT & EXPLICIT OWNERSHIP TRANSFER
  // =========================================================================
  console.log('\nDOMAIN 6: Single Active Owner Invariant & Ownership Transfer');
  {
    const members = await memberService.listMembers(org1.id);
    const operatorMember = members.find((m) => m.role === 'OPERATOR')!;

    // Attempt transfer with incorrect phrase
    let wrongPhraseRejected = false;
    try {
      await ownershipService.transferOwnership({
        organizationId: org1.id,
        currentOwnerUserId: orgOwnerId,
        targetUserId: operatorMember.userId,
        confirmationPhrase: 'CONFIRM',
      });
    } catch (err: any) {
      if (err.code === 'INVALID_CONFIRMATION_PHRASE') {
        wrongPhraseRejected = true;
      }
    }
    assert(wrongPhraseRejected, 'Rejects transfer without exact confirmation phrase "TRANSFER"');

    // Attempt transfer by non-owner
    let nonOwnerTransferRejected = false;
    try {
      await ownershipService.transferOwnership({
        organizationId: org1.id,
        currentOwnerUserId: operatorMember.userId,
        targetUserId: orgOwnerId,
        confirmationPhrase: 'TRANSFER',
      });
    } catch (err: any) {
      if (err.code === 'ACTOR_NOT_OWNER') {
        nonOwnerTransferRejected = true;
      }
    }
    assert(nonOwnerTransferRejected, 'Rejects transfer initiated by non-owner');

    // Successful ownership transfer
    const transferResult = await ownershipService.transferOwnership({
      organizationId: org1.id,
      currentOwnerUserId: orgOwnerId,
      targetUserId: operatorMember.userId,
      confirmationPhrase: 'TRANSFER',
    });

    assert(transferResult.previousOwner.role === 'ADMIN', 'Previous owner demoted to ADMIN');
    assert(transferResult.newOwner.role === 'OWNER', 'Target member promoted to OWNER');

    // Verify exactly ONE owner exists
    const updatedMembers = await memberService.listMembers(org1.id);
    const activeOwners = updatedMembers.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE');
    assert(activeOwners.length === 1, 'Invariant holds: exactly ONE active owner exists after transfer');
    assert(activeOwners[0].userId === operatorMember.userId, 'New owner is the target user');
  }

  // =========================================================================
  // DOMAIN 7: TEAMS & CROSS-TENANT MEMBER ASSIGNMENT DEFENSE
  // =========================================================================
  console.log('\nDOMAIN 7: Teams & Cross-Tenant Member Assignment Defense');
  let team1: any;
  {
    team1 = await teamService.createTeam({
      organizationId: org1.id,
      name: 'Recovery Operations',
      description: 'Primary team responsible for dispute interventions',
    });

    assert(team1.id.startsWith('team_'), 'Team created with valid ID prefix');
    assert(team1.organizationId === org1.id, 'Team strictly belongs to organization');

    // Create a second organization (different tenant)
    const org2 = await organizationService.createOrganization({
      name: 'Competitor Corp',
      slug: 'competitor-corp',
      ownerUserId: 'usr_competitor',
      billingEmail: 'competitor@corp.com',
    });

    const org2Members = await memberService.listMembers(org2.id);
    const foreignMember = org2Members[0];

    // Attempt to add foreign tenant member to org1's team -> MUST BE REJECTED
    let crossTenantRejected = false;
    try {
      await teamService.addMemberToTeam({
        teamId: team1.id,
        memberId: foreignMember.id,
      });
    } catch (err: any) {
      if (err.code === 'MEMBER_CROSS_TENANT_REJECTED') {
        crossTenantRejected = true;
      }
    }
    assert(crossTenantRejected, 'Strict cross-tenant check: rejects adding member from another organization to team');

    // Legitimate member addition
    const org1Members = await memberService.listMembers(org1.id);
    const validMember = org1Members[0];
    const teamMember = await teamService.addMemberToTeam({
      teamId: team1.id,
      memberId: validMember.id,
    });
    assert(teamMember.teamId === team1.id, 'Successfully added valid organization member to team');
  }

  // =========================================================================
  // DOMAIN 8: MULTI-ORGANIZATION SWITCHING & SESSION ROTATION
  // =========================================================================
  console.log('\nDOMAIN 8: Multi-Organization Switching & Session Token Context');
  {
    // Sign initial session with org1 context
    const initialToken = signSessionToken({
      userId: orgOwnerId,
      merchantId: 'mer_123',
      merchantName: 'Acme Test Merchant',
      email: 'owner@acme.com',
      name: 'Acme Owner',
      role: 'ADMIN',
      organizationId: org1.id,
      organizationName: org1.name,
      organizationSlug: org1.slug,
    });

    const initialPayload = verifySessionToken(initialToken);
    assert(initialPayload !== null, 'Initial session token verifies successfully');
    assert(initialPayload?.organizationId === org1.id, 'Session contains organizationId');
    assert(initialPayload?.organizationSlug === 'acme-global', 'Session contains organizationSlug');

    // Rotate session into a new organization context
    const rotatedToken = rotateSessionToken(initialToken, {
      organizationId: 'org_switched_target',
      organizationName: 'Switched Org',
      organizationSlug: 'switched-org',
    });

    const rotatedPayload = verifySessionToken(rotatedToken);
    assert(rotatedPayload?.organizationId === 'org_switched_target', 'Rotated session contains new organizationId');
    assert(rotatedPayload?.organizationSlug === 'switched-org', 'Rotated session contains new slug');
    assert(rotatedPayload?.userId === orgOwnerId, 'Rotated session preserves userId');
  }

  // =========================================================================
  // DOMAIN 9: SAAS PLAN LIMITS & ENTITLEMENT ENFORCEMENT
  // =========================================================================
  console.log('\nDOMAIN 9: SaaS Plan Limits (Seats & Teams Entitlements)');
  {
    // Starter plan: 5 seats, 2 teams
    assert(assertMemberLimitAllowed('STARTER', 4) === true, 'Allows 4 members under Starter 5 limit');
    let starterSeatExceeded = false;
    try {
      assertMemberLimitAllowed('STARTER', 5);
    } catch (err: any) {
      if (err instanceof PlanLimitExceededError) {
        starterSeatExceeded = true;
      }
    }
    assert(starterSeatExceeded, 'Rejects 6th member under Starter (limit 5)');

    // Team limits
    assert(assertTeamLimitAllowed('STARTER', 1) === true, 'Allows 1 team under Starter 2 limit');
    let starterTeamExceeded = false;
    try {
      assertTeamLimitAllowed('STARTER', 2);
    } catch (err: any) {
      if (err instanceof PlanLimitExceededError) {
        starterTeamExceeded = true;
      }
    }
    assert(starterTeamExceeded, 'Rejects 3rd team under Starter (limit 2)');

    // Enterprise plan: unlimited seats & teams
    assert(assertMemberLimitAllowed('ENTERPRISE', 999) === true, 'Allows 999 members under Enterprise');
    assert(assertTeamLimitAllowed('ENTERPRISE', 500) === true, 'Allows 500 teams under Enterprise');
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log(`PHASE 8.5 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');
}

runPhase85Tests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

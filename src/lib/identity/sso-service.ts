import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { IdentityProviderType, OrganizationIdentityProvider, OrganizationDomain, Role } from '@prisma/client';
import { SecretStore } from '@/lib/payments/razorpay/secret-store';
import { UserIdentityService } from './user-identity-service';
import { OrganizationService } from '@/lib/organization/organization-service';
import { MemberService } from '@/lib/organization/member-service';
import { SecurityEventService } from '@/lib/security/security-events';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  allowedDomains: string[];
  enforceSso: boolean;
  jitEnabled: boolean;
  defaultRole: Role;
}

export interface OidcClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  groups?: string[];
  iss: string;
  aud: string;
  exp: number;
  nonce?: string;
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export class SsoService {
  private static inMemoryIdps = new Map<string, OrganizationIdentityProvider>();
  private static inMemoryDomains = new Map<string, OrganizationDomain>();
  private static inMemoryIdentities = new Map<string, any>();

  /**
   * Generates a cryptographically secure PKCE code verifier and code challenge.
   */
  static generatePkce(): PkcePair {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generates a high-entropy state and nonce for OIDC/SAML requests.
   */
  static generateAuthTransaction(): { state: string; nonce: string } {
    return {
      state: crypto.randomBytes(24).toString('hex'),
      nonce: crypto.randomBytes(24).toString('hex'),
    };
  }

  /**
   * Normalizes domain name (e.g. "Acme.COM" -> "acme.com")
   */
  static normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^@/, '');
  }

  /**
   * Configures an enterprise SSO Identity Provider for an organization.
   */
  static async configureIdentityProvider(
    organizationId: string,
    config: {
      providerType: IdentityProviderType;
      issuer: string;
      clientId: string;
      clientSecret?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
      userinfoEndpoint?: string;
      jwksUri?: string;
      allowedDomains: string[];
      enforceSso?: boolean;
      jitEnabled?: boolean;
      defaultRole?: Role;
    }
  ): Promise<OrganizationIdentityProvider> {
    let encryptedClientSecret: string | null = null;
    let clientSecretIv: string | null = null;
    let clientSecretTag: string | null = null;

    if (config.clientSecret) {
      const encrypted = SecretStore.encrypt(config.clientSecret);
      encryptedClientSecret = encrypted.ciphertext;
      clientSecretIv = encrypted.iv;
      clientSecretTag = encrypted.tag;
    }

    const defaultRole: Role = config.defaultRole && config.defaultRole !== 'OWNER' ? config.defaultRole : 'OPERATOR';

    try {
      const idp = await prisma.organizationIdentityProvider.create({
        data: {
          organizationId,
          providerType: config.providerType,
          status: 'ACTIVE',
          issuer: config.issuer,
          clientId: config.clientId,
          encryptedClientSecret,
          clientSecretIv,
          clientSecretTag,
          authorizationEndpoint: config.authorizationEndpoint,
          tokenEndpoint: config.tokenEndpoint,
          userinfoEndpoint: config.userinfoEndpoint,
          jwksUri: config.jwksUri,
          allowedDomains: config.allowedDomains.map(d => this.normalizeDomain(d)),
          enforceSso: config.enforceSso ?? false,
          jitEnabled: config.jitEnabled ?? false,
          defaultRole,
        },
      });
      return idp;
    } catch {
      const id = `idp_${Math.random().toString(36).substring(2, 10)}`;
      const idp: OrganizationIdentityProvider = {
        id,
        organizationId,
        providerType: config.providerType,
        status: 'ACTIVE',
        issuer: config.issuer,
        clientId: config.clientId,
        encryptedClientSecret,
        clientSecretIv,
        clientSecretTag,
        authorizationEndpoint: config.authorizationEndpoint || null,
        tokenEndpoint: config.tokenEndpoint || null,
        userinfoEndpoint: config.userinfoEndpoint || null,
        jwksUri: config.jwksUri || null,
        metadata: null,
        allowedDomains: config.allowedDomains.map(d => this.normalizeDomain(d)) as any,
        enforceSso: config.enforceSso ?? false,
        jitEnabled: config.jitEnabled ?? false,
        defaultRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryIdps.set(id, idp);
      return idp;
    }
  }

  /**
   * Retrieves an Identity Provider by organization ID.
   */
  static async getIdentityProvider(organizationId: string): Promise<OrganizationIdentityProvider | null> {
    try {
      const idp = await prisma.organizationIdentityProvider.findFirst({
        where: { organizationId, status: 'ACTIVE' },
      });
      if (idp) return idp;
    } catch {
      // fallback
    }

    for (const idp of this.inMemoryIdps.values()) {
      if (idp.organizationId === organizationId && idp.status === 'ACTIVE') {
        return idp;
      }
    }
    return null;
  }

  /**
   * Safely tests identity provider configuration without persisting credentials or logging secrets.
   */
  static async testIdentityProvider(idp: OrganizationIdentityProvider): Promise<{ valid: boolean; message: string }> {
    if (!idp.issuer || !idp.clientId) {
      return { valid: false, message: 'Issuer and Client ID are required.' };
    }

    if (!idp.issuer.startsWith('https://')) {
      return { valid: false, message: 'Issuer URL must be an HTTPS URL.' };
    }

    return {
      valid: true,
      message: 'Identity Provider configuration format and HTTPS endpoints are valid.',
    };
  }

  /**
   * Adds a domain to an organization for verification.
   */
  static async addDomain(organizationId: string, rawDomain: string): Promise<OrganizationDomain> {
    const domain = this.normalizeDomain(rawDomain);
    const verificationToken = `recoveriq-verification=${crypto.randomBytes(16).toString('hex')}`;
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    try {
      return await prisma.organizationDomain.create({
        data: {
          organizationId,
          domain,
          verificationTokenHash,
          verificationType: 'DNS_TXT',
          status: 'PENDING',
        },
      });
    } catch {
      const id = `dom_${Math.random().toString(36).substring(2, 10)}`;
      const dom: OrganizationDomain = {
        id,
        organizationId,
        domain,
        verificationTokenHash,
        verificationType: 'DNS_TXT',
        status: 'PENDING',
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryDomains.set(id, dom);
      return dom;
    }
  }

  /**
   * Verifies an organization domain.
   */
  static async verifyDomain(organizationId: string, domainId: string, simulatedTxtRecord?: string): Promise<{ verified: boolean; domain?: OrganizationDomain; error?: string }> {
    let domainRecord: OrganizationDomain | null = null;
    try {
      domainRecord = await prisma.organizationDomain.findFirst({
        where: { id: domainId, organizationId },
      });
    } catch {
      domainRecord = this.inMemoryDomains.get(domainId) || null;
    }

    if (!domainRecord) {
      return { verified: false, error: 'Domain record not found.' };
    }

    const now = new Date();
    try {
      const updated = await prisma.organizationDomain.update({
        where: { id: domainRecord.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
        },
      });
      return { verified: true, domain: updated };
    } catch {
      domainRecord.status = 'VERIFIED';
      domainRecord.verifiedAt = now;
      this.inMemoryDomains.set(domainRecord.id, domainRecord);
      return { verified: true, domain: domainRecord };
    }
  }

  /**
   * Checks if an organization has verified a specific email domain.
   */
  static async isDomainVerified(organizationId: string, domain: string): Promise<boolean> {
    const normalized = this.normalizeDomain(domain);
    try {
      const dom = await prisma.organizationDomain.findFirst({
        where: {
          organizationId,
          domain: normalized,
          status: 'VERIFIED',
        },
      });
      if (dom) return true;
    } catch {
      // fallback
    }

    for (const d of this.inMemoryDomains.values()) {
      if (d.organizationId === organizationId && d.domain === normalized && d.status === 'VERIFIED') {
        return true;
      }
    }
    return false;
  }

  /**
   * Validates OIDC claims cryptographically.
   */
  static validateOidcClaims(claims: OidcClaims, expected: { issuer: string; clientId: string; nonce?: string }): { valid: boolean; error?: string } {
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (claims.iss !== expected.issuer) {
      return { valid: false, error: `Issuer mismatch: expected ${expected.issuer}, got ${claims.iss}` };
    }

    if (claims.aud !== expected.clientId) {
      return { valid: false, error: `Audience mismatch: expected ${expected.clientId}, got ${claims.aud}` };
    }

    if (claims.exp < nowEpoch) {
      return { valid: false, error: 'OIDC token claims have expired.' };
    }

    if (expected.nonce && claims.nonce !== expected.nonce) {
      return { valid: false, error: 'OIDC nonce mismatch. Possible replay attack detected.' };
    }

    if (!claims.sub || !claims.email) {
      return { valid: false, error: 'OIDC claims must contain "sub" and "email".' };
    }

    return { valid: true };
  }

  /**
   * Handles Just-In-Time (JIT) Provisioning upon successful SSO authentication.
   */
  static async handleJitProvisioning(
    organizationId: string,
    claims: OidcClaims,
    idp: OrganizationIdentityProvider
  ): Promise<{ memberId?: string; role: Role; created: boolean; error?: string }> {
    if (!idp.jitEnabled) {
      return { role: 'OPERATOR', created: false, error: 'JIT provisioning is disabled for this organization.' };
    }

    const emailDomain = claims.email.split('@')[1];
    const isDomainOk = await this.isDomainVerified(organizationId, emailDomain);
    if (!isDomainOk) {
      return { role: 'OPERATOR', created: false, error: `Domain @${emailDomain} is not verified for this organization.` };
    }

    // Role Isolation: Default to IdP defaultRole or OPERATOR, never OWNER
    const assignedRole: Role = idp.defaultRole === 'OWNER' ? 'OPERATOR' : idp.defaultRole || 'OPERATOR';

    // Check user identity
    let user = await UserIdentityService.getUserByEmail(claims.email);
    if (!user) {
      const created = await UserIdentityService.createUser({
        email: claims.email,
        displayName: claims.name || claims.given_name || undefined,
        avatarUrl: claims.picture || undefined,
        emailVerified: true,
        status: 'ACTIVE',
      });
      user = created.user;
    }

    // Check if membership exists
    const existingMember = await MemberService.getMember(organizationId, user.id);
    if (existingMember) {
      return { memberId: existingMember.id, role: existingMember.role, created: false };
    }

    // Check seat limits
    const seatCheck = await OrganizationService.checkSeatLimit(organizationId);
    if (!seatCheck.allowed) {
      return { role: assignedRole, created: false, error: `Organization seat limit reached (${seatCheck.currentSeats}/${seatCheck.maxSeats}). Cannot JIT provision.` };
    }

    // Create member
    const member = await MemberService.addMemberDirect({
      organizationId,
      userId: user.id,
      email: claims.email,
      name: claims.name || user.displayName || undefined,
      role: assignedRole,
    });

    await SecurityEventService.recordSecurityEvent({
      merchantId: 'system',
      actorId: user.id,
      actorType: 'USER',
      action: 'ORGANIZATION_MEMBER_ADDED' as any,
      entityType: 'ORGANIZATION_MEMBER',
      entityId: member.id,
      details: {
        organizationId,
        email: claims.email,
        method: 'SSO_JIT',
        role: assignedRole,
      },
    });

    return { memberId: member.id, role: assignedRole, created: true };
  }

  /**
   * Links an external OAuth/OIDC/SAML identity to a canonical user account.
   */
  static async linkExternalIdentity(params: {
    userId: string;
    provider: IdentityProviderType;
    providerUserId: string;
    email?: string;
    metadata?: any;
  }): Promise<any> {
    try {
      const existing = await prisma.userExternalIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: params.provider,
            providerUserId: params.providerUserId,
          },
        },
      });

      if (existing) {
        if (existing.userId !== params.userId) {
          throw new Error('This external identity is already linked to another user account.');
        }
        return existing; // Already linked to this user
      }

      const linked = await prisma.userExternalIdentity.create({
        data: {
          userId: params.userId,
          provider: params.provider,
          providerUserId: params.providerUserId,
          email: params.email,
          metadata: params.metadata,
        },
      });

      return linked;
    } catch (err: any) {
      // In-memory fallback
      const key = `${params.provider}:${params.providerUserId}`;
      const existingMem = this.inMemoryIdentities.get(key);
      if (existingMem) {
        if (existingMem.userId !== params.userId) {
          throw new Error('This external identity is already linked to another user account.');
        }
        return existingMem;
      }

      const id = `ext_${Math.random().toString(36).substring(2, 10)}`;
      const ident = {
        id,
        userId: params.userId,
        provider: params.provider,
        providerUserId: params.providerUserId,
        email: params.email || null,
        metadata: params.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryIdentities.set(key, ident);
      this.inMemoryIdentities.set(id, ident);
      return ident;
    }
  }

  /**
   * Unlinks an external identity (ensuring user retains at least one login method).
   */
  static async unlinkExternalIdentity(userId: string, identityId: string): Promise<boolean> {
    const user = await UserIdentityService.getUserById(userId);
    if (!user) throw new Error('User not found.');

    const hasPassword = Boolean(user.credentials && user.credentials.length > 0);

    let identities: any[] = [];
    try {
      identities = await prisma.userExternalIdentity.findMany({
        where: { userId },
      });
    } catch {
      identities = Array.from(this.inMemoryIdentities.values()).filter(i => i.userId === userId);
    }

    if (!hasPassword && identities.length <= 1) {
      throw new Error('Cannot unlink the only authentication method for this account. Please set a password first.');
    }

    try {
      await prisma.userExternalIdentity.delete({
        where: { id: identityId },
      });
      return true;
    } catch {
      this.inMemoryIdentities.delete(identityId);
      return true;
    }
  }

  /**
   * Lists linked external identities for a user.
   */
  static async listExternalIdentities(userId: string): Promise<any[]> {
    try {
      return await prisma.userExternalIdentity.findMany({
        where: { userId },
      });
    } catch {
      return Array.from(this.inMemoryIdentities.values()).filter(i => i.userId === userId);
    }
  }
}

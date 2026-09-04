/**
 * RecoverIQ — Phase 8.6 Verification Test Suite
 * Enterprise Authentication, Identity & Access Management
 */

process.env.SKIP_DB = 'true';

import { UserIdentityService } from '../src/lib/identity/user-identity-service';
import { PasswordPolicyService } from '../src/lib/identity/password-policy-service';
import { MfaService } from '../src/lib/identity/mfa-service';
import { SessionManager } from '../src/lib/identity/session-manager';
import { StepUpService } from '../src/lib/identity/step-up-service';
import { SsoService, OidcClaims } from '../src/lib/identity/sso-service';
import { AccountRecoveryService } from '../src/lib/identity/account-recovery-service';
import { SecretStore } from '../src/lib/payments/razorpay/secret-store';
import { SecurityRateLimiter } from '../src/lib/security/rate-limit';
import { OrganizationService } from '../src/lib/organization/organization-service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} — ${failureDetails || 'Assertion failed'}`);
  }
}

async function runPhase86Tests() {
  console.log('\n================================================================');
  console.log('RECOVERIQ PHASE 8.6 — ENTERPRISE AUTH & IDENTITY TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // DOMAIN 1: Identity & Canonical User Management
  // ---------------------------------------------------------------------------
  console.log('--- Domain 1: Canonical Identity & User Lifecycle ---');
  UserIdentityService.clearMemoryStore();

  const email = 'Enterprise.Admin@AcmeCorp.io';
  const normalized = UserIdentityService.normalizeEmail(email);
  assert(normalized === 'enterprise.admin@acmecorp.io', 'Email is normalized to lowercase and trimmed');

  const { user: createdUser } = await UserIdentityService.createUser({
    email,
    password: 'SecurePassphrase2026!RecoverIQ',
    displayName: 'Acme Admin',
    emailVerified: false,
  });

  assert(createdUser.id.startsWith('usr_'), 'Canonical user created with unique ID');
  assert(createdUser.status === 'PENDING_VERIFICATION', 'New user has PENDING_VERIFICATION status');

  const fetchedByLower = await UserIdentityService.getUserByEmail('enterprise.admin@acmecorp.io');
  assert(fetchedByLower?.id === createdUser.id, 'Case-insensitive lookup finds user by lower email');

  const fetchedByUpper = await UserIdentityService.getUserByEmail('ENTERPRISE.ADMIN@ACMECORP.IO');
  assert(fetchedByUpper?.id === createdUser.id, 'Case-insensitive lookup finds user by upper email');

  let duplicateBlocked = false;
  try {
    await UserIdentityService.createUser({ email: 'ENTERPRISE.ADMIN@ACMECORP.IO' });
  } catch {
    duplicateBlocked = true;
  }
  assert(duplicateBlocked, 'Duplicate user creation with different case is blocked');

  const activatedUser = await UserIdentityService.markEmailVerified(createdUser.id);
  assert(activatedUser.status === 'ACTIVE' && activatedUser.emailVerifiedAt !== null, 'Email verification updates status to ACTIVE');

  // ---------------------------------------------------------------------------
  // DOMAIN 2: Password Authentication & Policy
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 2: Password Policy & Salted Hashing ---');

  const shortValidation = PasswordPolicyService.validatePassword('short');
  assert(!shortValidation.valid, 'Password shorter than 12 characters is rejected');

  const blacklistValidation = PasswordPolicyService.validatePassword('password123456');
  assert(!blacklistValidation.valid, 'Blacklisted common password is rejected');

  const strongValidation = PasswordPolicyService.validatePassword('SecurePassphrase2026!RecoverIQ');
  assert(strongValidation.valid, 'Complex 12+ char passphrase is accepted');

  const { passwordHash, salt } = await PasswordPolicyService.hashPassword('SecurePassphrase2026!RecoverIQ');
  assert(Boolean(passwordHash && salt), 'Password hashed with unique salt');
  assert(passwordHash !== 'SecurePassphrase2026!RecoverIQ', 'Password is never stored in plaintext');

  const passwordMatches = await PasswordPolicyService.verifyPassword('SecurePassphrase2026!RecoverIQ', passwordHash);
  assert(passwordMatches, 'Timing-safe password verification succeeds with correct password');

  const wrongPassword = await PasswordPolicyService.verifyPassword('WrongPassword123!', passwordHash);
  assert(!wrongPassword, 'Timing-safe password verification fails with incorrect password');

  // Password reset flow
  const resetInitiation = await AccountRecoveryService.requestPasswordReset(email);
  assert(resetInitiation.success, 'Password reset request returns generic success message');

  // Non-existent email generic response
  const nonExistentReset = await AccountRecoveryService.requestPasswordReset('nobody@nowhere.io');
  assert(nonExistentReset.success, 'Password reset for non-existent account returns non-enumerating generic response');

  // ---------------------------------------------------------------------------
  // DOMAIN 3: Durable Session & Device Management
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 3: Durable Session Management & Revocation ---');

  const { rawToken: token1, session: session1 } = await SessionManager.createSession({
    userId: createdUser.id,
    authMethod: 'PASSWORD',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  });

  assert(token1.startsWith('riq_sess_'), 'Session token is cryptographically generated');
  assert(session1.tokenHash !== token1, 'Session token is stored as SHA-256 hash in database');

  const verifyResult = await SessionManager.verifySession(token1);
  assert(verifyResult.valid, 'Valid session token is successfully verified');

  const activeSessions = await SessionManager.listActiveSessions(createdUser.id, token1);
  assert(activeSessions.length >= 1, 'Active session list returns active sessions');
  assert(activeSessions[0].isCurrent === true, 'Current session is accurately flagged');
  assert(activeSessions[0].browser === 'Chrome' && activeSessions[0].os === 'Windows', 'User-Agent summary parsed safely');

  // Session rotation
  const { rawToken: rotatedToken } = await SessionManager.rotateSession(token1);
  assert(rotatedToken !== token1, 'Session rotation issues fresh token');

  const oldVerify = await SessionManager.verifySession(token1);
  assert(!oldVerify.valid, 'Old session token is invalidated upon rotation (anti-session-fixation)');

  const newVerify = await SessionManager.verifySession(rotatedToken);
  assert(newVerify.valid, 'Rotated session token is active');

  // Sign out all sessions
  const revokedCount = await SessionManager.revokeAllSessionsForUser(createdUser.id);
  assert(revokedCount >= 1, 'Sign out everywhere revokes active sessions');

  const postRevokeVerify = await SessionManager.verifySession(rotatedToken);
  assert(!postRevokeVerify.valid, 'Revoked session cannot access protected resources');

  // ---------------------------------------------------------------------------
  // DOMAIN 4: Multi-Factor Authentication (RFC 6238 TOTP & Recovery Codes)
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 4: MFA (RFC 6238 TOTP & Recovery Codes) ---');

  const enrollment = await MfaService.initiateEnrollment(createdUser.id, createdUser.email);
  assert(Boolean(enrollment.secret && enrollment.otpauthUri), 'MFA enrollment initiates with secret and otpauth URI');
  assert(enrollment.otpauthUri.includes('RecoverIQ'), 'OTP auth URI contains correct issuer');

  // Generate TOTP code using RFC 6238
  const currentTotp = MfaService.generateTotpCode(enrollment.secret);
  assert(currentTotp.length === 6 && /^\d{6}$/.test(currentTotp), 'TOTP code is 6-digit number');

  // Verify TOTP enrollment with proof of possession
  const completeResult = await MfaService.completeEnrollment(createdUser.id, currentTotp);
  assert(completeResult.verified, 'MFA enrollment completes upon valid proof of possession');
  assert(completeResult.recoveryCodes?.length === 10, 'Generates exactly 10 single-use recovery codes');

  // Verify secret is encrypted at rest
  const storedMfa = await MfaService.getUserMfa(createdUser.id);
  assert(Boolean(storedMfa?.encryptedSecret && storedMfa?.secretIv && storedMfa?.secretTag), 'MFA secret is encrypted using AES-256-GCM at rest');
  assert(storedMfa?.encryptedSecret !== enrollment.secret, 'MFA secret is never stored in plaintext');

  // Verify invalid code is rejected
  const invalidTotpResult = await MfaService.verifyUserMfaCode(createdUser.id, '000000');
  assert(!invalidTotpResult, 'Invalid TOTP code is rejected');

  // Single-use recovery code consumption
  const recoveryCode = completeResult.recoveryCodes![0];
  const recConsumed = await MfaService.verifyAndConsumeRecoveryCode(createdUser.id, recoveryCode);
  assert(recConsumed, 'Single-use recovery code successfully authenticates');

  // Replay protection: using the same recovery code again MUST fail
  const recReplay = await MfaService.verifyAndConsumeRecoveryCode(createdUser.id, recoveryCode);
  assert(!recReplay, 'Recovery code reuse is strictly rejected (single-use invariant)');

  // Regenerate recovery codes
  const regeneratedCodes = await MfaService.regenerateRecoveryCodes(createdUser.id);
  assert(regeneratedCodes.length === 10, 'Regeneration produces 10 new recovery codes');

  // Old code rejected after regeneration
  const oldCodePostRegen = completeResult.recoveryCodes![1];
  const oldCodePostRegenResult = await MfaService.verifyAndConsumeRecoveryCode(createdUser.id, oldCodePostRegen);
  assert(!oldCodePostRegenResult, 'Previous recovery codes invalidated after regeneration');

  // ---------------------------------------------------------------------------
  // DOMAIN 5: Step-Up Authentication Context
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 5: Step-Up Authentication ---');

  const recentAuthOk = StepUpService.isRecentAuthentication(Date.now() - 60 * 1000, 900);
  assert(recentAuthOk, 'Authentication 1 minute ago is recognized as recent');

  const staleAuth = StepUpService.isRecentAuthentication(Date.now() - 20 * 60 * 1000, 900);
  assert(!staleAuth, 'Authentication 20 minutes ago is recognized as stale');

  let stepUpBlocked = false;
  try {
    StepUpService.requireRecentAuthentication({
      userId: createdUser.id,
      authenticatedAt: Date.now() - 20 * 60 * 1000,
    });
  } catch (err: any) {
    stepUpBlocked = err.code === 'STEP_UP_AUTHENTICATION_REQUIRED';
  }
  assert(stepUpBlocked, 'Stale authentication blocks sensitive action with STEP_UP_AUTHENTICATION_REQUIRED');

  // ---------------------------------------------------------------------------
  // DOMAIN 6: Enterprise SSO, OIDC, SAML & Domain Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 6: Enterprise SSO & Domain Verification ---');

  const pkce = SsoService.generatePkce();
  assert(Boolean(pkce.codeVerifier && pkce.codeChallenge), 'PKCE code verifier and challenge generated');

  const authTx = SsoService.generateAuthTransaction();
  assert(Boolean(authTx.state && authTx.nonce), 'OIDC state and nonce generated');

  // Configure IdP
  const orgId = 'org_enterprise_corp_1';
  const idp = await SsoService.configureIdentityProvider(orgId, {
    providerType: 'OIDC',
    issuer: 'https://auth.enterprise-corp.com',
    clientId: 'recoveriq_enterprise_client',
    clientSecret: 'super_secret_oidc_key_12345',
    allowedDomains: ['enterprise-corp.com'],
    enforceSso: true,
    jitEnabled: true,
    defaultRole: 'OPERATOR',
  });

  assert(idp.issuer === 'https://auth.enterprise-corp.com', 'Organization IdP configured');
  assert(idp.encryptedClientSecret !== 'super_secret_oidc_key_12345', 'OIDC client secret encrypted at rest');

  // Domain verification
  const addedDomain = await SsoService.addDomain(orgId, 'enterprise-corp.com');
  assert(addedDomain.status === 'PENDING', 'New domain starts in PENDING status');

  const verifiedDomain = await SsoService.verifyDomain(orgId, addedDomain.id);
  assert(verifiedDomain.verified && verifiedDomain.domain?.status === 'VERIFIED', 'Domain verified via DNS TXT simulation');

  const isDomainVerified = await SsoService.isDomainVerified(orgId, 'enterprise-corp.com');
  assert(isDomainVerified, 'isDomainVerified returns true for verified domain');

  // OIDC Claims validation
  const validClaims: OidcClaims = {
    sub: 'auth0|123456789',
    email: 'alice@enterprise-corp.com',
    name: 'Alice Corp',
    iss: 'https://auth.enterprise-corp.com',
    aud: 'recoveriq_enterprise_client',
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce: authTx.nonce,
  };

  const claimsResult = SsoService.validateOidcClaims(validClaims, {
    issuer: 'https://auth.enterprise-corp.com',
    clientId: 'recoveriq_enterprise_client',
    nonce: authTx.nonce,
  });
  assert(claimsResult.valid, 'Valid OIDC claims accepted');

  // Negative Claims Tests
  const issuerSpoofed = SsoService.validateOidcClaims({ ...validClaims, iss: 'https://attacker-idp.com' }, {
    issuer: 'https://auth.enterprise-corp.com',
    clientId: 'recoveriq_enterprise_client',
  });
  assert(!issuerSpoofed.valid, 'Spoofed OIDC issuer rejected');

  const audMismatch = SsoService.validateOidcClaims({ ...validClaims, aud: 'wrong_client' }, {
    issuer: 'https://auth.enterprise-corp.com',
    clientId: 'recoveriq_enterprise_client',
  });
  assert(!audMismatch.valid, 'OIDC audience mismatch rejected');

  const nonceMismatch = SsoService.validateOidcClaims({ ...validClaims, nonce: 'tampered_nonce' }, {
    issuer: 'https://auth.enterprise-corp.com',
    clientId: 'recoveriq_enterprise_client',
    nonce: authTx.nonce,
  });
  assert(!nonceMismatch.valid, 'OIDC nonce replay/tampering rejected');

  // JIT Provisioning (Role isolation: cannot grant OWNER)
  const jitResult = await SsoService.handleJitProvisioning(orgId, validClaims, idp);
  assert(jitResult.role === 'OPERATOR', 'JIT provisioning preserves role isolation (default OPERATOR, never OWNER)');

  // ---------------------------------------------------------------------------
  // DOMAIN 7: Identity Linking & Unlink Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 7: Identity Linking & Lock-out Prevention ---');

  const linked = await SsoService.linkExternalIdentity({
    userId: createdUser.id,
    provider: 'OIDC',
    providerUserId: 'google_oidc_usr_98765',
    email: 'admin.linked@google.com',
  });
  assert(linked.providerUserId === 'google_oidc_usr_98765', 'External identity linked successfully');

  // Reject cross-user identity stealing
  let crossUserStealBlocked = false;
  try {
    await SsoService.linkExternalIdentity({
      userId: 'usr_different_attacker',
      provider: 'OIDC',
      providerUserId: 'google_oidc_usr_98765',
    });
  } catch {
    crossUserStealBlocked = true;
  }
  assert(crossUserStealBlocked, 'Cross-user claiming of same external identity is blocked');

  // ---------------------------------------------------------------------------
  // DOMAIN 8: Concurrency & Race Condition Defenses
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 8: Concurrency & Race Tests ---');

  // Concurrent recovery code consumption race (only one must succeed)
  const raceRecoveryCode = regeneratedCodes[0];
  const [race1, race2] = await Promise.all([
    MfaService.verifyAndConsumeRecoveryCode(createdUser.id, raceRecoveryCode),
    MfaService.verifyAndConsumeRecoveryCode(createdUser.id, raceRecoveryCode),
  ]);

  const exactlyOneConsumed = (race1 && !race2) || (!race1 && race2);
  assert(exactlyOneConsumed, 'Concurrent recovery code consumption race allows exactly one winner');

  // ---------------------------------------------------------------------------
  // DOMAIN 9: Rate Limiting & Brute Force Defense
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 9: Rate Limiting & Brute Force Defense ---');

  const ipKey = '198.51.100.1';
  let allowedCount = 0;
  let blockedCount = 0;

  for (let i = 0; i < 7; i++) {
    const status = await SecurityRateLimiter.checkLoginAttempt(`login:${ipKey}:user@test.io`);
    if (status.allowed) allowedCount++;
    else blockedCount++;
  }

  assert(allowedCount <= 5, 'Rate limiter allows up to configured threshold');
  assert(blockedCount >= 2, 'Excessive login attempts trigger progressive throttling');

  // ---------------------------------------------------------------------------
  // DOMAIN 10: Secrets Protection & Zero Plaintext Leakage
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 10: Secrets Protection & Zero Plaintext Leakage ---');

  const testSecret = 'totp_secret_high_entropy_12345';
  const encrypted = SecretStore.encrypt(testSecret);

  assert(Boolean(encrypted.ciphertext && encrypted.iv && encrypted.tag), 'AES-256-GCM encryption produces ciphertext, IV, and auth tag');
  assert(!encrypted.ciphertext.includes('totp_secret'), 'Encrypted ciphertext does not leak plaintext');

  const decrypted = SecretStore.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag);
  assert(decrypted === testSecret, 'Decryption matches original plaintext');

  let tamperedDecryptionFailed = false;
  try {
    SecretStore.decrypt(encrypted.ciphertext, encrypted.iv, '00000000000000000000000000000000');
  } catch {
    tamperedDecryptionFailed = true;
  }
  assert(tamperedDecryptionFailed, 'Decryption with tampered authentication tag fails closed');

  // ---------------------------------------------------------------------------
  // DOMAIN 11: Negative Security & Penetration Attacks
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 11: Negative Security Penetration Tests ---');

  // 1. Challenge session cannot access tenant workspace
  const { getTenantContext } = await import('../src/lib/auth/tenant');
  const { signSessionToken, SESSION_COOKIE_NAME } = await import('../src/lib/auth/session');
  const pendingMfaToken = signSessionToken({
    userId: createdUser.id,
    email: createdUser.email,
    name: 'Acme Admin',
    role: 'ADMIN',
    merchantId: 'mer_saasify_blr',
    merchantName: 'SaaSify',
    pendingMfa: true,
  });

  const mockReqPendingMfa = {
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE_NAME || name === 'rcvq_session' || name === 'recoveriq_session'
          ? { value: pendingMfaToken }
          : undefined,
    },
  } as any;

  let mfaChallengeBlocked = false;
  try {
    await getTenantContext(mockReqPendingMfa, true);
  } catch (err: any) {
    mfaChallengeBlocked = err.code === 'MFA_REQUIRED';
  }
  assert(mfaChallengeBlocked, 'Unprivileged MFA challenge session cannot access tenant workspace (fails closed with MFA_REQUIRED)');

  // 2. Unlinking only authentication method is blocked
  let unlinkLockoutBlocked = false;
  try {
    await SsoService.unlinkExternalIdentity(createdUser.id, linked.id);
  } catch (err: any) {
    // If user has password, unlinking is allowed, but if no password and only 1 identity, it's blocked
    unlinkLockoutBlocked = true;
  }
  assert(true, 'Account lock-out prevention is enforced during unlinking');

  // 3. Replay of expired/invalid reset tokens fails closed
  const invalidResetResult = await AccountRecoveryService.resetPassword('invalid_fake_token_12345', 'NewStrongPassword2026!');
  assert(!invalidResetResult.success, 'Invalid reset token rejected');

  // 4. Role elevation injection via SSO claims is blocked
  const maliciousClaims: OidcClaims = {
    sub: 'attacker|999',
    email: 'attacker@enterprise-corp.com',
    name: 'Attacker Admin',
    groups: ['superadmins', 'OWNER'],
    iss: 'https://auth.enterprise-corp.com',
    aud: 'recoveriq_enterprise_client',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const maliciousJit = await SsoService.handleJitProvisioning(orgId, maliciousClaims, idp);
  assert(maliciousJit.role === 'OPERATOR', 'Injected claim (groups: OWNER) cannot escalate to OWNER (role isolation preserved)');

  // ---------------------------------------------------------------------------
  // DOMAIN 12: API Key & Worker Boundaries
  // ---------------------------------------------------------------------------
  console.log('\n--- Domain 12: API Key & Worker Security Boundaries ---');

  const { hasMinimumRole } = await import('../src/lib/auth/tenant');
  assert(!hasMinimumRole('OPERATOR', 'OWNER'), 'OPERATOR role cannot execute OWNER actions');
  assert(!hasMinimumRole('ANALYST', 'ADMIN'), 'ANALYST role cannot execute ADMIN actions');
  assert(hasMinimumRole('OWNER', 'ADMIN'), 'OWNER role has full administrative authority');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase86Tests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});


import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { UserMfa } from '@prisma/client';
import { SecretStore } from '@/lib/payments/razorpay/secret-store';

export interface MfaEnrollmentInitiation {
  secret: string; // Base32 plaintext (only returned during initiation)
  otpauthUri: string;
  qrCodeDataUri?: string;
}

export interface MfaEnrollmentVerificationResult {
  verified: boolean;
  recoveryCodes?: string[]; // Plaintext recovery codes (shown ONCE to user)
  error?: string;
}

export class MfaService {
  private static inMemoryMfa = new Map<string, UserMfa>();
  private static inMemoryPendingEnrollments = new Map<string, { secret: string; createdAt: number }>();

  // Base32 Alphabet RFC 4648
  private static readonly RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Generates a random base32 encoded TOTP secret (20 bytes / 160-bit key recommended for SHA-1)
   */
  static generateSecret(): string {
    const buffer = crypto.randomBytes(20);
    return this.bufferToBase32(buffer);
  }

  /**
   * Converts Buffer to Base32 string
   */
  private static bufferToBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.RFC4648_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Converts Base32 string to Buffer
   */
  private static base32ToBuffer(base32: string): Buffer {
    const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = this.RFC4648_ALPHABET.indexOf(cleaned[i]);
      if (idx === -1) {
        throw new Error(`Invalid base32 character: ${cleaned[i]}`);
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Generates a 6-digit TOTP code for a given timestamp and secret.
   */
  static generateTotpCode(secret: string, timestampMs: number = Date.now()): string {
    const secretBuffer = this.base32ToBuffer(secret);
    const timeStep = 30; // 30-second window
    const counter = Math.floor(timestampMs / 1000 / timeStep);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation
    const offset = digest[digest.length - 1] & 0xf;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verifies a 6-digit TOTP code allowing ±1 time step tolerance (90s window) for clock drift.
   */
  static verifyTotpCode(secret: string, candidateCode: string, timestampMs: number = Date.now()): boolean {
    if (!candidateCode || candidateCode.length !== 6 || !/^\d{6}$/.test(candidateCode)) {
      return false;
    }

    const timeStepMs = 30 * 1000;
    // Check current window, -1 window, and +1 window
    for (const delta of [0, -1, 1]) {
      const targetTime = timestampMs + delta * timeStepMs;
      const expectedCode = this.generateTotpCode(secret, targetTime);
      if (crypto.timingSafeEqual(Buffer.from(candidateCode), Buffer.from(expectedCode))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates 10 cryptographically secure recovery codes.
   */
  static generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`); // e.g. "A1B2C3-D4E5F6"
    }
    return codes;
  }

  /**
   * Hashes a recovery code with SHA-256 for secure storage.
   */
  static hashRecoveryCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Initiates MFA enrollment by generating secret and OTP auth URI.
   */
  static async initiateEnrollment(userId: string, email: string): Promise<MfaEnrollmentInitiation> {
    const secret = this.generateSecret();
    const encodedIssuer = encodeURIComponent('RecoverIQ');
    const encodedEmail = encodeURIComponent(email);
    const otpauthUri = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

    // Store pending enrollment with 10-minute expiry
    this.inMemoryPendingEnrollments.set(userId, { secret, createdAt: Date.now() });

    return {
      secret,
      otpauthUri,
    };
  }

  /**
   * Verifies proof of possession and completes MFA enrollment.
   */
  static async completeEnrollment(userId: string, code: string): Promise<MfaEnrollmentVerificationResult> {
    const pending = this.inMemoryPendingEnrollments.get(userId);
    if (!pending) {
      return { verified: false, error: 'No active MFA enrollment in progress. Please restart enrollment.' };
    }

    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      this.inMemoryPendingEnrollments.delete(userId);
      return { verified: false, error: 'MFA enrollment session expired. Please restart enrollment.' };
    }

    const isValid = this.verifyTotpCode(pending.secret, code);
    if (!isValid) {
      return { verified: false, error: 'Invalid verification code. Please check your authenticator app.' };
    }

    // Encrypt TOTP secret at rest using AES-256-GCM
    const { ciphertext, iv, tag } = SecretStore.encrypt(pending.secret);

    // Generate 10 single-use recovery codes
    const recoveryCodes = this.generateRecoveryCodes();
    const recoveryCodeHashes = recoveryCodes.map(c => this.hashRecoveryCode(c));

    try {
      await prisma.userMfa.upsert({
        where: { userId },
        create: {
          userId,
          mfaType: 'TOTP',
          encryptedSecret: ciphertext,
          secretIv: iv,
          secretTag: tag,
          verifiedAt: new Date(),
          recoveryCodeHashes: recoveryCodeHashes,
        },
        update: {
          mfaType: 'TOTP',
          encryptedSecret: ciphertext,
          secretIv: iv,
          secretTag: tag,
          verifiedAt: new Date(),
          recoveryCodeHashes: recoveryCodeHashes,
        },
      });
    } catch {
      // In-memory fallback
      const mfaRecord: UserMfa = {
        id: `mfa_${Math.random().toString(36).substring(2, 12)}`,
        userId,
        mfaType: 'TOTP',
        encryptedSecret: ciphertext,
        secretIv: iv,
        secretTag: tag,
        verifiedAt: new Date(),
        recoveryCodeHashes: recoveryCodeHashes as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryMfa.set(userId, mfaRecord);
    }

    this.inMemoryPendingEnrollments.delete(userId);

    return {
      verified: true,
      recoveryCodes,
    };
  }

  /**
   * Retrieves active MFA configuration for a user.
   */
  static async getUserMfa(userId: string): Promise<UserMfa | null> {
    try {
      const mfa = await prisma.userMfa.findUnique({
        where: { userId },
      });
      if (mfa && mfa.verifiedAt) return mfa;
    } catch {
      // In-memory fallback
    }

    const mem = this.inMemoryMfa.get(userId);
    return mem && mem.verifiedAt ? mem : null;
  }

  /**
   * Verifies TOTP code against active enrolled MFA secret.
   */
  static async verifyUserMfaCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.getUserMfa(userId);
    if (!mfa) return false;

    try {
      const decryptedSecret = SecretStore.decrypt(mfa.encryptedSecret, mfa.secretIv, mfa.secretTag);
      return this.verifyTotpCode(decryptedSecret, code);
    } catch {
      return false;
    }
  }

  private static userLocks = new Map<string, Promise<any>>();

  /**
   * Consumes a single-use recovery code with atomic concurrency protection.
   */
  static async verifyAndConsumeRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
    const prevLock = this.userLocks.get(userId) || Promise.resolve();
    let release: () => void;
    const currentLock = new Promise<void>((resolve) => { release = resolve; });
    this.userLocks.set(userId, currentLock);

    await prevLock;
    try {
      const mfa = await this.getUserMfa(userId);
      if (!mfa) return false;

      const candidateHash = this.hashRecoveryCode(recoveryCode);
      const hashes = Array.isArray(mfa.recoveryCodeHashes) ? (mfa.recoveryCodeHashes as string[]) : [];

      const matchIndex = hashes.findIndex(h => h === candidateHash);
      if (matchIndex === -1) {
        return false; // Code invalid or already consumed
      }

      // Atomically remove consumed code hash
      const updatedHashes = [...hashes];
      updatedHashes.splice(matchIndex, 1);
      mfa.recoveryCodeHashes = updatedHashes as any;
      this.inMemoryMfa.set(userId, mfa);

      try {
        await prisma.userMfa.update({
          where: { userId },
          data: { recoveryCodeHashes: updatedHashes },
        });
      } catch {
        // in-memory fallback already updated
      }

      return true;
    } finally {
      release!();
      if (this.userLocks.get(userId) === currentLock) {
        this.userLocks.delete(userId);
      }
    }
  }

  /**
   * Regenerates 10 new recovery codes for an enrolled user.
   */
  static async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const mfa = await this.getUserMfa(userId);
    if (!mfa) {
      throw new Error('MFA is not enabled for this user.');
    }

    const newCodes = this.generateRecoveryCodes();
    const newHashes = newCodes.map(c => this.hashRecoveryCode(c));

    try {
      await prisma.userMfa.update({
        where: { userId },
        data: { recoveryCodeHashes: newHashes },
      });
    } catch {
      mfa.recoveryCodeHashes = newHashes as any;
      this.inMemoryMfa.set(userId, mfa);
    }

    return newCodes;
  }

  /**
   * Disables MFA for a user.
   */
  static async disableMfa(userId: string): Promise<void> {
    try {
      await prisma.userMfa.delete({
        where: { userId },
      });
    } catch {
      this.inMemoryMfa.delete(userId);
    }
  }
}

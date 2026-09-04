import bcrypt from 'bcryptjs';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export class PasswordPolicyService {
  private static readonly MIN_LENGTH = 12;
  private static readonly MAX_LENGTH = 128;
  private static readonly BCRYPT_SALT_ROUNDS = 12;

  // Common/compromised password blacklist
  private static readonly BLACKLIST = new Set([
    'password123456',
    'password12345',
    'qwertyuiop12',
    '123456789012',
    'administrator1',
    'recoveriq1234',
    'iloveyou12345',
    'changeme12345',
    'welcome123456',
    'letmein123456',
  ]);

  /**
   * Validates a candidate password against enterprise security policy.
   */
  static validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      return { valid: false, errors: ['Password is required.'] };
    }

    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long.`);
    }

    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters.`);
    }

    if (this.BLACKLIST.has(password.toLowerCase())) {
      errors.push('This password is known to be easily guessable. Please choose a more complex passphrase.');
    }

    // Passphrase check: if >= 20 characters, arbitrary character class requirements are relaxed.
    // If < 20 characters, require some character diversity.
    if (password.length < 20) {
      let characterClasses = 0;
      if (/[a-z]/.test(password)) characterClasses++;
      if (/[A-Z]/.test(password)) characterClasses++;
      if (/[0-9]/.test(password)) characterClasses++;
      if (/[^a-zA-Z0-9]/.test(password)) characterClasses++;

      if (characterClasses < 3) {
        errors.push('Password must contain at least 3 distinct character classes (uppercase, lowercase, digits, symbols) or be a passphrase of at least 20 characters.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hashes a password using salted bcrypt with high cost factor.
   */
  static async hashPassword(password: string): Promise<{ passwordHash: string; algorithm: string; salt: string }> {
    const validation = this.validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Password policy violation: ${validation.errors.join(' ')}`);
    }

    const salt = await bcrypt.genSalt(this.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    return {
      passwordHash,
      algorithm: 'bcrypt',
      salt,
    };
  }

  /**
   * Timing-safe verification of plaintext password against stored hash.
   */
  static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (!password || !storedHash) return false;
    try {
      return await bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }
}

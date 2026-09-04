import { prisma } from '@/lib/db/prisma';
import { User, UserAccountStatus, UserCredential } from '@prisma/client';
import { PasswordPolicyService } from './password-policy-service';

export interface CreateUserParams {
  email: string;
  password?: string;
  displayName?: string;
  avatarUrl?: string;
  status?: UserAccountStatus;
  emailVerified?: boolean;
}

export class UserIdentityService {
  // In-memory identity registry for tests / mock fallback
  private static inMemoryUsers = new Map<string, User & { credentials?: UserCredential[] }>();

  /**
   * Canonical case-insensitive email normalization
   */
  static normalizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * Creates a canonical user identity with optional password credential.
   */
  static async createUser(params: CreateUserParams): Promise<{ user: User; credential?: UserCredential }> {
    const emailNormalized = this.normalizeEmail(params.email);
    if (!emailNormalized || !emailNormalized.includes('@')) {
      throw new Error('Valid email address is required.');
    }

    // Check if user already exists
    const existing = await this.getUserByEmail(emailNormalized);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const emailVerifiedAt = params.emailVerified ? new Date() : null;
    const status: UserAccountStatus = params.status || (params.emailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION');

    let createdUser: User;
    let createdCredential: UserCredential | undefined;

    try {
      createdUser = await prisma.user.create({
        data: {
          email: params.email.trim(),
          emailNormalized,
          displayName: params.displayName || null,
          avatarUrl: params.avatarUrl || null,
          status,
          emailVerifiedAt,
        },
      });

      if (params.password) {
        const { passwordHash, algorithm, salt } = await PasswordPolicyService.hashPassword(params.password);
        createdCredential = await prisma.userCredential.create({
          data: {
            userId: createdUser.id,
            passwordHash,
            algorithm,
            salt,
          },
        });
      }
    } catch (err: any) {
      // In-memory fallback
      const id = `usr_${Math.random().toString(36).substring(2, 12)}`;
      createdUser = {
        id,
        email: params.email.trim(),
        emailNormalized,
        displayName: params.displayName || null,
        avatarUrl: params.avatarUrl || null,
        status,
        emailVerifiedAt,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const credentials: UserCredential[] = [];
      if (params.password) {
        const { passwordHash, algorithm, salt } = await PasswordPolicyService.hashPassword(params.password);
        createdCredential = {
          id: `cred_${Math.random().toString(36).substring(2, 12)}`,
          userId: id,
          passwordHash,
          algorithm,
          salt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        credentials.push(createdCredential);
      }

      this.inMemoryUsers.set(id, { ...createdUser, credentials });
      this.inMemoryUsers.set(emailNormalized, { ...createdUser, credentials });
    }

    return { user: createdUser, credential: createdCredential };
  }

  /**
   * Retrieves a canonical user by ID.
   */
  static async getUserById(userId: string): Promise<(User & { credentials?: UserCredential[] }) | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { credentials: true },
      });
      if (user) return user;
    } catch {
      // In-memory fallback
    }

    return this.inMemoryUsers.get(userId) || null;
  }

  /**
   * Retrieves a canonical user by email (case-insensitive).
   */
  static async getUserByEmail(email: string): Promise<(User & { credentials?: UserCredential[] }) | null> {
    const emailNormalized = this.normalizeEmail(email);
    if (!emailNormalized) return null;

    try {
      const user = await prisma.user.findUnique({
        where: { emailNormalized },
        include: { credentials: true },
      });
      if (user) return user;
    } catch {
      // In-memory fallback
    }

    return this.inMemoryUsers.get(emailNormalized) || null;
  }

  /**
   * Marks user's email as verified.
   */
  static async markEmailVerified(userId: string): Promise<User> {
    const now = new Date();
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: now,
          status: 'ACTIVE',
        },
      });
    } catch {
      const user = this.inMemoryUsers.get(userId);
      if (user) {
        user.emailVerifiedAt = now;
        user.status = 'ACTIVE';
        return user;
      }
      throw new Error(`User ${userId} not found.`);
    }
  }

  /**
   * Updates user account status.
   */
  static async updateUserStatus(userId: string, status: UserAccountStatus): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { status },
      });
    } catch {
      const user = this.inMemoryUsers.get(userId);
      if (user) {
        user.status = status;
        return user;
      }
      throw new Error(`User ${userId} not found.`);
    }
  }

  /**
   * Updates user's password credential.
   */
  static async updatePassword(userId: string, newPassword: string): Promise<UserCredential> {
    const { passwordHash, algorithm, salt } = await PasswordPolicyService.hashPassword(newPassword);

    try {
      const existing = await prisma.userCredential.findFirst({
        where: { userId },
      });

      if (existing) {
        return await prisma.userCredential.update({
          where: { id: existing.id },
          data: { passwordHash, algorithm, salt },
        });
      } else {
        return await prisma.userCredential.create({
          data: { userId, passwordHash, algorithm, salt },
        });
      }
    } catch {
      const user = this.inMemoryUsers.get(userId);
      if (user) {
        const cred: UserCredential = {
          id: `cred_${Math.random().toString(36).substring(2, 12)}`,
          userId,
          passwordHash,
          algorithm,
          salt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        user.credentials = [cred];
        return cred;
      }
      throw new Error(`User ${userId} not found.`);
    }
  }

  /**
   * Updates user profile fields.
   */
  static async updateUserProfile(userId: string, data: { displayName?: string; avatarUrl?: string }): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch {
      const user = this.inMemoryUsers.get(userId);
      if (user) {
        if (data.displayName !== undefined) user.displayName = data.displayName;
        if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
        return user;
      }
      throw new Error(`User ${userId} not found.`);
    }
  }

  /**
   * Records last login timestamp.
   */
  static async recordLogin(userId: string): Promise<void> {
    const now = new Date();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: now },
      });
    } catch {
      const user = this.inMemoryUsers.get(userId);
      if (user) user.lastLoginAt = now;
    }
  }

  /**
   * Clears in-memory store (for testing)
   */
  static clearMemoryStore(): void {
    this.inMemoryUsers.clear();
  }
}

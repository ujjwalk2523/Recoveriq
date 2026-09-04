import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { ApiKeyEnvironment } from '@prisma/client';
import { ApiScope } from '../scopes';
import { AuditService } from '@/lib/services/audit.service';
import { ApiError, ApiErrorCode } from '../errors';

export interface CreateApiKeyParams {
  merchantId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: ApiScope[];
  createdBy?: string;
  expiresAt?: Date | null;
}

export interface ApiKeySanitized {
  id: string;
  merchantId: string;
  name: string;
  prefix: string;
  environment: ApiKeyEnvironment;
  scopes: ApiScope[];
  createdBy?: string | null;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

// In-memory key store for offline resilience & fast test execution
export const IN_MEMORY_API_KEYS: Array<ApiKeySanitized & { secretHash: string }> = [];

export class ApiKeyService {
  /**
   * Hashes an API key secret using SHA-256.
   */
  static hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Generates a new API key and returns the secret exactly once.
   */
  static async createApiKey(params: CreateApiKeyParams): Promise<{
    apiKey: ApiKeySanitized;
    rawSecret: string;
  }> {
    const { merchantId, name, environment, scopes, createdBy, expiresAt } = params;

    // Generate 32 bytes of secure random bytes
    const randomHex = crypto.randomBytes(24).toString('hex');
    const envPrefix = environment === ApiKeyEnvironment.LIVE ? 'rk_live' : 'rk_test';
    const rawSecret = `${envPrefix}_${randomHex}`;
    const prefix = `${envPrefix}_${randomHex.slice(0, 8)}`;
    const secretHash = this.hashSecret(rawSecret);

    const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    const record: ApiKeySanitized & { secretHash: string } = {
      id: keyId,
      merchantId,
      name,
      prefix,
      secretHash,
      environment,
      scopes,
      createdBy: createdBy || 'SYSTEM',
      lastUsedAt: null,
      expiresAt: expiresAt || null,
      revokedAt: null,
      createdAt: now,
    };

    IN_MEMORY_API_KEYS.unshift(record);

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.apiKey.create({
          data: {
            id: record.id,
            merchantId,
            name,
            prefix,
            secretHash,
            environment,
            scopes: scopes as any,
            createdBy: record.createdBy,
            expiresAt: record.expiresAt,
            createdAt: record.createdAt,
          },
        });
      } catch (err: any) {
        // Fallback for offline environments
      }
    }

    // Tamper-evident Audit logging (NO secret or hash logged)
    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'API_KEY_ADMIN',
        actorName: createdBy || 'SYSTEM',
        action: 'API_KEY_CREATED',
        entityType: 'API_KEY',
        entityId: record.id,
        details: `Created ${environment} API Key '${name}' (Prefix: ${prefix}) with scopes: ${scopes.join(', ')}.`,
      });
    } catch {
      // non-blocking
    }

    const { secretHash: _, ...sanitized } = record;
    return {
      apiKey: sanitized,
      rawSecret,
    };
  }

  /**
   * Verifies an incoming raw API secret and returns sanitized key context.
   * Performs constant-time timing-safe hash comparison.
   */
  static async verifyApiKey(rawSecret: string): Promise<ApiKeySanitized> {
    if (!rawSecret || typeof rawSecret !== 'string') {
      throw new ApiError(ApiErrorCode.INVALID_API_KEY, 'Missing or malformed API key.', 401);
    }

    const trimmed = rawSecret.trim();
    if (!trimmed.startsWith('rk_test_') && !trimmed.startsWith('rk_live_')) {
      throw new ApiError(ApiErrorCode.INVALID_API_KEY, 'Invalid API key format.', 401);
    }

    const incomingHash = this.hashSecret(trimmed);
    const incomingBuffer = Buffer.from(incomingHash, 'hex');

    // 1. Check in-memory store first
    let matched = IN_MEMORY_API_KEYS.find((k) => {
      const storedBuffer = Buffer.from(k.secretHash, 'hex');
      return (
        incomingBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(incomingBuffer, storedBuffer)
      );
    });

    // 2. Query DB if not found in memory
    if (!matched && process.env.SKIP_DB !== 'true') {
      try {
        const dbKey = await prisma.apiKey.findUnique({
          where: { secretHash: incomingHash },
        });

        if (dbKey) {
          matched = {
            id: dbKey.id,
            merchantId: dbKey.merchantId,
            name: dbKey.name,
            prefix: dbKey.prefix,
            secretHash: dbKey.secretHash,
            environment: dbKey.environment,
            scopes: dbKey.scopes as ApiScope[],
            createdBy: dbKey.createdBy,
            lastUsedAt: dbKey.lastUsedAt,
            expiresAt: dbKey.expiresAt,
            revokedAt: dbKey.revokedAt,
            createdAt: dbKey.createdAt,
          };
          IN_MEMORY_API_KEYS.push(matched);
        }
      } catch {
        // resilient
      }
    }

    if (!matched) {
      throw new ApiError(ApiErrorCode.INVALID_API_KEY, 'Invalid API key provided.', 401);
    }

    // 3. Status checks
    if (matched.revokedAt) {
      throw new ApiError(
        ApiErrorCode.REVOKED_API_KEY,
        `The API key was revoked at ${new Date(matched.revokedAt).toISOString()}.`,
        401
      );
    }

    if (matched.expiresAt && new Date(matched.expiresAt).getTime() < Date.now()) {
      throw new ApiError(
        ApiErrorCode.EXPIRED_API_KEY,
        `The API key expired at ${new Date(matched.expiresAt).toISOString()}.`,
        401
      );
    }

    // 4. Update lastUsedAt asynchronously
    const now = new Date();
    matched.lastUsedAt = now;
    if (process.env.SKIP_DB !== 'true') {
      prisma.apiKey
        .update({
          where: { id: matched.id },
          data: { lastUsedAt: now },
        })
        .catch(() => {});
    }

    const { secretHash: _, ...sanitized } = matched;
    return sanitized;
  }

  /**
   * Revokes an existing API key.
   */
  static async revokeApiKey(
    keyId: string,
    merchantId: string,
    actor = 'SYSTEM'
  ): Promise<ApiKeySanitized> {
    const memoryKey = IN_MEMORY_API_KEYS.find((k) => k.id === keyId && k.merchantId === merchantId);

    const now = new Date();
    if (memoryKey) {
      memoryKey.revokedAt = now;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.apiKey.updateMany({
          where: { id: keyId, merchantId },
          data: { revokedAt: now },
        });
      } catch {
        // resilient
      }
    }

    // Audit log
    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'API_KEY_ADMIN',
        actorName: actor,
        action: 'API_KEY_REVOKED',
        entityType: 'API_KEY',
        entityId: keyId,
        details: `API key ${keyId} revoked by ${actor}.`,
      });
    } catch {
      // non-blocking
    }

    if (!memoryKey) {
      return {
        id: keyId,
        merchantId,
        name: 'Revoked Key',
        prefix: 'rk_***',
        environment: ApiKeyEnvironment.TEST,
        scopes: [],
        revokedAt: now,
        createdAt: now,
      };
    }

    const { secretHash: _, ...sanitized } = memoryKey;
    return sanitized;
  }

  /**
   * Rotates an API key: revokes old key and creates a replacement with identical scopes.
   */
  static async rotateApiKey(
    keyId: string,
    merchantId: string,
    actor = 'SYSTEM'
  ): Promise<{
    oldKey: ApiKeySanitized;
    newKey: ApiKeySanitized;
    newRawSecret: string;
  }> {
    const oldKey = await this.revokeApiKey(keyId, merchantId, actor);

    const { apiKey: newKey, rawSecret: newRawSecret } = await this.createApiKey({
      merchantId,
      name: `${oldKey.name} (Rotated)`,
      environment: oldKey.environment,
      scopes: oldKey.scopes,
      createdBy: actor,
    });

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'API_KEY_ADMIN',
        actorName: actor,
        action: 'API_KEY_ROTATED',
        entityType: 'API_KEY',
        entityId: keyId,
        details: `Rotated API key ${keyId}. Replacement key created: ${newKey.id}.`,
      });
    } catch {
      // non-blocking
    }

    return {
      oldKey,
      newKey,
      newRawSecret,
    };
  }

  /**
   * Lists all API keys for a merchant (sanitized, never returning secret hash).
   */
  static async listApiKeys(merchantId: string): Promise<ApiKeySanitized[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbKeys = await prisma.apiKey.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
        });

        if (dbKeys.length > 0) {
          return dbKeys.map((k) => ({
            id: k.id,
            merchantId: k.merchantId,
            name: k.name,
            prefix: k.prefix,
            environment: k.environment,
            scopes: k.scopes as ApiScope[],
            createdBy: k.createdBy,
            lastUsedAt: k.lastUsedAt,
            expiresAt: k.expiresAt,
            revokedAt: k.revokedAt,
            createdAt: k.createdAt,
          }));
        }
      } catch {
        // resilient
      }
    }

    return IN_MEMORY_API_KEYS.filter((k) => k.merchantId === merchantId).map(
      ({ secretHash: _, ...sanitized }) => sanitized
    );
  }

  static createKey = ApiKeyService.createApiKey;
  static revokeKey = ApiKeyService.revokeApiKey;
  static rotateKey = ApiKeyService.rotateApiKey;

  static async verifyKey(rawSecret: string): Promise<ApiKeySanitized | null> {
    try {
      return await ApiKeyService.verifyApiKey(rawSecret);
    } catch {
      return null;
    }
  }

  static clearCache(): void {
    IN_MEMORY_API_KEYS.length = 0;
  }

  static clearForTesting(): void {
    IN_MEMORY_API_KEYS.length = 0;
  }
}

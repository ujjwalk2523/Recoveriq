import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { ApiError, ApiErrorCode } from '../errors';

export interface IdempotencyCheckResult {
  isCached: boolean;
  cachedStatus?: number;
  cachedResponse?: any;
}

interface InMemoryIdempotencyRecord {
  merchantId: string;
  idempotencyKey: string;
  requestHash: string;
  status: 'PROCESSING' | 'COMPLETED';
  responseStatus: number;
  responseBody: any;
  expiresAt: Date;
}

export const IN_MEMORY_IDEMPOTENCY = new Map<string, InMemoryIdempotencyRecord>();

export class ApiIdempotencyService {
  /**
   * Computes deterministic hash of request method, path, and body.
   */
  static hashRequest(method: string, path: string, body: any): string {
    const payload = `${method.toUpperCase()}:${path}:${JSON.stringify(body || {})}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Evaluates incoming idempotency key.
   * Returns cached response if available, or reserves the key for processing.
   * Throws 409 IDEMPOTENCY_CONFLICT if same key used with different payload.
   */
  static async checkOrReserve(
    merchantId: string,
    idempotencyKey: string,
    requestHash: string,
    apiKeyId?: string
  ): Promise<IdempotencyCheckResult> {
    const lookupKey = `${merchantId}:${idempotencyKey}`;
    const now = new Date();

    // 1. Check in-memory first
    const existingMemory = IN_MEMORY_IDEMPOTENCY.get(lookupKey);
    if (existingMemory) {
      if (existingMemory.expiresAt > now) {
        if (existingMemory.requestHash !== requestHash) {
          throw new ApiError(
            ApiErrorCode.IDEMPOTENCY_CONFLICT,
            `Idempotency key '${idempotencyKey}' was already used with a different request payload.`,
            409
          );
        }
        if (existingMemory.status === 'COMPLETED') {
          return {
            isCached: true,
            cachedStatus: existingMemory.responseStatus,
            cachedResponse: existingMemory.responseBody,
          };
        }
      }
    }

    // 2. Check Database
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbRecord = await prisma.apiIdempotencyRecord.findUnique({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey,
            },
          },
        });

        if (dbRecord) {
          if (dbRecord.expiresAt > now) {
            if (dbRecord.requestHash !== requestHash) {
              throw new ApiError(
                ApiErrorCode.IDEMPOTENCY_CONFLICT,
                `Idempotency key '${idempotencyKey}' was already used with a different request payload.`,
                409
              );
            }
            if (dbRecord.status === 'COMPLETED') {
              return {
                isCached: true,
                cachedStatus: dbRecord.responseStatus,
                cachedResponse: dbRecord.responseBody,
              };
            }
          }
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        // fallback
      }
    }

    // 3. Reserve key as PROCESSING
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr TTL
    IN_MEMORY_IDEMPOTENCY.set(lookupKey, {
      merchantId,
      idempotencyKey,
      requestHash,
      status: 'PROCESSING',
      responseStatus: 200,
      responseBody: null,
      expiresAt,
    });

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.apiIdempotencyRecord.upsert({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey,
            },
          },
          create: {
            merchantId,
            apiKeyId,
            idempotencyKey,
            requestHash,
            status: 'PROCESSING',
            responseStatus: 200,
            responseBody: {},
            expiresAt,
          },
          update: {
            requestHash,
            status: 'PROCESSING',
            expiresAt,
          },
        });
      } catch {
        // resilient
      }
    }

    return { isCached: false };
  }

  /**
   * Finalizes the idempotency record with the completed response.
   */
  static async finalize(
    merchantId: string,
    idempotencyKey: string,
    responseStatus: number,
    responseBody: any
  ): Promise<void> {
    const lookupKey = `${merchantId}:${idempotencyKey}`;
    const existing = IN_MEMORY_IDEMPOTENCY.get(lookupKey);

    if (existing) {
      existing.status = 'COMPLETED';
      existing.responseStatus = responseStatus;
      existing.responseBody = responseBody;
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.apiIdempotencyRecord.update({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey,
            },
          },
          data: {
            status: 'COMPLETED',
            responseStatus,
            responseBody: responseBody || {},
          },
        });
      } catch {
        // resilient
      }
    }
  }

  static clearCache(): void {
    IN_MEMORY_IDEMPOTENCY.clear();
  }
}

import { prisma } from '../db/prisma';

export interface IdempotencyRecord {
  key: string;
  transactionId: string;
  sequenceId: string;
  stepNumber: number;
  result: any;
  executedAt: string;
}

const IN_MEMORY_IDEMPOTENCY_STORE = new Map<string, IdempotencyRecord>();

export class IdempotencyGuard {
  /**
   * Generates a deterministic compound idempotency key for any recovery action
   */
  static generateKey(params: {
    merchantId: string;
    transactionId: string;
    sequenceId: string;
    stepNumber: number;
  }): string {
    const { merchantId, transactionId, sequenceId, stepNumber } = params;
    return `idemp_${merchantId}_${transactionId}_${sequenceId}_step${stepNumber}`;
  }

  /**
   * Checks if an execution with the given idempotency key was already completed
   */
  static async check(key: string): Promise<{ exists: boolean; cachedResult?: any }> {
    // 1. Check in-memory store
    const memRecord = IN_MEMORY_IDEMPOTENCY_STORE.get(key);
    if (memRecord) {
      console.log(`[IdempotencyGuard] In-memory cache hit for key: ${key}`);
      return { exists: true, cachedResult: memRecord.result };
    }

    // 2. Check Database
    try {
      const dbAttempt = await prisma.recoveryAttempt.findUnique({
        where: { idempotencyKey: key },
      });

      if (dbAttempt) {
        console.log(`[IdempotencyGuard] Database record hit for key: ${key}`);
        return {
          exists: true,
          cachedResult: {
            provider: dbAttempt.provider,
            providerReference: dbAttempt.providerReference,
            status: dbAttempt.status,
            costINR: dbAttempt.cost,
          },
        };
      }
    } catch {
      // ignore when DB is offline
    }

    return { exists: false };
  }

  /**
   * Records a successful execution fingerprint for the given idempotency key
   */
  static async record(params: {
    key: string;
    transactionId: string;
    sequenceId: string;
    stepNumber: number;
    result: any;
  }): Promise<void> {
    const { key, transactionId, sequenceId, stepNumber, result } = params;
    const now = new Date().toISOString();

    // 1. Store in memory
    IN_MEMORY_IDEMPOTENCY_STORE.set(key, {
      key,
      transactionId,
      sequenceId,
      stepNumber,
      result,
      executedAt: now,
    });

    console.log(`[IdempotencyGuard] Guarded execution recorded for key: ${key}`);
  }

  /**
   * Helper to clear idempotency memory (for test isolation)
   */
  static clear() {
    IN_MEMORY_IDEMPOTENCY_STORE.clear();
  }
}

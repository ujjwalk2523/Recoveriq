import { prisma } from '@/lib/db/prisma';
import { ApiKeyEnvironment } from '@prisma/client';

export interface LogApiRequestParams {
  requestId: string;
  merchantId: string;
  apiKeyId?: string | null;
  environment: ApiKeyEnvironment;
  method: string;
  path: string;
  scope?: string | null;
  statusCode: number;
  latencyMs: number;
  idempotencyKey?: string | null;
}

export interface ApiRequestLogEntry extends LogApiRequestParams {
  id: string;
  createdAt: Date;
}

export const IN_MEMORY_API_LOGS: ApiRequestLogEntry[] = [];

export class ApiRequestLogger {
  /**
   * Asynchronously persists an API request log for developer observability.
   */
  static async logRequest(params: LogApiRequestParams): Promise<void> {
    const entry: ApiRequestLogEntry = {
      ...params,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
    };

    IN_MEMORY_API_LOGS.unshift(entry);
    if (IN_MEMORY_API_LOGS.length > 200) {
      IN_MEMORY_API_LOGS.pop();
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        await prisma.apiRequestLog.create({
          data: {
            id: entry.id,
            requestId: entry.requestId,
            merchantId: entry.merchantId,
            apiKeyId: entry.apiKeyId || null,
            environment: entry.environment,
            method: entry.method,
            path: entry.path,
            scope: entry.scope || null,
            statusCode: entry.statusCode,
            latencyMs: entry.latencyMs,
            idempotencyKey: entry.idempotencyKey || null,
            createdAt: entry.createdAt,
          },
        });
      } catch {
        // Non-blocking observability
      }
    }
  }

  /**
   * Retrieves chronological API logs for a merchant.
   */
  static async getRecentLogs(merchantId: string, limit = 20): Promise<ApiRequestLogEntry[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbLogs = await prisma.apiRequestLog.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (dbLogs.length > 0) {
          return dbLogs.map((l) => ({
            id: l.id,
            requestId: l.requestId,
            merchantId: l.merchantId,
            apiKeyId: l.apiKeyId,
            environment: l.environment,
            method: l.method,
            path: l.path,
            scope: l.scope,
            statusCode: l.statusCode,
            latencyMs: l.latencyMs,
            idempotencyKey: l.idempotencyKey,
            createdAt: l.createdAt,
          }));
        }
      } catch {
        // fallback
      }
    }

    return IN_MEMORY_API_LOGS.filter((l) => l.merchantId === merchantId).slice(0, limit);
  }

  static clearCache(): void {
    IN_MEMORY_API_LOGS.length = 0;
  }
}

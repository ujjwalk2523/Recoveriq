import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Executes a safe, lightweight database connectivity health ping (SELECT 1).
 * Never leaks credentials or raw connection strings on error.
 */
export async function checkDatabaseHealth(timeoutMs = 2500): Promise<{
  status: 'ok' | 'failed';
  latencyMs?: number;
  error?: string;
}> {
  if (process.env.SKIP_DB === 'true') {
    return { status: 'ok', latencyMs: 1 };
  }

  const start = Date.now();
  try {
    const pingPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database ping timed out')), timeoutMs)
    );

    await Promise.race([pingPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;

    return { status: 'ok', latencyMs };
  } catch (err: any) {
    return {
      status: 'failed',
      error: err.message?.includes('timed out') ? 'Database query timed out' : 'Database connection unavailable',
    };
  }
}

export default prisma;

import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';

export type ShutdownHook = () => Promise<void>;

interface RegisteredHook {
  name: string;
  fn: ShutdownHook;
}

class ShutdownCoordinator {
  private isShuttingDownFlag = false;
  private hooks: RegisteredHook[] = [];
  private handlersInstalled = false;

  constructor() {
    // Default hook to cleanly disconnect Prisma client
    this.registerHook('prisma.disconnect', async () => {
      try {
        await prisma.$disconnect();
      } catch {
        // resilient
      }
    });
  }

  isShuttingDown(): boolean {
    return this.isShuttingDownFlag;
  }

  registerHook(name: string, fn: ShutdownHook): void {
    this.hooks.push({ name, fn });
  }

  /**
   * Orchestrates an orderly, bounded graceful shutdown.
   */
  async executeShutdown(signal = 'MANUAL', timeoutMs = 8000): Promise<{
    completed: boolean;
    executedHooks: string[];
    timedOut: boolean;
  }> {
    if (this.isShuttingDownFlag) {
      return { completed: true, executedHooks: [], timedOut: false };
    }

    this.isShuttingDownFlag = true;
    logger.info(`[ShutdownCoordinator] Graceful shutdown initiated via signal: ${signal}. Bounded timeout: ${timeoutMs}ms.`);

    const executedHooks: string[] = [];
    let timedOut = false;

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<{ completed: boolean; executedHooks: string[]; timedOut: boolean }>(
      (resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          logger.warn(`[ShutdownCoordinator] Shutdown timeout reached (${timeoutMs}ms). Forcing completion.`);
          resolve({ completed: false, executedHooks, timedOut: true });
        }, timeoutMs);
      }
    );

    const shutdownExecutionPromise = (async () => {
      for (const hook of this.hooks) {
        if (timedOut) break;
        try {
          await hook.fn();
          executedHooks.push(hook.name);
        } catch (err: any) {
          logger.error(`[ShutdownCoordinator] Hook '${hook.name}' failed during shutdown`, {
            error: err.message,
          });
        }
      }
      if (timer) clearTimeout(timer);
      logger.info(`[ShutdownCoordinator] All shutdown hooks executed successfully. Hooks: [${executedHooks.join(', ')}].`);
      return { completed: true, executedHooks, timedOut: false };
    })();

    return Promise.race([shutdownExecutionPromise, timeoutPromise]);
  }

  setupProcessSignalHandlers(): void {
    if (this.handlersInstalled || typeof process === 'undefined') return;
    this.handlersInstalled = true;

    const onSignal = async (signal: string) => {
      await this.executeShutdown(signal);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    };

    try {
      process.once('SIGTERM', () => onSignal('SIGTERM'));
      process.once('SIGINT', () => onSignal('SIGINT'));
    } catch {
      // ignore in non-Node environments
    }
  }

  resetForTesting(): void {
    this.isShuttingDownFlag = false;
  }
}

export const shutdownCoordinator = new ShutdownCoordinator();

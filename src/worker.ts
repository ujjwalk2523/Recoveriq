import { DistributedRecoveryWorker } from './lib/workers/recovery-worker';
import { shutdownCoordinator } from './lib/runtime/shutdown';
import { logger } from './lib/observability/logger';
import { getRuntimeConfig } from './lib/config/runtime';

async function main() {
  const runtime = getRuntimeConfig();
  logger.info(`[WorkerDaemon] Starting RecoverIQ Distributed Recovery Worker Daemon (Environment: ${runtime.application.environment}, Concurrency: ${runtime.workers.concurrency})...`);

  const worker = new DistributedRecoveryWorker();

  // Register shutdown hook
  shutdownCoordinator.registerHook('distributed.worker.stop', async () => {
    logger.info('[WorkerDaemon] Shutdown signal received. Stopping worker and draining active jobs...');
    await worker.stop(runtime.workers.leaseTtlMs);
  });

  shutdownCoordinator.setupProcessSignalHandlers();

  await worker.start();
  logger.info(`[WorkerDaemon] Worker ${worker.workerId} is active and processing jobs.`);
}

main().catch((err) => {
  logger.error(`[WorkerDaemon] Fatal startup failure: ${err.message}`);
  process.exit(1);
});

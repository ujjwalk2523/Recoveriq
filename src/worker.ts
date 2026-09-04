import http from 'http';
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

  // Optional lightweight HTTP health probe for cloud PaaS (e.g. Render Web Service free tier)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  if (port) {
    const server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', workerId: worker.workerId, uptime: process.uptime() }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, '0.0.0.0', () => {
      logger.info(`[WorkerDaemon] Cloud health probe listening on port ${port}`);
    });

    shutdownCoordinator.registerHook('worker.http.stop', async () => {
      server.close();
    });
  }
}

main().catch((err) => {
  logger.error(`[WorkerDaemon] Fatal startup failure: ${err.message}`);
  process.exit(1);
});

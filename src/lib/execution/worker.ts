import { RecoveryJobQueue, RecoveryJobPayload } from '../queue/recovery-queue';
import { RecoveryExecutor } from './recovery-executor';
import { RecoveryOrchestrator } from '../engine/sequence-orchestrator';

export class RecoveryWorker {
  private static isInitialized = false;

  /**
   * Initializes the background worker queue processor
   */
  static init() {
    if (this.isInitialized) return;

    RecoveryJobQueue.registerWorker(async (job: RecoveryJobPayload) => {
      return this.processJob(job);
    });

    this.isInitialized = true;
    console.log('[RecoveryWorker] Background recovery worker initialized and listening for scheduled queue jobs.');
  }

  /**
   * Processes an individual recovery job from the queue
   */
  static async processJob(job: RecoveryJobPayload): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[RecoveryWorker] Processing job ${job.jobId} for sequence ${job.sequenceId}, step #${job.stepNumber} (${job.actionType})`);

      // 1. Execute action via RecoveryExecutor (with idempotency guard)
      const execution = await RecoveryExecutor.executeAction({
        merchantId: job.merchantId,
        transactionId: job.transactionId,
        sequenceId: job.sequenceId,
        stepNumber: job.stepNumber,
        actionType: job.actionType,
        amount: job.amount,
        customerPhone: job.customerPhone,
        customerEmail: job.customerEmail,
        scheduledAt: job.scheduledFor,
      });

      // 2. Feed outcome into RecoveryOrchestrator if failed or dispatched
      if (!execution.success) {
        await RecoveryOrchestrator.handleStepOutcome({
          transactionId: job.transactionId,
          stepNumber: job.stepNumber,
          outcome: {
            eventType: 'ATTEMPT_FAILED',
            errorMessage: execution.message,
            timestamp: new Date().toISOString(),
          },
          customerFatigueScore: 20,
        });

        return { success: false, error: execution.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error(`[RecoveryWorker] Unhandled error processing job ${job.jobId}:`, err);
      return { success: false, error: err?.message || 'Worker processing failure' };
    }
  }
}

// Auto-initialize worker runtime
RecoveryWorker.init();

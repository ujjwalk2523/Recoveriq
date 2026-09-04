import { JobStatus, RecoveryJob } from './job-types';

const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['READY', 'CANCELLED'],
  READY: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'RETRYING', 'FAILED'],
  RETRYING: ['READY', 'CANCELLED'],
  FAILED: ['DEAD_LETTER'],
  COMPLETED: [], // Terminal
  DEAD_LETTER: ['READY'], // Allowed only via explicit manual replay
  CANCELLED: [], // Terminal
};

export class JobStateMachine {
  /**
   * Checks if transition between two job states is permitted.
   */
  static canTransition(from: JobStatus, to: JobStatus): boolean {
    const allowed = ALLOWED_JOB_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  /**
   * Validates and updates a job's status. Throws on invalid transition.
   */
  static transition(job: RecoveryJob, nextStatus: JobStatus): RecoveryJob {
    if (!this.canTransition(job.status, nextStatus)) {
      throw new Error(
        `[JobStateError] Invalid transition from '${job.status}' to '${nextStatus}' for job ${job.jobId}`
      );
    }

    return {
      ...job,
      status: nextStatus,
    };
  }
}

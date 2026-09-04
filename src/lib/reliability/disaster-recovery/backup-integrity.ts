/**
 * Phase 8.8 — Backup Integrity Verifier
 *
 * Provides cryptographic checksum verification (SHA-256), metadata consistency
 * assertions, environment checks, and tamper detection for database backups.
 */

import crypto from 'crypto';
import { BackupMetadataRecord } from './dr-types';

export class BackupIntegrityService {
  /**
   * Computes a canonical SHA-256 checksum for arbitrary payload / artifact bytes.
   */
  static computeChecksum(payload: Buffer | string): string {
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verifies that the backup metadata conforms to strict integrity invariants.
   */
  static verifyMetadataIntegrity(backup: BackupMetadataRecord): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!backup.backupId || typeof backup.backupId !== 'string') {
      errors.push('Missing or invalid backupId');
    }

    if (!backup.databaseIdentifier) {
      errors.push('Missing databaseIdentifier');
    }

    if (!backup.checksum || backup.checksum.length !== 64) {
      errors.push('Invalid checksum: must be a 64-character SHA-256 hex string');
    }

    if (backup.sizeBytes <= 0) {
      errors.push('Invalid sizeBytes: backup payload cannot be empty');
    }

    const started = new Date(backup.startedAt).getTime();
    if (isNaN(started)) {
      errors.push('Invalid startedAt timestamp');
    }

    if (backup.completedAt) {
      const completed = new Date(backup.completedAt).getTime();
      if (isNaN(completed)) {
        errors.push('Invalid completedAt timestamp');
      } else if (completed < started) {
        errors.push('Temporal inconsistency: completedAt is earlier than startedAt');
      }
    }

    const validStatuses = ['STARTED', 'COMPLETED', 'FAILED', 'VERIFIED', 'CORRUPT', 'EXPIRED'];
    if (!validStatuses.includes(backup.status)) {
      errors.push(`Unknown backup status '${backup.status}'`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compares the stored checksum against an actual artifact digest.
   */
  static verifyArtifactChecksum(
    storedChecksum: string,
    artifactPayload: Buffer | string
  ): {
    matches: boolean;
    computedChecksum: string;
  } {
    const computedChecksum = this.computeChecksum(artifactPayload);
    const matches = computedChecksum.toLowerCase() === storedChecksum.toLowerCase();
    return {
      matches,
      computedChecksum,
    };
  }
}

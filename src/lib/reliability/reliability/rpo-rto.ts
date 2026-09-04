/**
 * Phase 8.8 — RPO & RTO Metrics Model
 *
 * Distinguishes between configured recovery targets and actually observed metrics.
 */

import { RECOVERY_OBJECTIVES } from '../disaster-recovery/dr-config';

export interface RpoRtoMetric {
  domain: string;
  targetRpoMinutes: number;
  observedRpoMinutes?: number;
  rpoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN';
  targetRtoMinutes: number;
  observedRtoMinutes?: number;
  rtoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN';
  lastMeasurementAt: string;
}

export class RpoRtoService {
  /**
   * Evaluates current RPO / RTO status across all platform domains.
   */
  static getRpoRtoStatus(params?: {
    lastBackupTimestamp?: string;
    lastRestoreDurationMs?: number;
  }): RpoRtoMetric[] {
    const now = Date.now();
    const nowIso = new Date().toISOString();

    return Object.entries(RECOVERY_OBJECTIVES).map(([key, obj]) => {
      let observedRpo: number | undefined;
      let rpoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN' = 'UNKNOWN';
      let observedRto: number | undefined;
      let rtoStatus: 'WITHIN_OBJECTIVE' | 'BREACHED' | 'UNKNOWN' = 'UNKNOWN';

      if (key === 'database' && params?.lastBackupTimestamp) {
        const backupAgeMinutes = (now - new Date(params.lastBackupTimestamp).getTime()) / (1000 * 60);
        observedRpo = Math.round(backupAgeMinutes);
        rpoStatus = backupAgeMinutes <= obj.targetRpoMinutes * 60 ? 'WITHIN_OBJECTIVE' : 'BREACHED';
      }

      if (key === 'database' && params?.lastRestoreDurationMs) {
        const restoreMinutes = params.lastRestoreDurationMs / (1000 * 60);
        observedRto = Number(restoreMinutes.toFixed(2));
        rtoStatus = restoreMinutes <= obj.targetRtoMinutes ? 'WITHIN_OBJECTIVE' : 'BREACHED';
      }

      return {
        domain: obj.domain,
        targetRpoMinutes: obj.targetRpoMinutes,
        observedRpoMinutes: observedRpo,
        rpoStatus,
        targetRtoMinutes: obj.targetRtoMinutes,
        observedRtoMinutes: observedRto,
        rtoStatus,
        lastMeasurementAt: nowIso,
      };
    });
  }
}

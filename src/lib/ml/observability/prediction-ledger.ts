import { PredictionLedgerEntry } from './observability-types';

export class PredictionLedger {
  private static entries: PredictionLedgerEntry[] = [];
  private static maxEntries = 50000;

  /**
   * Records a shadow prediction entry
   */
  static recordPrediction(entry: Omit<PredictionLedgerEntry, 'id' | 'timestamp'>): PredictionLedgerEntry {
    const fullEntry: PredictionLedgerEntry = {
      ...entry,
      id: `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(fullEntry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift(); // Keep bounded
    }

    return fullEntry;
  }

  /**
   * Records the real-world settlement outcome for a transaction
   */
  static recordOutcome(transactionId: string, recovered: boolean, recoveryMinutes?: number): boolean {
    const entry = this.entries.find(e => e.transactionId === transactionId);
    if (entry) {
      entry.actualRecovered = recovered;
      entry.actualRecoveryMinutes = recoveryMinutes;
      return true;
    }
    return false;
  }

  /**
   * Returns all ledger entries
   */
  static getAllEntries(): PredictionLedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Returns entries that have matched real-world outcomes
   */
  static getResolvedEntries(): PredictionLedgerEntry[] {
    return this.entries.filter(e => e.actualRecovered !== undefined);
  }

  static clear(): void {
    this.entries = [];
  }
}

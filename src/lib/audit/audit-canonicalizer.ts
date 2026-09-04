/**
 * RecoverIQ — Deterministic Canonicalizer & SHA-256 Hasher (Phase 8.7.1)
 *
 * Implements deterministic canonical serialization and cryptographic hash chaining
 * for append-only audit ledger records.
 */

import crypto from 'crypto';

export class AuditCanonicalizer {
  /**
   * Deterministically normalizes and sorts any JavaScript value into a stable JSON string.
   */
  static canonicalize(value: any): string {
    return JSON.stringify(this.sortObjectRecursively(value));
  }

  /**
   * Recursively sorts object keys lexicographically and standardizes values.
   */
  private static sortObjectRecursively(val: any): any {
    if (val === null || val === undefined) {
      return null;
    }

    if (val instanceof Date) {
      return val.toISOString();
    }

    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (typeof val !== 'object') {
      return val;
    }

    if (Array.isArray(val)) {
      return val.map(item => this.sortObjectRecursively(item));
    }

    const sortedKeys = Object.keys(val).sort();
    const sortedObj: Record<string, any> = {};

    for (const key of sortedKeys) {
      const v = val[key];
      if (v !== undefined) {
        sortedObj[key] = this.sortObjectRecursively(v);
      }
    }

    return sortedObj;
  }

  /**
   * Computes deterministic SHA-256 hash of the canonical payload chained with previousEventHash.
   *
   * eventHash = SHA256(canonicalPayload + ":" + (previousEventHash || "GENESIS"))
   */
  static computeHash(canonicalPayload: string, previousEventHash: string | null): string {
    const prevHash = previousEventHash || 'GENESIS';
    const input = `${canonicalPayload}:${prevHash}`;
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * Builds the canonical payload dictionary for an audit event.
   */
  static buildCanonicalPayload(event: {
    sequenceNumber: number;
    organizationId: string | null;
    merchantId: string | null;
    actorType: string;
    actorId: string | null;
    action: string;
    category: string;
    severity: string;
    result: string;
    resourceType: string | null;
    resourceId: string | null;
    requestId: string | null;
    sessionId: string | null;
    metadata: any;
    previousState: any;
    newState: any;
    occurredAt: string;
    schemaVersion: number;
  }): string {
    return this.canonicalize({
      sequenceNumber: event.sequenceNumber,
      organizationId: event.organizationId,
      merchantId: event.merchantId,
      actorType: event.actorType,
      actorId: event.actorId,
      action: event.action,
      category: event.category,
      severity: event.severity,
      result: event.result,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      requestId: event.requestId,
      sessionId: event.sessionId,
      metadata: event.metadata,
      previousState: event.previousState,
      newState: event.newState,
      occurredAt: event.occurredAt,
      schemaVersion: event.schemaVersion,
    });
  }
}

import { RolloutTier, ROLLOUT_TIER_PERCENTAGES } from './activation-types';

export class TrafficRouter {
  /**
   * Deterministic 32-bit FNV-1a hash
   */
  private static fnv1aHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  /**
   * Calculates deterministic bucket (0-99) for a transaction
   */
  static getTrafficBucket(transactionId: string, merchantId = 'default'): number {
    const key = `${merchantId}:${transactionId}`;
    return this.fnv1aHash(key) % 100;
  }

  /**
   * Evaluates whether a transaction is assigned to the active ML canary slice
   */
  static isAssignedToCanary(params: {
    transactionId: string;
    merchantId?: string;
    rolloutTier?: RolloutTier;
    customPercentage?: number;
  }): {
    isAssigned: boolean;
    bucket: number;
    thresholdPercentage: number;
  } {
    const { transactionId, merchantId = 'default', rolloutTier } = params;

    const thresholdPercentage =
      params.customPercentage ??
      (rolloutTier ? ROLLOUT_TIER_PERCENTAGES[rolloutTier] : 0);

    if (thresholdPercentage <= 0) {
      return { isAssigned: false, bucket: 0, thresholdPercentage: 0 };
    }

    if (thresholdPercentage >= 100) {
      return { isAssigned: true, bucket: 0, thresholdPercentage: 100 };
    }

    const bucket = this.getTrafficBucket(transactionId, merchantId);
    const isAssigned = bucket < thresholdPercentage;

    return {
      isAssigned,
      bucket,
      thresholdPercentage,
    };
  }
}

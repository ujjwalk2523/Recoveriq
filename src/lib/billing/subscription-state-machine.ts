import { SubscriptionStatusType } from './billing-types';
import { InvalidSubscriptionTransitionError } from './billing-errors';

// Deterministic map of allowed transitions
const ALLOWED_TRANSITIONS: Record<SubscriptionStatusType, SubscriptionStatusType[]> = {
  [SubscriptionStatusType.TRIALING]: [
    SubscriptionStatusType.ACTIVE,
    SubscriptionStatusType.CANCELLED,
    SubscriptionStatusType.EXPIRED,
    SubscriptionStatusType.SUSPENDED,
  ],
  [SubscriptionStatusType.ACTIVE]: [
    SubscriptionStatusType.PAST_DUE,
    SubscriptionStatusType.CANCELLED,
    SubscriptionStatusType.SUSPENDED,
  ],
  [SubscriptionStatusType.PAST_DUE]: [
    SubscriptionStatusType.ACTIVE,
    SubscriptionStatusType.SUSPENDED,
    SubscriptionStatusType.CANCELLED,
  ],
  [SubscriptionStatusType.CANCELLED]: [
    SubscriptionStatusType.EXPIRED,
    SubscriptionStatusType.ACTIVE, // Reactivation
  ],
  [SubscriptionStatusType.SUSPENDED]: [
    SubscriptionStatusType.ACTIVE,
    SubscriptionStatusType.EXPIRED,
  ],
  [SubscriptionStatusType.EXPIRED]: [
    SubscriptionStatusType.ACTIVE, // New checkout / re-subscription
  ],
};

export class SubscriptionStateMachine {
  /**
   * Checks whether a status transition is permitted.
   */
  static canTransition(
    current: SubscriptionStatusType,
    target: SubscriptionStatusType
  ): boolean {
    if (current === target) return true; // No-op
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Validates transition and throws an explicit error if illegal.
   */
  static assertTransition(
    current: SubscriptionStatusType,
    target: SubscriptionStatusType,
    reason?: string
  ): void {
    if (!this.canTransition(current, target)) {
      throw new InvalidSubscriptionTransitionError(current, target, reason);
    }
  }

  /**
   * Returns list of allowed next statuses for a given status.
   */
  static getAllowedNextStatuses(current: SubscriptionStatusType): SubscriptionStatusType[] {
    return [...(ALLOWED_TRANSITIONS[current] || [])];
  }
}

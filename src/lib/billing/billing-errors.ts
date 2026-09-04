export class BillingError extends Error {
  constructor(message: string, public readonly code: string = 'BILLING_ERROR') {
    super(message);
    this.name = 'BillingError';
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor(merchantId: string) {
    super(`No active subscription found for merchant '${merchantId}'.`, 'SUBSCRIPTION_NOT_FOUND');
    this.name = 'SubscriptionNotFoundError';
  }
}

export class InvalidSubscriptionTransitionError extends BillingError {
  constructor(currentStatus: string, targetStatus: string, reason?: string) {
    const detail = reason ? ` Reason: ${reason}` : '';
    super(
      `Illegal subscription transition from '${currentStatus}' to '${targetStatus}'.${detail}`,
      'INVALID_SUBSCRIPTION_TRANSITION'
    );
    this.name = 'InvalidSubscriptionTransitionError';
  }
}

export class EntitlementDeniedError extends BillingError {
  constructor(featureOrLimit: string, merchantId: string, currentPlan: string) {
    super(
      `Merchant '${merchantId}' on plan '${currentPlan}' is not entitled to '${featureOrLimit}'. Upgrade required.`,
      'ENTITLEMENT_DENIED'
    );
    this.name = 'EntitlementDeniedError';
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(planCodeOrId: string) {
    super(`Plan '${planCodeOrId}' does not exist or is inactive.`, 'PLAN_NOT_FOUND');
    this.name = 'PlanNotFoundError';
  }
}

export class UnauthorizedBillingActionError extends BillingError {
  constructor(action: string, role: string) {
    super(`Role '${role}' is not authorized to execute billing action '${action}'.`, 'UNAUTHORIZED_BILLING_ACTION');
    this.name = 'UnauthorizedBillingActionError';
  }
}

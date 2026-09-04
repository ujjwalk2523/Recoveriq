import { Feature, MerchantEntitlements, PlanUsageStats, OveragePolicy, SubscriptionStatusType, UsageMetric } from './billing-types';
import { SubscriptionService } from './subscription-service';
import { PLANS_CONFIG } from './plan-config';
import { EntitlementDeniedError } from './billing-errors';
import { ApplicationError } from '../errors/application-error';

export interface EntitlementEvaluation {
  allowed: boolean;
  reason?: string;
  overage: boolean;
}

export class EntitlementService {
  /**
   * Evaluates if a merchant has access to a specific platform feature based on their
   * active plan and subscription status matrix.
   */
  static async canUseFeature(merchantId: string, feature: Feature): Promise<boolean> {
    const sub = await SubscriptionService.getSubscription(merchantId);

    // If subscription is suspended or expired, block all non-essential features
    if (
      sub.status === SubscriptionStatusType.SUSPENDED ||
      sub.status === SubscriptionStatusType.EXPIRED ||
      sub.status === SubscriptionStatusType.CANCELLED
    ) {
      return false;
    }

    const plan = PLANS_CONFIG[sub.planCode];
    if (!plan) return false;

    return !!plan.features[feature];
  }

  /**
   * Asserts feature entitlement and throws an explicit domain error if denied.
   */
  static async assertFeatureEntitlement(merchantId: string, feature: Feature): Promise<void> {
    const allowed = await this.canUseFeature(merchantId, feature);
    if (!allowed) {
      const sub = await SubscriptionService.getSubscription(merchantId);
      throw new EntitlementDeniedError(feature, merchantId, sub.planCode);
    }
  }

  /**
   * Enforces server-side entitlement for processing a transaction ingestion.
   * Compares against Phase 7.2 immutable usage ledger and evaluates overage policy.
   */
  static async canProcessTransaction(merchantId: string, quantity = 1): Promise<EntitlementEvaluation> {
    const sub = await SubscriptionService.getSubscription(merchantId);

    // Status Matrix enforcement
    if (
      sub.status === SubscriptionStatusType.SUSPENDED ||
      sub.status === SubscriptionStatusType.EXPIRED ||
      sub.status === SubscriptionStatusType.CANCELLED
    ) {
      return {
        allowed: false,
        reason: `Transaction processing blocked: subscription is ${sub.status}.`,
        overage: false,
      };
    }

    const plan = PLANS_CONFIG[sub.planCode];
    if (!plan) {
      return { allowed: false, reason: 'Invalid merchant plan.', overage: false };
    }

    if (plan.includedTransactions === -1) {
      return { allowed: true, overage: false };
    }

    const { UsageService } = await import('./usage-service');
    const summary = await UsageService.getUsageSummary(merchantId);
    const tx = summary.metrics[UsageMetric.TRANSACTIONS_PROCESSED];
    const currentUsed = tx ? tx.used : 0;
    const projected = currentUsed + quantity;

    if (projected <= plan.includedTransactions) {
      return { allowed: true, overage: false };
    }

    // Over limit: evaluate plan overage policy
    if (plan.overagePolicy === OveragePolicy.BLOCK) {
      return {
        allowed: false,
        reason: `Monthly transaction limit of ${plan.includedTransactions.toLocaleString()} reached on Starter plan. Upgrade to Growth to enable automated overage.`,
        overage: false,
      };
    }

    return {
      allowed: true,
      reason: `Processing in billable overage (${projected - plan.includedTransactions} transactions over quota).`,
      overage: true,
    };
  }

  /**
   * Enforces server-side entitlement for executing a payment recovery attempt.
   */
  static async canExecuteRecovery(merchantId: string, quantity = 1): Promise<EntitlementEvaluation> {
    const sub = await SubscriptionService.getSubscription(merchantId);

    if (
      sub.status === SubscriptionStatusType.SUSPENDED ||
      sub.status === SubscriptionStatusType.EXPIRED ||
      sub.status === SubscriptionStatusType.CANCELLED
    ) {
      return {
        allowed: false,
        reason: `Recovery execution paused: subscription is ${sub.status}.`,
        overage: false,
      };
    }

    const plan = PLANS_CONFIG[sub.planCode];
    if (!plan || !plan.features[Feature.AUTONOMOUS_RECOVERY]) {
      return {
        allowed: false,
        reason: 'Autonomous recovery is not enabled on your plan.',
        overage: false,
      };
    }

    if (plan.includedRecoveryAttempts === -1) {
      return { allowed: true, overage: false };
    }

    const { UsageService } = await import('./usage-service');
    const summary = await UsageService.getUsageSummary(merchantId);
    const att = summary.metrics[UsageMetric.RECOVERY_ATTEMPTS];
    const currentUsed = att ? att.used : 0;
    const projected = currentUsed + quantity;

    if (projected <= plan.includedRecoveryAttempts) {
      return { allowed: true, overage: false };
    }

    if (plan.overagePolicy === OveragePolicy.BLOCK) {
      return {
        allowed: false,
        reason: `Monthly recovery attempt limit of ${plan.includedRecoveryAttempts.toLocaleString()} reached. Upgrade plan to continue recoveries.`,
        overage: false,
      };
    }

    return {
      allowed: true,
      reason: `Executing in billable overage (${projected - plan.includedRecoveryAttempts} attempts over quota).`,
      overage: true,
    };
  }

  /**
   * Enforces developer API entitlement.
   */
  static async canUseDeveloperAPI(merchantId: string): Promise<EntitlementEvaluation> {
    const sub = await SubscriptionService.getSubscription(merchantId);

    if (sub.status === SubscriptionStatusType.SUSPENDED || sub.status === SubscriptionStatusType.EXPIRED) {
      return {
        allowed: false,
        reason: `Developer API access suspended: subscription is ${sub.status}.`,
        overage: false,
      };
    }

    const allowed = await this.canUseFeature(merchantId, Feature.API_ACCESS);
    if (!allowed) {
      return {
        allowed: false,
        reason: 'API access is not permitted on this plan.',
        overage: false,
      };
    }

    return { allowed: true, overage: false };
  }

  /**
   * Enforces ML & Advanced Intelligence access.
   */
  static async canUseIntelligence(merchantId: string): Promise<boolean> {
    const ml = await this.canUseFeature(merchantId, Feature.ML_OPTIMIZATION);
    const intel = await this.canUseFeature(merchantId, Feature.ADVANCED_INTELLIGENCE);
    return ml || intel;
  }

  /**
   * Enforces recovery experiment creation entitlement.
   */
  static async canCreateExperiment(merchantId: string): Promise<EntitlementEvaluation> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    if (sub.status !== SubscriptionStatusType.ACTIVE && sub.status !== SubscriptionStatusType.TRIALING) {
      return {
        allowed: false,
        reason: 'Active subscription required to create recovery experiments.',
        overage: false,
      };
    }

    const hasFeature = await this.canUseFeature(merchantId, Feature.EXPERIMENTS);
    if (!hasFeature) {
      return {
        allowed: false,
        reason: 'Recovery experiments require Growth or Scale plan.',
        overage: false,
      };
    }

    return { allowed: true, overage: false };
  }

  /**
   * Returns monthly transaction limit for the merchant (-1 for unlimited).
   */
  static async getTransactionLimit(merchantId: string): Promise<number> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const plan = PLANS_CONFIG[sub.planCode];
    return plan ? plan.includedTransactions : 5000;
  }

  /**
   * Returns monthly API request limit for the merchant (-1 for unlimited).
   */
  static async getApiRequestLimit(merchantId: string): Promise<number> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const plan = PLANS_CONFIG[sub.planCode];
    return plan ? plan.includedApiRequests : 10000;
  }

  /**
   * Returns monthly recovery attempt limit for the merchant (-1 for unlimited).
   */
  static async getRecoveryAttemptLimit(merchantId: string): Promise<number> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const plan = PLANS_CONFIG[sub.planCode];
    return plan ? plan.includedRecoveryAttempts : 10000;
  }

  /**
   * Returns complete entitlement matrix for a merchant.
   */
  static async getMerchantEntitlements(merchantId: string): Promise<MerchantEntitlements> {
    const sub = await SubscriptionService.getSubscription(merchantId);
    const isValid = SubscriptionService.isSubscriptionActive(sub);
    const plan = PLANS_CONFIG[sub.planCode];

    return {
      merchantId,
      planCode: sub.planCode,
      status: sub.status,
      isSubscriptionValid: isValid,
      features: plan ? plan.features : ({} as any),
      limits: {
        maxMonthlyTransactions: plan ? plan.includedTransactions : 5000,
        maxMonthlyRecoveryAttempts: plan ? plan.includedRecoveryAttempts : 10000,
        maxMonthlyApiRequests: plan ? plan.includedApiRequests : 10000,
      },
    };
  }

  /**
   * Calculates current monthly usage against plan allowances from the immutable ledger.
   */
  static async getPlanUsage(merchantId: string): Promise<PlanUsageStats> {
    const { UsageService } = await import('./usage-service');
    const summary = await UsageService.getUsageSummary(merchantId);

    const tx = summary.metrics[UsageMetric.TRANSACTIONS_PROCESSED];
    const att = summary.metrics[UsageMetric.RECOVERY_ATTEMPTS];
    const api = summary.metrics[UsageMetric.API_REQUESTS];

    return {
      transactionsCount: tx ? tx.used : 0,
      transactionsLimit: tx ? tx.included : 5000,
      recoveryAttemptsCount: att ? att.used : 10000,
      recoveryAttemptsLimit: att ? att.included : 10000,
      apiRequestsCount: api ? api.used : 0,
      apiRequestsLimit: api ? api.included : 10000,
    };
  }

  /**
   * Asserts whether a member seat count is permitted under the merchant/organization subscription plan.
   */
  static assertMemberLimitAllowed(merchantIdOrPlanCode: string, candidateMemberCount: number): boolean {
    let plan = (PLANS_CONFIG as any)[merchantIdOrPlanCode];
    let planCode = merchantIdOrPlanCode;
    if (!plan) {
      plan = (PLANS_CONFIG as any)['STARTER'];
      planCode = 'STARTER';
    }
    const maxMembers = plan?.includedMembers ?? 5;

    if (maxMembers !== -1 && candidateMemberCount >= maxMembers) {
      throw new PlanLimitExceededError(
        `Plan '${planCode}' allows up to ${maxMembers} members. Current request would result in ${candidateMemberCount + 1}. Upgrade your plan to invite more members.`
      );
    }
    return true;
  }

  /**
   * Asserts whether a team count is permitted under the merchant/organization subscription plan.
   */
  static assertTeamLimitAllowed(merchantIdOrPlanCode: string, candidateTeamCount: number): boolean {
    let plan = (PLANS_CONFIG as any)[merchantIdOrPlanCode];
    let planCode = merchantIdOrPlanCode;
    if (!plan) {
      plan = (PLANS_CONFIG as any)['STARTER'];
      planCode = 'STARTER';
    }
    const maxTeams = plan?.includedTeams ?? 2;

    if (maxTeams !== -1 && candidateTeamCount >= maxTeams) {
      throw new PlanLimitExceededError(
        `Plan '${planCode}' allows up to ${maxTeams} teams. Current request would result in ${candidateTeamCount + 1}. Upgrade your plan to create more teams.`
      );
    }
    return true;
  }
}

export class PlanLimitExceededError extends ApplicationError {
  constructor(message: string) {
    super({
      code: 'PLAN_LIMIT_EXCEEDED',
      message,
      statusCode: 403,
      safeMessage: message,
    });
  }
}

export const assertMemberLimitAllowed = (planOrMerchant: string, count: number) =>
  EntitlementService.assertMemberLimitAllowed(planOrMerchant, count);

export const assertTeamLimitAllowed = (planOrMerchant: string, count: number) =>
  EntitlementService.assertTeamLimitAllowed(planOrMerchant, count);

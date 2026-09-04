import { prisma } from '@/lib/db/prisma';
import { PlanCode, PlanDefinition, OveragePolicy } from './billing-types';
import { PLANS_CONFIG } from './plan-config';
import { PlanNotFoundError } from './billing-errors';

export class PlanService {
  /**
   * Resolves a plan by its PlanCode or database ID.
   */
  static async getPlan(codeOrId: string): Promise<PlanDefinition> {
    const upper = codeOrId.toUpperCase() as PlanCode;
    if (PLANS_CONFIG[upper]) {
      return PLANS_CONFIG[upper];
    }

    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbPlan = await prisma.plan.findFirst({
          where: {
            OR: [{ code: upper }, { id: codeOrId }],
            active: true,
          },
        });
        if (dbPlan) {
          const cfg = PLANS_CONFIG[dbPlan.code as PlanCode];
          return {
            id: dbPlan.id,
            code: dbPlan.code as PlanCode,
            name: dbPlan.name,
            description: dbPlan.description,
            monthlyPriceMinor: dbPlan.monthlyPriceMinor,
            annualPriceMinor: cfg?.annualPriceMinor,
            currency: dbPlan.currency,
            includedTransactions: dbPlan.includedTransactions,
            includedRecoveryAttempts: dbPlan.includedRecoveryAttempts,
            includedApiRequests: dbPlan.includedApiRequests,
            features: dbPlan.features as any,
            overagePolicy: cfg?.overagePolicy || OveragePolicy.BLOCK,
            overageRates: cfg?.overageRates || { transactionsPerUnitMinor: 0, recoveryAttemptsPerUnitMinor: 0, apiRequestsPerUnitMinor: 0 },
            trialEligibility: cfg?.trialEligibility || false,
            active: dbPlan.active,
          };
        }
      } catch {
        // DB fallback to config
      }
    }

    throw new PlanNotFoundError(codeOrId);
  }

  /**
   * Returns all active plans available for selection/subscription.
   */
  static async listActivePlans(): Promise<PlanDefinition[]> {
    if (process.env.SKIP_DB !== 'true') {
      try {
        const dbPlans = await prisma.plan.findMany({
          where: { active: true },
          orderBy: { monthlyPriceMinor: 'asc' },
        });
        if (dbPlans.length > 0) {
          return dbPlans.map((p) => {
            const cfg = PLANS_CONFIG[p.code as PlanCode];
            return {
              id: p.id,
              code: p.code as PlanCode,
              name: p.name,
              description: p.description,
              monthlyPriceMinor: p.monthlyPriceMinor,
              annualPriceMinor: cfg?.annualPriceMinor,
              currency: p.currency,
              includedTransactions: p.includedTransactions,
              includedRecoveryAttempts: p.includedRecoveryAttempts,
              includedApiRequests: p.includedApiRequests,
              features: p.features as any,
              overagePolicy: cfg?.overagePolicy || OveragePolicy.BLOCK,
              overageRates: cfg?.overageRates || { transactionsPerUnitMinor: 0, recoveryAttemptsPerUnitMinor: 0, apiRequestsPerUnitMinor: 0 },
              trialEligibility: cfg?.trialEligibility || false,
              active: p.active,
            };
          });
        }
      } catch {
        // Fallback to static config
      }
    }

    return Object.values(PLANS_CONFIG).filter((p) => p.active);
  }

  /**
   * Synchronizes static plan definitions into database if DB is available.
   */
  static async seedPlans(): Promise<void> {
    if (process.env.SKIP_DB === 'true') return;

    for (const plan of Object.values(PLANS_CONFIG)) {
      try {
        await prisma.plan.upsert({
          where: { code: plan.code },
          update: {
            name: plan.name,
            description: plan.description,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            currency: plan.currency,
            includedTransactions: plan.includedTransactions,
            includedRecoveryAttempts: plan.includedRecoveryAttempts,
            includedApiRequests: plan.includedApiRequests,
            features: plan.features as any,
            active: plan.active,
          },
          create: {
            code: plan.code,
            name: plan.name,
            description: plan.description,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            currency: plan.currency,
            includedTransactions: plan.includedTransactions,
            includedRecoveryAttempts: plan.includedRecoveryAttempts,
            includedApiRequests: plan.includedApiRequests,
            features: plan.features as any,
            active: plan.active,
          },
        });
      } catch {
        // Resilient
      }
    }
  }
}

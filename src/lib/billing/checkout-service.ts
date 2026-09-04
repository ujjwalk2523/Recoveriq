import { getBillingProvider } from './billing-provider';
import { PlanCode, ProviderCheckoutSession } from './billing-types';
import { PLANS_CONFIG } from './plan-config';
import { AuditService } from '@/lib/services/audit.service';

export interface CheckoutRequest {
  merchantId: string;
  planCode: PlanCode;
  billingPeriod?: 'MONTHLY' | 'ANNUAL';
  customerEmail: string;
  customerName: string;
  actor?: string;
}

export const IN_MEMORY_CHECKOUT_SESSIONS = new Map<string, ProviderCheckoutSession>();

export class CheckoutService {
  /**
   * Creates a provider-backed SaaS checkout session for plan upgrade or onboarding.
   */
  static async createCheckoutSession(params: CheckoutRequest): Promise<ProviderCheckoutSession> {
    const { merchantId, planCode, billingPeriod = 'MONTHLY', customerEmail, customerName, actor = 'SYSTEM' } = params;

    const plan = PLANS_CONFIG[planCode];
    if (!plan || !plan.active) {
      throw new Error(`Plan '${planCode}' is invalid or inactive.`);
    }

    if (planCode === PlanCode.ENTERPRISE) {
      throw new Error('Enterprise plan requires bespoke agreement. Contact enterprise sales.');
    }

    const provider = getBillingProvider();
    const session = await provider.createCheckout({
      merchantId,
      planCode,
      billingPeriod,
      customerEmail,
      customerName,
    });

    IN_MEMORY_CHECKOUT_SESSIONS.set(session.sessionId, session);

    try {
      await AuditService.logEvent({
        merchantId,
        actorType: 'BILLING_CHECKOUT',
        actorName: actor,
        action: 'CHECKOUT_CREATED',
        entityType: 'SUBSCRIPTION',
        entityId: session.sessionId,
        details: `Initiated SaaS checkout for plan '${planCode}' (${billingPeriod}) via ${provider.provider} (Test Mode: ${session.isTestMode}).`,
      });
    } catch {
      // non-blocking
    }

    return session;
  }

  static getSession(sessionId: string): ProviderCheckoutSession | null {
    return IN_MEMORY_CHECKOUT_SESSIONS.get(sessionId) || null;
  }

  static clearCache(): void {
    IN_MEMORY_CHECKOUT_SESSIONS.clear();
  }
}

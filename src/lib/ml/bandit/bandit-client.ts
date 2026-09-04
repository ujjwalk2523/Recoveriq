import {
  BanditDecisionRequest,
  BanditDecisionResponse,
  BanditOutcomeRequest,
  BanditOutcomeResponse,
  BanditHealthResponse,
} from './bandit-types';

export class BanditClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(
    baseUrl = process.env.BANDIT_SERVICE_URL || 'http://127.0.0.1:8001',
    timeoutMs = 1500
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Invokes Python service to get Contextual Thompson Sampling decision.
   * Fails gracefully to null if service is offline.
   */
  async decide(request: BanditDecisionRequest): Promise<BanditDecisionResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/bandit/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.warn(`[BanditClient] Decision API returned status ${res.status}: ${errorText}`);
        return null;
      }

      return (await res.json()) as BanditDecisionResponse;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[BanditClient] Timeout (${this.timeoutMs}ms) reaching Python Bandit service at ${this.baseUrl}`);
      } else {
        console.warn(`[BanditClient] Python service unavailable at ${this.baseUrl}: ${err.message}`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Reports real-world recovery outcome to update posterior model.
   */
  async recordOutcome(request: BanditOutcomeRequest): Promise<BanditOutcomeResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload = {
        bandit_decision_id: request.bandit_decision_id,
        merchant_id: request.merchant_id || request.merchantId || 'default_merchant',
        transaction_id: request.transaction_id || request.transactionId || 'default_txn',
        selected_action: request.selected_action,
        recovered_amount: request.recovered_amount,
        recovery_cost: request.recovery_cost,
        experience_penalty: request.experience_penalty,
        risk_penalty: request.risk_penalty,
        outcome: request.outcome,
        context_snapshot: request.context_snapshot,
      };

      const res = await fetch(`${this.baseUrl}/v1/bandit/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.warn(`[BanditClient] Outcome API returned status ${res.status}: ${errorText}`);
        return null;
      }

      return (await res.json()) as BanditOutcomeResponse;
    } catch (err: any) {
      console.warn(`[BanditClient] Failed to report outcome to Python service: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Health check for Python service.
   */
  async getHealth(): Promise<BanditHealthResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);

    try {
      const res = await fetch(`${this.baseUrl}/v1/bandit/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) return null;
      return (await res.json()) as BanditHealthResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retrieves model hyperparameters and per-action telemetry.
   */
  async getModel(merchantId = 'global'): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);

    try {
      const res = await fetch(`${this.baseUrl}/v1/bandit/model?merchant_id=${encodeURIComponent(merchantId)}`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const defaultBanditClient = new BanditClient();

export type EndpointHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'PENDING';

export interface EndpointHealthMetrics {
  health: EndpointHealthStatus;
  successRate: number; // 0 to 100%
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deadLetterCount: number;
  avgLatencyMs: number;
}

export class WebhookHealthCalculator {
  /**
   * Deterministically computes health status for a webhook endpoint.
   * Requires a minimum observation window (5 deliveries) before flagging degradation.
   */
  static evaluateHealth(deliveries: Array<{
    status: string;
    latencyMs?: number | null;
  }>): EndpointHealthMetrics {
    if (!deliveries || deliveries.length === 0) {
      return {
        health: 'PENDING',
        successRate: 100,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deadLetterCount: 0,
        avgLatencyMs: 0,
      };
    }

    const total = deliveries.length;
    let successful = 0;
    let failed = 0;
    let deadLetter = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const d of deliveries) {
      if (d.status === 'DELIVERED') {
        successful++;
      } else if (d.status === 'DEAD_LETTER') {
        deadLetter++;
        failed++;
      } else if (d.status === 'FAILED') {
        failed++;
      }

      if (d.latencyMs != null && d.latencyMs > 0) {
        totalLatency += d.latencyMs;
        latencyCount++;
      }
    }

    const successRate = total > 0 ? Math.round((successful / total) * 1000) / 10 : 100;
    const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    // Minimum 5 deliveries needed to declare non-healthy
    if (total < 5) {
      return {
        health: 'HEALTHY',
        successRate,
        totalDeliveries: total,
        successfulDeliveries: successful,
        failedDeliveries: failed,
        deadLetterCount: deadLetter,
        avgLatencyMs,
      };
    }

    let health: EndpointHealthStatus = 'HEALTHY';
    if (successRate < 95) {
      health = 'FAILING';
    } else if (successRate < 99) {
      health = 'DEGRADED';
    }

    return {
      health,
      successRate,
      totalDeliveries: total,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      deadLetterCount: deadLetter,
      avgLatencyMs,
    };
  }
}

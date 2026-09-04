/**
 * Statistical Smoothing & Recency Decay Engine for Phase 6.8
 */

export class DecayEngine {
  // Default Beta-Binomial prior parameters (prior belief = 50% recovery rate with 4 pseudo-observations)
  private static readonly DEFAULT_ALPHA = 2.0;
  private static readonly DEFAULT_BETA = 2.0;

  // Recency decay half-life: 14 days (in minutes)
  // lambda = ln(2) / halfLifeMinutes
  private static readonly HALF_LIFE_DAYS = 14;
  private static readonly HALF_LIFE_MINUTES = 14 * 24 * 60;
  private static readonly DECAY_LAMBDA = Math.LN2 / DecayEngine.HALF_LIFE_MINUTES;

  /**
   * Computes Beta-Binomial smoothed probability to prevent overfitting on low sample sizes.
   * Formula: smoothed_rate = (successes + alpha) / (attempts + alpha + beta)
   */
  static smoothRate(
    successes: number,
    attempts: number,
    alpha: number = DecayEngine.DEFAULT_ALPHA,
    beta: number = DecayEngine.DEFAULT_BETA
  ): number {
    if (attempts < 0 || successes < 0) return 0.5;
    const rate = (successes + alpha) / (attempts + alpha + beta);
    return Math.round(rate * 10000) / 10000; // 4 decimal places
  }

  /**
   * Computes recency weight using exponential decay.
   * Formula: w = exp(-lambda * ageMinutes)
   * A sample from right now has weight 1.0; a sample from 14 days ago has weight 0.5.
   */
  static computeRecencyWeight(timestamp: string | Date, referenceDate: Date = new Date()): number {
    const eventTime = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();
    const ageMinutes = Math.max(0, (referenceDate.getTime() - eventTime) / (1000 * 60));
    const weight = Math.exp(-DecayEngine.DECAY_LAMBDA * ageMinutes);
    return Math.round(weight * 10000) / 10000;
  }

  /**
   * Applies time-decay weighting to an incremental value update.
   */
  static applyDecay(currentValue: number, ageMinutes: number): number {
    const weight = Math.exp(-DecayEngine.DECAY_LAMBDA * ageMinutes);
    return currentValue * weight;
  }
}

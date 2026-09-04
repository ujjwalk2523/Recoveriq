import { CustomerBehavioralSegment } from './learning-types';

export interface CustomerBehavioralSignals {
  totalAttempts: number;
  totalRecovered: number;
  recoveryRate: number;
  lifetimeValue: number;
  fatigueScore: number;
  riskScore: number;
  retrySuccessCount: number;
  retryFailureCount: number;
  linkSuccessCount: number;
  whatsappSuccessCount: number;
  preferredHour?: number;
}

export class SegmentEngine {
  /**
   * Deterministically assigns explainable behavioral segments based on historical metrics.
   * Evaluated in priority order to produce the primary customer archetype.
   */
  static classifySegment(signals: CustomerBehavioralSignals): {
    primarySegment: CustomerBehavioralSegment;
    applicableSegments: CustomerBehavioralSegment[];
    rationale: string;
  } {
    const applicable: CustomerBehavioralSegment[] = [];

    // 1. Safety & Risk Signals
    if (signals.riskScore >= 60) applicable.push('HIGH_RISK');
    if (signals.fatigueScore >= 70) applicable.push('HIGH_FATIGUE');

    // 2. High Value
    if (signals.lifetimeValue >= 50000) applicable.push('HIGH_VALUE_CUSTOMER');

    // 3. New vs Repeat
    if (signals.totalAttempts === 0) {
      applicable.push('NEW_CUSTOMER');
    } else if (signals.totalRecovered >= 2) {
      applicable.push('REPEAT_CUSTOMER');
    }

    // 4. Recovery Propensity
    if (signals.totalAttempts >= 3) {
      if (signals.recoveryRate >= 0.7) applicable.push('HIGH_RECOVERY_PROPENSITY');
      else if (signals.recoveryRate <= 0.3) applicable.push('LOW_RECOVERY_PROPENSITY');
    }

    // 5. Channel Responsiveness
    if (signals.linkSuccessCount >= 2 && signals.linkSuccessCount >= signals.whatsappSuccessCount) {
      applicable.push('LINK_RESPONSIVE');
    }
    if (signals.whatsappSuccessCount >= 2 && signals.whatsappSuccessCount > signals.linkSuccessCount) {
      applicable.push('WHATSAPP_RESPONSIVE');
    }

    // 6. Retry Tolerance
    if (signals.retrySuccessCount >= 2) {
      applicable.push('RETRY_TOLERANT');
    } else if (signals.retryFailureCount >= 2 && signals.retrySuccessCount === 0) {
      applicable.push('RETRY_SENSITIVE');
    }

    // 7. Time of day
    if (signals.preferredHour !== undefined) {
      if (signals.preferredHour >= 21 || signals.preferredHour <= 5) {
        applicable.push('NIGHTTIME_RECOVERY');
      } else {
        applicable.push('DAYTIME_RECOVERY');
      }
    }

    // Determine primary segment by hierarchy
    let primary: CustomerBehavioralSegment = 'NEW_CUSTOMER';
    let rationale = 'Initial transaction context; insufficient historical behavioral memory.';

    if (applicable.includes('HIGH_RISK')) {
      primary = 'HIGH_RISK';
      rationale = `Elevated dispute or issuer risk score (${signals.riskScore}/100) requires conservative recovery policy.`;
    } else if (applicable.includes('HIGH_FATIGUE')) {
      primary = 'HIGH_FATIGUE';
      rationale = `Contact fatigue threshold reached (${signals.fatigueScore}/100); suppress aggressive automated outreach.`;
    } else if (applicable.includes('HIGH_VALUE_CUSTOMER')) {
      primary = 'HIGH_VALUE_CUSTOMER';
      rationale = `High lifetime customer value (₹${signals.lifetimeValue.toLocaleString('en-IN')}) prioritizes white-glove retention.`;
    } else if (applicable.includes('LINK_RESPONSIVE')) {
      primary = 'LINK_RESPONSIVE';
      rationale = `Historical data shows high link conversion (${signals.linkSuccessCount} successful link recoveries).`;
    } else if (applicable.includes('WHATSAPP_RESPONSIVE')) {
      primary = 'WHATSAPP_RESPONSIVE';
      rationale = `Customer consistently engages and recovers via WhatsApp nudge (${signals.whatsappSuccessCount} recoveries).`;
    } else if (applicable.includes('RETRY_TOLERANT')) {
      primary = 'RETRY_TOLERANT';
      rationale = `Customer transactions frequently resolve via seamless gateway switch retries.`;
    } else if (applicable.includes('HIGH_RECOVERY_PROPENSITY')) {
      primary = 'HIGH_RECOVERY_PROPENSITY';
      rationale = `Customer exhibits strong recovery history (${(signals.recoveryRate * 100).toFixed(1)}% recovery rate).`;
    } else if (applicable.includes('LOW_RECOVERY_PROPENSITY')) {
      primary = 'LOW_RECOVERY_PROPENSITY';
      rationale = `Customer exhibits low historical recovery rate (${(signals.recoveryRate * 100).toFixed(1)}%).`;
    } else if (applicable.includes('REPEAT_CUSTOMER')) {
      primary = 'REPEAT_CUSTOMER';
      rationale = `Customer has multiple previously recovered transactions (${signals.totalRecovered} recoveries).`;
    } else if (applicable.includes('NEW_CUSTOMER')) {
      primary = 'NEW_CUSTOMER';
      rationale = 'Initial transaction context; insufficient historical behavioral memory.';
    } else if (applicable.length > 0) {
      primary = applicable[0];
      rationale = `Assigned based on behavioral profile metrics.`;
    }

    return {
      primarySegment: primary,
      applicableSegments: applicable,
      rationale,
    };
  }
}

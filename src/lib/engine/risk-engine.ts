import { FailureCategory, RecoveryActionType } from './types';
import { FailureSeverity } from './classifier';

export interface RiskAssessment {
  customerRisk: number; // 0 - 100
  transactionRisk: number; // 0 - 100
  recoveryRisk: number; // 0 - 100
  compositeRiskScore: number; // 0 - 100
  riskPenaltyINR: number;
  isHardBlockRequired: boolean;
  requiresHumanApproval: boolean;
  riskReason?: string;
}

export class RiskEngine {
  /**
   * Computes multi-dimensional risk assessment combining customer history, transaction ticket size, and gateway risk flags
   */
  static evaluate(params: {
    amount: number;
    failureCategory: FailureCategory;
    failureCode: string;
    severity: FailureSeverity;
    customerRiskScore: number; // 0 - 100
    confidenceScore: number; // 0 - 100
    actionType: RecoveryActionType;
    disputeRiskThreshold?: number; // e.g. 60
  }): RiskAssessment {
    const {
      amount,
      failureCategory,
      failureCode,
      severity,
      customerRiskScore,
      confidenceScore,
      actionType,
      disputeRiskThreshold = 60,
    } = params;

    // 1. Transaction Risk Score (Based on ticket size liability)
    let transactionRisk = 15;
    if (amount > 100000) transactionRisk = 85;
    else if (amount > 50000) transactionRisk = 65;
    else if (amount > 20000) transactionRisk = 45;
    else if (amount > 10000) transactionRisk = 30;

    // 2. Recovery Risk Score (Gateway failure severity & dispute probability)
    let recoveryRisk = 10;
    let isHardBlockRequired = false;
    let hardBlockReason: string | undefined;

    if (failureCategory === 'RISK_AND_FRAUD' || failureCode === 'CARD_REPORTED_LOST_STOLEN' || failureCode === 'HIGH_RISK_SUSPECTED') {
      recoveryRisk = 95;
      isHardBlockRequired = true;
      hardBlockReason = `Hard block triggered: ${failureCode}. Interventions prohibited to avoid payment network dispute penalties.`;
    } else if (severity === 'HIGH') {
      recoveryRisk = 40;
    } else if (severity === 'MEDIUM') {
      recoveryRisk = 25;
    }

    // 3. Customer Risk Score
    const customerRisk = Math.min(100, Math.max(0, customerRiskScore));

    if (customerRisk >= disputeRiskThreshold) {
      isHardBlockRequired = true;
      hardBlockReason = `Customer dispute risk score (${customerRisk}) exceeds maximum threshold (${disputeRiskThreshold}).`;
    }

    // 4. Composite Risk Score (Weighted average)
    const compositeRiskScore = Math.min(
      100,
      Math.round(customerRisk * 0.45 + recoveryRisk * 0.35 + transactionRisk * 0.20)
    );

    // 5. Monetary Risk Penalty (Expected Dispute / Chargeback Cost)
    // Formula: (Composite Risk % * 0.05) * Transaction Amount
    const disputeLiabilityCost = Math.round((compositeRiskScore / 100) * amount * 0.04);
    const riskPenaltyINR = isHardBlockRequired ? amount : disputeLiabilityCost;

    // 6. Trigger Human Approval Rule: High Amount + High Risk + Low Confidence
    const isHighAmount = amount >= 15000;
    const isHighRisk = compositeRiskScore >= 50;
    const isLowConfidence = confidenceScore < 80;

    const requiresHumanApproval = (isHighAmount && isHighRisk) || (isHighAmount && isLowConfidence);

    let riskReason: string | undefined = hardBlockReason;
    if (!riskReason && requiresHumanApproval) {
      riskReason = `Flagged for human sign-off: High ticket value (₹${amount.toLocaleString('en-IN')}) with composite risk (${compositeRiskScore}/100).`;
    }

    return {
      customerRisk,
      transactionRisk,
      recoveryRisk,
      compositeRiskScore,
      riskPenaltyINR,
      isHardBlockRequired,
      requiresHumanApproval,
      riskReason,
    };
  }
}

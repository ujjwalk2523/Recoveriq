import { CustomerProfile, FailureCategory, PaymentMethod, RecoveryActionType, StrategyYield } from './types';
import { FailureDiagnosis, diagnosePaymentFailure } from './classifier';
import { RecoveryProbabilityService } from './probability-service';
import { FatigueEngine } from './fatigue-engine';
import { RiskEngine } from './risk-engine';
import { calculateExpectedNetRecovery } from './ev-calculator';

export interface StrategyRecommendationResult {
  recommendedAction: RecoveryActionType;
  actionConfidence: number;
  expectedRecoveryValue: number; // Net Expected Recovery
  recoveryProbability: number;
  aiRationale: string;
  whyNotRationale?: string;
  strategyYields: StrategyYield[];
  isSuppressionRecommended: boolean;
  expectedNetRecoveryBreakdown: {
    grossPotential: number;
    interventionCost: number;
    fatiguePenalty: number;
    riskPenalty: number;
    netRecovery: number;
  };
}

export const ALL_RECOVERY_STRATEGIES: {
  type: RecoveryActionType;
  title: string;
  timeHours: number;
  baseRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}[] = [
  { type: 'IMMEDIATE_RETRY', title: 'Immediate Switch Retry', timeHours: 0.1, baseRisk: 'LOW' },
  { type: 'OPTIMAL_DELAYED_RETRY', title: 'Optimal Window Delayed Retry', timeHours: 4.0, baseRisk: 'LOW' },
  { type: 'WHATSAPP_NUDGE', title: 'Interactive 1-Tap WhatsApp Nudge', timeHours: 1.0, baseRisk: 'LOW' },
  { type: 'PAYMENT_LINK', title: 'Multi-Rail Dynamic Payment Link', timeHours: 2.5, baseRisk: 'MEDIUM' },
  { type: 'MANDATE_UPDATE', title: 'Automated Mandate Update Workflow', timeHours: 12.0, baseRisk: 'LOW' },
  { type: 'HUMAN_ESCALATION', title: 'Relationship Manager High-Touch Outreach', timeHours: 24.0, baseRisk: 'HIGH' },
  { type: 'DO_NOT_RECOVER', title: 'Intelligent Suppression (Do Not Recover)', timeHours: 0.0, baseRisk: 'LOW' },
];

export function evaluateRecoveryStrategies(
  amount: number,
  failureCategory: FailureCategory,
  failureCode: string,
  paymentMethod: PaymentMethod,
  customer: CustomerProfile,
  attemptNumber: number = 1,
  hourOfDay: number = new Date().getHours()
): StrategyRecommendationResult {
  // 1. Get structured failure diagnosis
  const diagnosis = diagnosePaymentFailure(failureCode, paymentMethod);

  // 2. Immediate Hard Suppression check (Fraud / Stolen / Zero Recoverability)
  if (diagnosis.recoverability === 'ZERO' || failureCategory === 'RISK_AND_FRAUD') {
    const suppressionYields: StrategyYield[] = ALL_RECOVERY_STRATEGIES.map(def => ({
      actionType: def.type,
      actionTitle: def.title,
      successProbability: def.type === 'DO_NOT_RECOVER' ? 1.0 : 0.0,
      expectedValue: 0,
      interventionCost: 0,
      timeToRecoverHours: def.timeHours,
      riskLevel: def.type === 'DO_NOT_RECOVER' ? 'LOW' : 'HIGH',
      isRecommended: def.type === 'DO_NOT_RECOVER',
      whyNotReason: def.type === 'DO_NOT_RECOVER' ? undefined : 'Prohibited: Issuer security flag or high dispute liability.',
    }));

    return {
      recommendedAction: 'DO_NOT_RECOVER',
      actionConfidence: 99,
      expectedRecoveryValue: 0,
      recoveryProbability: 0.0,
      aiRationale: `Transaction suppressed. Flagged as ${diagnosis.standardCode}. Interventions prohibited to eliminate dispute chargebacks.`,
      whyNotRationale: 'Immediate suppression: Fraud/Hotlisted card risk or zero recoverability.',
      strategyYields: suppressionYields,
      isSuppressionRecommended: true,
      expectedNetRecoveryBreakdown: {
        grossPotential: 0,
        interventionCost: 0,
        fatiguePenalty: 0,
        riskPenalty: amount,
        netRecovery: 0,
      },
    };
  }

  // 3. Multi-Strategy Scoring across all candidate actions
  const evaluatedStrategies: {
    actionType: RecoveryActionType;
    actionTitle: string;
    timeHours: number;
    baseRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    probability: number;
    confidence: number;
    netEV: number;
    grossPotential: number;
    interventionCost: number;
    fatiguePenalty: number;
    riskPenalty: number;
    isAvoided: boolean;
    avoidReason?: string;
  }[] = [];

  for (const strategy of ALL_RECOVERY_STRATEGIES) {
    // Prediction
    const prediction = RecoveryProbabilityService.predict({
      amount,
      paymentMethod,
      failureCategory,
      failureCode,
      severity: diagnosis.severity,
      recoverability: diagnosis.recoverability,
      actionType: strategy.type,
      attemptNumber,
      hourOfDay,
      customerSegment: customer.segment,
      customerRecoveryRate: customer.pastRecoveries > 0 ? 80 : 60,
      customerFatigueScore: customer.fatigueScore,
      customerRiskScore: customer.riskScore,
    });

    // Fatigue analysis
    const fatigue = FatigueEngine.evaluate({
      currentFatigueScore: customer.fatigueScore,
      actionType: strategy.type,
      attemptNumber,
      customerLTV: customer.lifetimeValue,
    });

    // Risk analysis
    const risk = RiskEngine.evaluate({
      amount,
      failureCategory,
      failureCode,
      severity: diagnosis.severity,
      customerRiskScore: customer.riskScore,
      confidenceScore: prediction.confidenceScore,
      actionType: strategy.type,
    });

    // Net Expected Recovery calculation
    const ev = calculateExpectedNetRecovery({
      amount,
      probability: prediction.probability,
      actionType: strategy.type,
      fatiguePenaltyINR: fatigue.fatiguePenaltyINR,
      riskPenaltyINR: risk.riskPenaltyINR,
      confidenceScore: prediction.confidenceScore,
    });

    // Avoidance checks
    const isExplicitlyAvoided = diagnosis.avoidChannels.includes(strategy.type);
    const isFatigueBlocked = fatigue.shouldStopRecovery && strategy.type !== 'IMMEDIATE_RETRY' && strategy.type !== 'OPTIMAL_DELAYED_RETRY' && strategy.type !== 'DO_NOT_RECOVER';

    let avoidReason: string | undefined;
    if (isExplicitlyAvoided) {
      avoidReason = `Channel discouraged for ${diagnosis.category}: ${diagnosis.reasoning}`;
    } else if (isFatigueBlocked) {
      avoidReason = fatigue.exhaustionReason;
    }

    evaluatedStrategies.push({
      actionType: strategy.type,
      actionTitle: strategy.title,
      timeHours: strategy.timeHours,
      baseRisk: strategy.baseRisk,
      probability: prediction.probability,
      confidence: prediction.confidenceScore,
      netEV: isExplicitlyAvoided || isFatigueBlocked ? 0 : ev.netEV,
      grossPotential: ev.grossPotential,
      interventionCost: ev.interventionCost,
      fatiguePenalty: fatigue.fatiguePenaltyINR,
      riskPenalty: risk.riskPenaltyINR,
      isAvoided: isExplicitlyAvoided || isFatigueBlocked,
      avoidReason,
    });
  }

  // 4. Rank candidates by Net Expected Recovery (Descending)
  const sorted = [...evaluatedStrategies].sort((a, b) => b.netEV - a.netEV);
  const bestCandidate = sorted.find(s => !s.isAvoided && s.actionType !== 'DO_NOT_RECOVER') || sorted[0];

  // 5. Construct StrategyYields table
  const strategyYields: StrategyYield[] = evaluatedStrategies.map(s => ({
    actionType: s.actionType,
    actionTitle: s.actionTitle,
    successProbability: s.probability,
    expectedValue: s.netEV,
    interventionCost: s.interventionCost,
    timeToRecoverHours: s.timeHours,
    riskLevel: s.baseRisk,
    isRecommended: s.actionType === bestCandidate.actionType,
    whyNotReason: s.avoidReason || (s.actionType !== bestCandidate.actionType
      ? `Yields lower Net Expected Recovery (₹${s.netEV.toLocaleString('en-IN')} vs ₹${bestCandidate.netEV.toLocaleString('en-IN')}).`
      : undefined),
  }));

  const aiRationale = `Selected ${bestCandidate.actionTitle} maximizing Expected Net Recovery at ₹${bestCandidate.netEV.toLocaleString('en-IN')} (Probability: ${Math.round(bestCandidate.probability * 100)}%). ${diagnosis.reasoning}`;

  return {
    recommendedAction: bestCandidate.actionType,
    actionConfidence: bestCandidate.confidence,
    expectedRecoveryValue: bestCandidate.netEV,
    recoveryProbability: bestCandidate.probability,
    aiRationale,
    whyNotRationale: bestCandidate.avoidReason,
    strategyYields,
    isSuppressionRecommended: bestCandidate.actionType === 'DO_NOT_RECOVER',
    expectedNetRecoveryBreakdown: {
      grossPotential: bestCandidate.grossPotential,
      interventionCost: bestCandidate.interventionCost,
      fatiguePenalty: bestCandidate.fatiguePenalty,
      riskPenalty: bestCandidate.riskPenalty,
      netRecovery: bestCandidate.netEV,
    },
  };
}

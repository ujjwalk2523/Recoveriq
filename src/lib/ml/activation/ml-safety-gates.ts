import { GateCheckResult, GateEvaluationReport } from './activation-types';
import { MLHealthReport } from '../observability/observability-types';

export interface GateEvaluationParams {
  healthReport: MLHealthReport;
  confidence: number;
  fatigueScore: number;
  riskScore: number;
  failureCategory: string;
}

export class MLSafetyGates {
  /**
   * Evaluates all 5 production ML safety gates
   */
  static evaluateGates(params: GateEvaluationParams): GateEvaluationReport {
    const { healthReport, confidence, fatigueScore, riskScore, failureCategory } = params;
    const failureReasons: string[] = [];

    // 1. ML Health Gate (Score >= 75 and Grade != CRITICAL)
    const healthPassed = healthReport.overallScore >= 75 && healthReport.grade !== 'CRITICAL';
    const healthGate: GateCheckResult = {
      gateName: 'ML_HEALTH_GATE',
      passed: healthPassed,
      scoreOrValue: healthReport.overallScore,
      threshold: '>= 75',
      failureReason: healthPassed
        ? undefined
        : `ML Health score is ${healthReport.overallScore}/100 (${healthReport.grade}), below safe activation threshold of 75.`,
    };
    if (!healthPassed) failureReasons.push(healthGate.failureReason!);

    // 2. Calibration Gate (ECE <= 0.12)
    const ece = healthReport.calibration.expectedCalibrationError;
    const calibPassed = ece <= 0.12;
    const calibrationGate: GateCheckResult = {
      gateName: 'CALIBRATION_GATE',
      passed: calibPassed,
      scoreOrValue: `${(ece * 100).toFixed(2)}%`,
      threshold: '<= 12.0%',
      failureReason: calibPassed
        ? undefined
        : `Expected Calibration Error (${(ece * 100).toFixed(2)}%) exceeds reliability threshold of 12.0%.`,
    };
    if (!calibPassed) failureReasons.push(calibrationGate.failureReason!);

    // 3. Confidence Gate (Confidence >= 0.55)
    const confPassed = confidence >= 0.55;
    const confidenceGate: GateCheckResult = {
      gateName: 'CONFIDENCE_GATE',
      passed: confPassed,
      scoreOrValue: `${(confidence * 100).toFixed(1)}%`,
      threshold: '>= 55.0%',
      failureReason: confPassed
        ? undefined
        : `Prediction confidence (${(confidence * 100).toFixed(1)}%) is below required threshold of 55.0%.`,
    };
    if (!confPassed) failureReasons.push(confidenceGate.failureReason!);

    // 4. Drift Gate (Overall status != CRITICAL and outcome delta < 15%)
    const outcomeDelta = Math.abs(healthReport.drift.outcomeDrift.rateDelta);
    const driftPassed =
      healthReport.drift.overallStatus !== 'CRITICAL' && outcomeDelta < 0.15;
    const driftGate: GateCheckResult = {
      gateName: 'DRIFT_GATE',
      passed: driftPassed,
      scoreOrValue: `Status: ${healthReport.drift.overallStatus}, OutcomeDelta: ${(outcomeDelta * 100).toFixed(1)}%`,
      threshold: 'Status != CRITICAL & OutcomeDelta < 15.0%',
      failureReason: driftPassed
        ? undefined
        : `Severe distribution drift detected (Status: ${healthReport.drift.overallStatus}, Outcome Drop: ${(outcomeDelta * 100).toFixed(1)}%).`,
    };
    if (!driftPassed) failureReasons.push(driftGate.failureReason!);

    // 5. Policy Guardrails Gate (Fatigue < 75, Risk < 70, Category != RISK_AND_FRAUD)
    const policyPassed =
      fatigueScore < 75 && riskScore < 70 && failureCategory !== 'RISK_AND_FRAUD';
    const policyGate: GateCheckResult = {
      gateName: 'POLICY_GUARDRAIL_GATE',
      passed: policyPassed,
      scoreOrValue: `Fatigue: ${fatigueScore}, Risk: ${riskScore}, Category: ${failureCategory}`,
      threshold: 'Fatigue < 75 & Risk < 70 & Category != FRAUD',
      failureReason: policyPassed
        ? undefined
        : `Transaction violated policy safety guardrails (Fatigue: ${fatigueScore}, Risk: ${riskScore}, Category: ${failureCategory}).`,
    };
    if (!policyPassed) failureReasons.push(policyGate.failureReason!);

    const allGatesPassed =
      healthPassed && calibPassed && confPassed && driftPassed && policyPassed;

    return {
      allGatesPassed,
      gates: {
        healthGate,
        calibrationGate,
        confidenceGate,
        driftGate,
        policyGate,
      },
      failureReasons,
    };
  }
}

export interface CustomerTransactionHistoryItem {
  id: string;
  amount: number;
  paymentMethod: 'UPI' | 'CARD' | 'NETBANKING' | 'MANDATE' | 'WALLET';
  status: 'FAILED' | 'RECOVERED' | 'RECOVERING' | 'NEEDS_APPROVAL' | 'SUPPRESSED' | 'SUCCESS';
  createdAt: Date | string;
  recoveredAt?: Date | string | null;
  failureCategory?: string;
  attemptsCount?: number;
}

export interface CustomerRecoveryMemory {
  upiSuccessRate: number; // 0 - 100%
  cardSuccessRate: number; // 0 - 100%
  recoveryRate: number; // 0 - 100%
  avgRecoveryDelayMinutes: number;
  bestRecoveryHour: number; // 0 - 23 (e.g., 19:00 = 7 PM)
  retryTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  fatigueScore: number; // 0 - 100
  riskScore: number; // 0 - 100
  pastRecoveries: number;
  totalTransactions: number;
}

/**
 * Computes dynamic behavioral recovery memory for a customer based on historical transactions
 */
export function computeCustomerRecoveryMemory(
  history: CustomerTransactionHistoryItem[],
  initialValues?: Partial<CustomerRecoveryMemory>
): CustomerRecoveryMemory {
  if (!history || history.length === 0) {
    return {
      upiSuccessRate: initialValues?.upiSuccessRate ?? 85,
      cardSuccessRate: initialValues?.cardSuccessRate ?? 70,
      recoveryRate: initialValues?.recoveryRate ?? 72,
      avgRecoveryDelayMinutes: initialValues?.avgRecoveryDelayMinutes ?? 24,
      bestRecoveryHour: initialValues?.bestRecoveryHour ?? 19,
      retryTolerance: initialValues?.retryTolerance ?? 'HIGH',
      fatigueScore: initialValues?.fatigueScore ?? 15,
      riskScore: initialValues?.riskScore ?? 10,
      pastRecoveries: initialValues?.pastRecoveries ?? 0,
      totalTransactions: initialValues?.totalTransactions ?? 1,
    };
  }

  // 1. Payment Method Success Rates
  const upiTxns = history.filter(t => t.paymentMethod === 'UPI');
  const cardTxns = history.filter(t => t.paymentMethod === 'CARD');

  const upiSuccessCount = upiTxns.filter(t => t.status === 'SUCCESS' || t.status === 'RECOVERED').length;
  const cardSuccessCount = cardTxns.filter(t => t.status === 'SUCCESS' || t.status === 'RECOVERED').length;

  const upiSuccessRate = upiTxns.length > 0 ? Math.round((upiSuccessCount / upiTxns.length) * 100) : 80;
  const cardSuccessRate = cardTxns.length > 0 ? Math.round((cardSuccessCount / cardTxns.length) * 100) : 65;

  // 2. Recovery Rate
  const failureEligibleTxns = history.filter(t => t.status !== 'SUCCESS');
  const recoveredTxns = history.filter(t => t.status === 'RECOVERED');
  const pastRecoveries = recoveredTxns.length;

  const recoveryRate = failureEligibleTxns.length > 0
    ? Math.round((recoveredTxns.length / failureEligibleTxns.length) * 100)
    : 75;

  // 3. Average Recovery Delay & Optimal Recovery Hour
  const delays: number[] = [];
  const clearanceHours: number[] = [];

  for (const t of recoveredTxns) {
    if (t.recoveredAt && t.createdAt) {
      const created = new Date(t.createdAt).getTime();
      const recovered = new Date(t.recoveredAt).getTime();
      const delayMin = Math.max(1, Math.round((recovered - created) / 60000));
      delays.push(delayMin);

      const hour = new Date(t.recoveredAt).getHours();
      clearanceHours.push(hour);
    }
  }

  const avgRecoveryDelayMinutes = delays.length > 0
    ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
    : 18;

  // Find most frequent clearance hour (mode) or default to 19 (7 PM IST)
  let bestRecoveryHour = 19;
  if (clearanceHours.length > 0) {
    const hourFrequencies: Record<number, number> = {};
    for (const h of clearanceHours) {
      hourFrequencies[h] = (hourFrequencies[h] || 0) + 1;
    }
    const sortedHours = Object.entries(hourFrequencies).sort((a, b) => b[1] - a[1]);
    bestRecoveryHour = parseInt(sortedHours[0][0], 10);
  }

  // 4. Fatigue Score Calculation (0 - 100)
  // Evaluates recent attempts density in the past 48 hours
  const now = Date.now();
  const recentFailedAttempts = history.filter(t => {
    const time = new Date(t.createdAt).getTime();
    return now - time < 48 * 3600000 && t.status !== 'RECOVERED' && t.status !== 'SUCCESS';
  });

  let rawFatigue = recentFailedAttempts.reduce((acc, t) => acc + (t.attemptsCount || 1) * 12, 5);
  rawFatigue = Math.min(100, Math.max(0, rawFatigue));

  // 5. Risk Score Calculation (0 - 100)
  const fraudOrDisputeTxns = history.filter(t => t.failureCategory === 'RISK_AND_FRAUD' || t.status === 'SUPPRESSED');
  let rawRisk = fraudOrDisputeTxns.length > 0 ? 65 : 8;
  rawRisk = Math.min(100, Math.max(0, rawRisk));

  // 6. Retry Tolerance
  let retryTolerance: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (rawFatigue > 60 || rawRisk > 50) {
    retryTolerance = 'LOW';
  } else if (rawFatigue < 30 && pastRecoveries >= 2) {
    retryTolerance = 'HIGH';
  }

  return {
    upiSuccessRate,
    cardSuccessRate,
    recoveryRate,
    avgRecoveryDelayMinutes,
    bestRecoveryHour,
    retryTolerance,
    fatigueScore: rawFatigue,
    riskScore: rawRisk,
    pastRecoveries,
    totalTransactions: history.length,
  };
}

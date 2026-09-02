import { SimulatorParams, SimulatorResult, Transaction } from './types';

export const DEFAULT_SIMULATOR_PARAMS: SimulatorParams = {
  monthlyFailedVolumeINR: 2500000, // ₹25 Lakhs failed volume
  avgTicketSizeINR: 3800, // ₹3,800 avg ticket
  primaryMethodShare: {
    upi: 60,
    cards: 25,
    netbanking: 10,
    mandates: 5,
  },
  retryDelayHours: 6,
  whatsAppEnabled: true,
  whatsAppCostINR: 1.5,
  paymentLinkEnabled: true,
  fatiguePenaltyWeight: 1.0,
  aiOptimizationMode: 'BALANCED',
};

export function runRecoverySimulation(
  transactions: Transaction[],
  params: SimulatorParams = DEFAULT_SIMULATOR_PARAMS
): SimulatorResult[] {
  const totalVolume = params.monthlyFailedVolumeINR;
  const avgTicket = params.avgTicketSizeINR;
  const transactionCount = Math.max(50, Math.round(totalVolume / avgTicket));

  // 1. Baseline: Zero Intervention (Natural customer retry on checkout page)
  const baselineRate = 0.12; // 12% natural organic re-attempt
  const baselineRecovered = Math.round(totalVolume * baselineRate);
  const baselineResult: SimulatorResult = {
    strategy: 'Baseline (No Recovery Action)',
    strategyKey: 'BASELINE',
    recoveredRevenueINR: baselineRecovered,
    recoveryRatePercent: 12.0,
    totalInterventionCostINR: 0,
    netRecoveredINR: baselineRecovered,
    roiMultiplier: 1.0,
    customerFatigueIncidents: 0,
    avoidedLossesINR: 0,
    description: 'Organic customer self-recovery without merchant-initiated outreach or smart retries.',
  };

  // 2. Brute-Force Immediate Retry (Common merchant naive approach)
  // Re-hits gateway right away. High failure for insufficient funds / OTP, works only for 504 timeouts.
  const immRetryRate = 0.28;
  const immRecovered = Math.round(totalVolume * immRetryRate);
  const immCost = Math.round(transactionCount * 0.15); // gateway ping fees
  const immFatigue = Math.round(transactionCount * 0.35); // 35% trigger bank SMS notifications
  const immResult: SimulatorResult = {
    strategy: 'Blind Immediate Retry',
    strategyKey: 'IMMEDIATE_RETRY',
    recoveredRevenueINR: immRecovered,
    recoveryRatePercent: 28.0,
    totalInterventionCostINR: immCost,
    netRecoveredINR: immRecovered - immCost,
    roiMultiplier: Math.round((immRecovered / Math.max(1, immCost)) * 10) / 10,
    customerFatigueIncidents: immFatigue,
    avoidedLossesINR: 0,
    description: 'Blindly re-submitting payments to the switch. Ineffective for balance and 3DS issues, and damages bank reputation.',
  };

  // 3. Delayed Batch Retry (e.g. 6-12 hours later or morning window)
  const delayFactor = params.retryDelayHours >= 4 && params.retryDelayHours <= 12 ? 1.15 : 0.95;
  const delayedRate = Math.min(0.48, Math.round(0.38 * delayFactor * 100) / 100);
  const delayedRecovered = Math.round(totalVolume * delayedRate);
  const delayedCost = Math.round(transactionCount * 0.30);
  const delayedFatigue = Math.round(transactionCount * 0.18);
  const delayedResult: SimulatorResult = {
    strategy: `Scheduled Delayed Retry (${params.retryDelayHours}h Window)`,
    strategyKey: 'OPTIMAL_DELAYED_RETRY',
    recoveredRevenueINR: delayedRecovered,
    recoveryRatePercent: Math.round(delayedRate * 100),
    totalInterventionCostINR: delayedCost,
    netRecoveredINR: delayedRecovered - delayedCost,
    roiMultiplier: Math.round((delayedRecovered / Math.max(1, delayedCost)) * 10) / 10,
    customerFatigueIncidents: delayedFatigue,
    avoidedLossesINR: 15000,
    description: 'Waits for banking maintenance to clear and funds replenishment before executing non-intrusive re-debit.',
  };

  // 4. WhatsApp Interactive Nudge Campaign
  const waRate = params.whatsAppEnabled ? 0.52 : 0.0;
  const waRecovered = Math.round(totalVolume * waRate);
  const waCost = params.whatsAppEnabled ? Math.round(transactionCount * params.whatsAppCostINR) : 0;
  const waFatigue = Math.round(transactionCount * 0.14);
  const waResult: SimulatorResult = {
    strategy: 'Interactive WhatsApp 1-Tap Recovery',
    strategyKey: 'WHATSAPP_NUDGE',
    recoveredRevenueINR: waRecovered,
    recoveryRatePercent: Math.round(waRate * 100),
    totalInterventionCostINR: waCost,
    netRecoveredINR: waRecovered - waCost,
    roiMultiplier: waCost > 0 ? Math.round((waRecovered / waCost) * 10) / 10 : 0,
    customerFatigueIncidents: waFatigue,
    avoidedLossesINR: 28000,
    description: 'Sends instant WhatsApp message with 1-click UPI intent & alternate payment options. High customer engagement in India.',
  };

  // 5. Multi-Rail Dynamic Payment Links
  const linkRate = params.paymentLinkEnabled ? 0.44 : 0.0;
  const linkRecovered = Math.round(totalVolume * linkRate);
  const linkCost = params.paymentLinkEnabled ? Math.round(transactionCount * 3.20) : 0;
  const linkFatigue = Math.round(transactionCount * 0.10);
  const linkResult: SimulatorResult = {
    strategy: 'Multi-Rail Dynamic Payment Link',
    strategyKey: 'PAYMENT_LINK',
    recoveredRevenueINR: linkRecovered,
    recoveryRatePercent: Math.round(linkRate * 100),
    totalInterventionCostINR: linkCost,
    netRecoveredINR: linkRecovered - linkCost,
    roiMultiplier: linkCost > 0 ? Math.round((linkRecovered / linkCost) * 10) / 10 : 0,
    customerFatigueIncidents: linkFatigue,
    avoidedLossesINR: 35000,
    description: 'Automated SMS and email checkout link allowing customers to switch from failed UPI to Credit Card / NetBanking.',
  };

  // 6. RecoverIQ AI Dynamic Multi-Touch Optimizer (Flagship)
  // Routes each transaction to its optimal Expected Recovery Value channel + suppresses fraud & fatigued users
  let aiRateMultiplier = 1.0;
  if (params.aiOptimizationMode === 'MAX_REVENUE') aiRateMultiplier = 1.08;
  if (params.aiOptimizationMode === 'MIN_FATIGUE') aiRateMultiplier = 0.96;

  const aiRate = Math.min(0.78, Math.round(0.68 * aiRateMultiplier * 100) / 100);
  const aiRecovered = Math.round(totalVolume * aiRate);
  // Smart routing spends WhatsApp budget only where needed (avg ₹0.85 per item instead of ₹1.5)
  const aiCost = Math.round(transactionCount * 0.85);
  const aiFatigue = Math.round(transactionCount * 0.03); // Minimal fatigue due to suppression
  const avoidedLoss = Math.round(totalVolume * 0.065); // 6.5% fraud & dispute loss saved
  const aiNet = aiRecovered - aiCost + avoidedLoss;

  const aiResult: SimulatorResult = {
    strategy: 'RecoverIQ AI Decision Intelligence',
    strategyKey: 'AI_OPTIMIZED',
    recoveredRevenueINR: aiRecovered,
    recoveryRatePercent: Math.round(aiRate * 100),
    totalInterventionCostINR: aiCost,
    netRecoveredINR: aiNet,
    roiMultiplier: Math.round((aiNet / Math.max(1, aiCost)) * 10) / 10,
    customerFatigueIncidents: aiFatigue,
    avoidedLossesINR: avoidedLoss,
    description: 'Dynamic EV routing: Instant retry on timeouts, salary-window retry on low funds, WhatsApp on OTP dropouts, and hard suppression on fraud & high fatigue.',
  };

  return [
    aiResult,
    delayedResult,
    waResult,
    linkResult,
    immResult,
    baselineResult,
  ];
}

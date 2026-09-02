import { GoogleGenAI } from '@google/genai';
import { CustomerProfile, FailureCategory, PaymentMethod, RecoveryActionType } from './types';

export interface AIDiagnosisResponse {
  rootCauseAnalysis: string;
  recommendedAction: RecoveryActionType;
  confidenceScore: number;
  expectedRecoveryPercentage: number;
  whyNotRecoverReasons: string[];
  optimalInterventionWindow: string;
  recommendedChannelMessage?: string;
  policyNotes: string;
  isAiGenerated: boolean;
}

export async function generateAIDiagnosis(params: {
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  failureCode: string;
  failureCategory: FailureCategory;
  rawError?: string;
  customer: CustomerProfile;
  apiKey?: string;
}): Promise<AIDiagnosisResponse> {
  const {
    transactionId,
    amount,
    currency,
    paymentMethod,
    failureCode,
    failureCategory,
    rawError,
    customer,
    apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  } = params;

  // If apiKey is present, invoke Google Gemini AI
  if (apiKey && apiKey.trim() !== '') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are RecoverIQ's Senior Fintech AI Decision Engine specializing in Indian payment systems (UPI, Cards, eNACH Mandates, NetBanking).
Analyze this failed payment and formulate an Expected-Value (EV) recovery strategy.

TRANSACTION DETAILS:
- ID: ${transactionId}
- Amount: ₹${amount} ${currency}
- Method: ${paymentMethod}
- Failure Code: ${failureCode}
- Category: ${failureCategory}
- Gateway Message: ${rawError || 'N/A'}

CUSTOMER PROFILE:
- Name: ${customer.name}
- Segment: ${customer.segment}
- Lifetime Value: ₹${customer.lifetimeValue}
- Fatigue Score: ${customer.fatigueScore}/100
- Risk Score: ${customer.riskScore}/100
- Past Recoveries: ${customer.pastRecoveries}

CRITICAL RULES:
1. Do NOT blindly retry.
2. If fraud or high fatigue (>80) is detected, recommend DO_NOT_RECOVER and explain why.
3. For OTP/Dropouts, recommend WHATSAPP_NUDGE or PAYMENT_LINK.
4. For transient timeouts, recommend IMMEDIATE_RETRY.
5. For insufficient balance, recommend OPTIMAL_DELAYED_RETRY.

Return JSON in this EXACT schema:
{
  "rootCauseAnalysis": "string detailed root cause",
  "recommendedAction": "IMMEDIATE_RETRY" | "OPTIMAL_DELAYED_RETRY" | "WHATSAPP_NUDGE" | "PAYMENT_LINK" | "MANDATE_UPDATE" | "HUMAN_ESCALATION" | "DO_NOT_RECOVER",
  "confidenceScore": number (50-99),
  "expectedRecoveryPercentage": number (0-100),
  "whyNotRecoverReasons": ["reason 1", "reason 2"],
  "optimalInterventionWindow": "e.g. Within 5 minutes | Tomorrow 10:00 AM IST | None",
  "recommendedChannelMessage": "customized customer message in English or Hinglish if applicable",
  "policyNotes": "policy check notes"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          rootCauseAnalysis: parsed.rootCauseAnalysis,
          recommendedAction: parsed.recommendedAction,
          confidenceScore: parsed.confidenceScore || 85,
          expectedRecoveryPercentage: parsed.expectedRecoveryPercentage || 70,
          whyNotRecoverReasons: parsed.whyNotRecoverReasons || [],
          optimalInterventionWindow: parsed.optimalInterventionWindow || 'Immediate',
          recommendedChannelMessage: parsed.recommendedChannelMessage,
          policyNotes: parsed.policyNotes || 'Evaluated against automated risk thresholds.',
          isAiGenerated: true,
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed or timed out, falling back to heuristic engine:', err);
    }
  }

  // Fallback / Self-Contained High-Accuracy Heuristic Engine
  return generateDeterministicAIDiagnosis(params);
}

export function generateDeterministicAIDiagnosis(params: {
  amount: number;
  paymentMethod: PaymentMethod;
  failureCode: string;
  failureCategory: FailureCategory;
  customer: CustomerProfile;
}): AIDiagnosisResponse {
  const { amount, paymentMethod, failureCode, failureCategory, customer } = params;

  if (failureCategory === 'RISK_AND_FRAUD' || customer.riskScore > 70) {
    return {
      rootCauseAnalysis: `Transaction flagged by issuer risk firewall with risk score ${customer.riskScore}/100. Potential stolen card or automated velocity anomaly.`,
      recommendedAction: 'DO_NOT_RECOVER',
      confidenceScore: 97,
      expectedRecoveryPercentage: 0,
      whyNotRecoverReasons: [
        'High probability of subsequent dispute / chargeback (₹1,500 penalty fee).',
        'Issuer security rules prohibit multiple retries on flagged cards.',
        'Negative expected recovery value.',
      ],
      optimalInterventionWindow: 'Permanently Suppressed',
      policyNotes: 'Automated Fraud Guardrail Rule #412 enforced.',
      isAiGenerated: false,
    };
  }

  if (customer.fatigueScore >= 80) {
    return {
      rootCauseAnalysis: `Customer ${customer.name} is in high fatigue state (${customer.fatigueScore}/100) after multiple recent payment prompts.`,
      recommendedAction: 'DO_NOT_RECOVER',
      confidenceScore: 92,
      expectedRecoveryPercentage: 5,
      whyNotRecoverReasons: [
        'Outreach risks customer relationship and subscription cancellation.',
        'Fatigue penalty outweighs nominal ticket recovery margin.',
      ],
      optimalInterventionWindow: 'Suppress for 72 hours',
      policyNotes: 'Customer Relationship Preservation policy active.',
      isAiGenerated: false,
    };
  }

  if (failureCategory === 'TECHNICAL') {
    return {
      rootCauseAnalysis: `Switch handshake timeout between gateway and ${customer.bankName || 'Issuer Bank'}. Core banking ledger was not debited.`,
      recommendedAction: 'IMMEDIATE_RETRY',
      confidenceScore: 89,
      expectedRecoveryPercentage: 84,
      whyNotRecoverReasons: [
        'No customer action required.',
        'Zero friction path preserves instant checkout conversion.',
      ],
      optimalInterventionWindow: 'Within 60-120 seconds',
      recommendedChannelMessage: undefined,
      policyNotes: 'Zero-cost technical retry qualified under auto-execution policy.',
      isAiGenerated: false,
    };
  }

  if (failureCategory === 'AUTHENTICATION' || failureCategory === 'CUSTOMER_DROPOUT') {
    return {
      rootCauseAnalysis: `User initiated checkout via ${paymentMethod} but dropped before 3DS/UPI PIN authentication. High intent, friction-sensitive drop.`,
      recommendedAction: 'WHATSAPP_NUDGE',
      confidenceScore: 91,
      expectedRecoveryPercentage: 86,
      whyNotRecoverReasons: [
        'Blind retry fails because 3DS OTP requires user presence.',
        'Email has only 18% open rate vs 94% on WhatsApp in India.',
      ],
      optimalInterventionWindow: 'Within 4 minutes of abandonment',
      recommendedChannelMessage: `Hi ${customer.name.split(' ')[0]}, your payment of ₹${amount.toLocaleString('en-IN')} could not be completed. Tap below to complete with 1-click UPI: https://pay.rcvq.in/${customer.id.slice(0, 6)}`,
      policyNotes: 'Interactive nudge authorized under customer notification quota.',
      isAiGenerated: false,
    };
  }

  if (failureCategory === 'INSUFFICIENT_FUNDS') {
    return {
      rootCauseAnalysis: `Debit attempt failed due to insufficient account balance. Customer has active history with ₹${customer.lifetimeValue.toLocaleString('en-IN')} LTV.`,
      recommendedAction: 'OPTIMAL_DELAYED_RETRY',
      confidenceScore: 78,
      expectedRecoveryPercentage: 72,
      whyNotRecoverReasons: [
        'Immediate retry will fail with 88% probability and trigger bank decline fees.',
        'Delayed retry timed to salary cycle (1st-5th) or next morning increases success 3.8x.',
      ],
      optimalInterventionWindow: 'Next morning at 09:30 AM IST',
      recommendedChannelMessage: `Hi ${customer.name}, we will re-attempt your subscription of ₹${amount.toLocaleString('en-IN')} tomorrow morning. You can also update payment method here: https://pay.rcvq.in/upd/${customer.id.slice(0, 6)}`,
      policyNotes: 'Scheduled queue active with silent re-debit.',
      isAiGenerated: false,
    };
  }

  // Default fallback
  return {
    rootCauseAnalysis: `Payment instrument failure on ${paymentMethod}. Recommend dynamic payment link to allow payment method switching.`,
    recommendedAction: 'PAYMENT_LINK',
    confidenceScore: 82,
    expectedRecoveryPercentage: 68,
    whyNotRecoverReasons: ['Direct retry fails if the underlying instrument remains expired or blocked.'],
    optimalInterventionWindow: 'Within 15 minutes',
    recommendedChannelMessage: `Your payment of ₹${amount.toLocaleString('en-IN')} is awaiting completion. Click to pay via UPI / Cards / NetBanking: https://pay.rcvq.in/l/${customer.id.slice(0, 6)}`,
    policyNotes: 'Standard payment link dispatch rule applied.',
    isAiGenerated: false,
  };
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle2, ArrowRight, Building, Sliders, ShieldCheck } from 'lucide-react';
import { useAppState } from '@/lib/store/app-state-provider';

export default function OnboardingPage() {
  const router = useRouter();
  const { updatePolicies } = useAppState();

  const [step, setStep] = useState(1);
  const [businessModel, setBusinessModel] = useState<'SAAS' | 'D2C' | 'ENTERPRISE'>('SAAS');
  const [volume, setVolume] = useState('2500000');
  const [ticket, setTicket] = useState('3800');

  const handleFinish = () => {
    updatePolicies({
      autoApproveMaxAmount: Math.min(30000, Number(ticket) * 3),
      allowAutomatedWhatsAppNudges: true,
      allowAutomatedPaymentLinks: true,
    });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-9 h-9 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold mx-auto shadow-xs">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Merchant Setup</h2>
          <p className="text-xs text-slate-500">Configure your business profile and recovery guardrails</p>
        </div>

        {/* Form Container */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5 text-xs">
          {/* Step indicator */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-semibold text-slate-900">
              Step {step} of 2: {step === 1 ? 'Business model' : 'Policy thresholds'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">{step === 1 ? '50%' : '100%'}</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <label className="font-medium text-slate-700 block">Select your primary business model</label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'SAAS', label: 'B2B SaaS', desc: 'Recurring subs & cards' },
                  { key: 'D2C', label: 'D2C E-Com', desc: 'High UPI & flash checkout' },
                  { key: 'ENTERPRISE', label: 'Enterprise', desc: 'Invoices & netbanking' },
                ].map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => {
                      setBusinessModel(b.key as any);
                      if (b.key === 'SAAS') {
                        setVolume('2500000');
                        setTicket('3800');
                      } else if (b.key === 'D2C') {
                        setVolume('5000000');
                        setTicket('1450');
                      } else {
                        setVolume('8500000');
                        setTicket('24000');
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      businessModel === b.key
                        ? 'bg-slate-50 border-slate-900 font-semibold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">{b.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{b.desc}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Monthly failed volume (₹ INR)</label>
                  <input
                    type="number"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Average order ticket (₹ INR)</label>
                  <input
                    type="number"
                    value={ticket}
                    onChange={(e) => setTicket(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Continue to policy guardrails</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Default safe guardrails</span>
                </div>
                <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                  <li>Auto-approval limit: <strong>₹{Math.min(30000, Number(ticket) * 3).toLocaleString('en-IN')}</strong></li>
                  <li>WhatsApp 1-tap nudge enabled for customer dropout</li>
                  <li>Dispute suppression active for high-risk cards</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs"
                >
                  Complete onboarding & launch dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

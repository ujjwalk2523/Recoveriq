'use client';

import React, { useState } from 'react';
import {
  Settings,
  Key,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAppState } from '@/lib/store/app-state-provider';

export default function SettingsPage() {
  const {
    policies,
    updatePolicies,
    geminiApiKey,
    setGeminiApiKey,
    razorpayKeyId,
    setRazorpayKeyId,
    isDemoMode,
    setIsDemoMode,
  } = useAppState();

  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localRzpKey, setLocalRzpKey] = useState(razorpayKeyId);
  const [localRzpSecret, setLocalRzpSecret] = useState('rzp_test_secret_••••••••');
  const [savedNote, setSavedNote] = useState(false);

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(localGeminiKey);
    setRazorpayKeyId(localRzpKey);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 3000);
  };

  return (
    <AppLayout
      title="Settings & Policies"
      subtitle="Configure recovery thresholds, payment gateway API keys, and autonomous policy rules"
    >
      {savedNote && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Policy Guardrails */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Autonomous recovery policies</h3>
              <p className="text-xs text-slate-500">
                Guardrails determining when actions run automatically vs require review
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-4 text-xs">
            {/* Auto-approve ceiling */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700">Auto-approval maximum amount</label>
                <span className="font-mono font-bold text-slate-900">
                  ₹{policies.autoApproveMaxAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={50000}
                step={1000}
                value={policies.autoApproveMaxAmount}
                onChange={(e) => updatePolicies({ autoApproveMaxAmount: Number(e.target.value) })}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Failed transactions above this amount are gated for manual merchant review.
              </p>
            </div>

            {/* Minimum confidence */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700">Minimum strategy confidence</label>
                <span className="font-mono font-bold text-slate-900">
                  {policies.minConfidenceForAutoApprove}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={policies.minConfidenceForAutoApprove}
                onChange={(e) => updatePolicies({ minConfidenceForAutoApprove: Number(e.target.value) })}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Actions with confidence below this threshold require human approval.
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">VIP customer manual review</p>
                  <p className="text-[11px] text-slate-500">Always hold high-LTV accounts for team review</p>
                </div>
                <input
                  type="checkbox"
                  checked={policies.humanApprovalForVIPs}
                  onChange={(e) => updatePolicies({ humanApprovalForVIPs: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">Automated WhatsApp 1-tap nudge</p>
                  <p className="text-[11px] text-slate-500">Allow instant deep links via official WhatsApp Business API</p>
                </div>
                <input
                  type="checkbox"
                  checked={policies.allowAutomatedWhatsAppNudges}
                  onChange={(e) => updatePolicies({ allowAutomatedWhatsAppNudges: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">Automated payment links</p>
                  <p className="text-[11px] text-slate-500">Dispatch dynamic multi-rail payment links on 3DS failure</p>
                </div>
                <input
                  type="checkbox"
                  checked={policies.allowAutomatedPaymentLinks}
                  onChange={(e) => updatePolicies({ allowAutomatedPaymentLinks: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: API Credentials */}
        <div className="space-y-6">
          <form onSubmit={handleSaveKeys} className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">API credentials</h3>
                <p className="text-xs text-slate-500">Razorpay gateway and Gemini AI model integration</p>
              </div>
              <Key className="w-5 h-5 text-slate-400" />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-medium block mb-1">Razorpay Key ID</label>
                <input
                  type="text"
                  value={localRzpKey}
                  onChange={(e) => setLocalRzpKey(e.target.value)}
                  placeholder="rzp_test_..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Razorpay Key Secret</label>
                <input
                  type="password"
                  value={localRzpSecret}
                  onChange={(e) => setLocalRzpSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Google Gemini API Key (Optional)</label>
                <input
                  type="password"
                  value={localGeminiKey}
                  onChange={(e) => setLocalGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Optional. When empty, RecoverIQ runs on built-in deterministic heuristics.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs"
                >
                  Save API credentials
                </button>
              </div>
            </div>
          </form>

          {/* Mode toggle */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">Demo sandbox mode</h4>
                <p className="text-[11px] text-slate-500">
                  Switch between simulated webhook sandbox and live Razorpay production API.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDemoMode(!isDemoMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isDemoMode
                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                }`}
              >
                {isDemoMode ? 'Demo Sandbox' : 'Production Live'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

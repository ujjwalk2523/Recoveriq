'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('merchant@saasify.in');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      // Fallback for offline demo
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoRole = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-9 h-9 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold mx-auto shadow-xs">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in to RecoverIQ</h2>
          <p className="text-xs text-slate-500">Revenue recovery & SaaS decision intelligence platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 font-sans"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700">Password</label>
              <span className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer">Forgot?</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-70"
          >
            {isLoading ? 'Authenticating tenant session...' : 'Continue to dashboard'}
          </button>

          {/* Quick RBAC Switcher for Demo / Testing */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Multi-Tenant RBAC Test Profiles:</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setDemoRole('merchant@saasify.in')}
                className={`px-2 py-1 rounded text-left border ${
                  email === 'merchant@saasify.in'
                    ? 'border-slate-900 bg-white font-semibold text-slate-900'
                    : 'border-slate-200 bg-slate-100 hover:bg-white text-slate-600'
                }`}
              >
                Admin (SaaSify)
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('owner@saasify.in')}
                className={`px-2 py-1 rounded text-left border ${
                  email === 'owner@saasify.in'
                    ? 'border-slate-900 bg-white font-semibold text-slate-900'
                    : 'border-slate-200 bg-slate-100 hover:bg-white text-slate-600'
                }`}
              >
                Owner (SaaSify)
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('ops@saasify.in')}
                className={`px-2 py-1 rounded text-left border ${
                  email === 'ops@saasify.in'
                    ? 'border-slate-900 bg-white font-semibold text-slate-900'
                    : 'border-slate-200 bg-slate-100 hover:bg-white text-slate-600'
                }`}
              >
                Operator (SaaSify)
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('admin@quickcart.in')}
                className={`px-2 py-1 rounded text-left border ${
                  email === 'admin@quickcart.in'
                    ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900'
                    : 'border-slate-200 bg-slate-100 hover:bg-white text-slate-600'
                }`}
              >
                Tenant B (QuickCart)
              </button>
            </div>
          </div>
        </form>

        <div className="text-center text-xs text-slate-500">
          <span>New merchant? </span>
          <Link href="/onboarding" className="text-slate-900 font-semibold hover:underline">
            Complete quick onboarding
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAppState } from '@/lib/store/app-state-provider';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Dashboard', subtitle = 'Payment recovery performance and decision overview' }: HeaderProps) {
  const {
    simulateIncomingWebhook,
    resetToDefaultData,
    currentUser,
    logout,
  } = useAppState();

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');

  const handleSimulateWebhook = () => {
    simulateIncomingWebhook();
    setNotificationMsg('New failed payment recorded and processed through recovery engine.');
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3500);
  };

  const handleResetData = () => {
    if (confirm('Reset demo transactions and simulator settings to defaults?')) {
      resetToDefaultData();
      setNotificationMsg('Demo data reset to initial seed state.');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3500);
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Title & Context */}
      <div>
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        <p className="text-[11px] text-slate-500 font-normal leading-none mt-0.5">{subtitle}</p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2.5">
        {/* Calm Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Recovery engine: <strong>Active</strong></span>
        </div>

        {/* Sync Indicator */}
        <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
          Synced 2m ago
        </span>

        {/* Simulate Txn Button */}
        <button
          type="button"
          onClick={handleSimulateWebhook}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer shadow-xs"
          title="Simulate incoming payment failure event"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Simulate failure</span>
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={handleResetData}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
          title="Reset dataset"
        >
          <RefreshCw className="w-3 h-3" />
        </button>

        {/* Dynamic User Pill with Role Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-bold shadow-xs">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden lg:flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {currentUser?.name || 'Ujjwal'}
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                  currentUser?.role === 'OWNER'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : currentUser?.role === 'OPERATOR'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : currentUser?.role === 'ANALYST'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                }`}
              >
                {currentUser?.role || 'ADMIN'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono leading-tight">
              {currentUser?.email || 'merchant@saasify.in'}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out / Switch user profile"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer ml-1"
          >
            <span className="text-[10px] font-medium text-slate-500 hover:underline">Exit</span>
          </button>
        </div>
      </div>

      {/* Subtle Toast */}
      {showNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}
    </header>
  );
}

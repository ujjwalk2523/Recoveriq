'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Sparkles,
  Sliders,
  FlaskConical,
  BrainCircuit,
  BarChart3,
  ScrollText,
  Settings,
  ShieldCheck,
  Zap,
  Building,
  CheckCircle2,
  Home,
  Globe,
  CreditCard,
  Code,
} from 'lucide-react';
import { useAppState } from '@/lib/store/app-state-provider';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { merchant, isDemoMode, setIsDemoMode, currentMerchant, currentUser } = useAppState();

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
    {
      name: 'Opportunities',
      href: '/recovery-opportunities',
      icon: Sparkles,
      badge: merchant.pendingApprovalCount > 0 ? merchant.pendingApprovalCount : undefined,
    },
    { name: 'Recovery Simulator', href: '/simulator', icon: Sliders },
    { name: 'Experiment Lab', href: '/experiments', icon: FlaskConical },
    { name: 'Decision Trace', href: '/ai-decisions', icon: BrainCircuit },
    { name: 'Recovery Intelligence', href: '/recovery-intelligence', icon: Sparkles },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Audit Log', href: '/audit-log', icon: ScrollText },
    { name: 'Organization & Team', href: '/settings/organization', icon: Building },
    { name: 'Settings & Policy', href: '/settings', icon: Settings },
    { name: 'Billing & Plans', href: '/settings/billing', icon: CreditCard },
    { name: 'Developer API', href: '/settings/developer', icon: Code },
  ];

  return (
    <aside className="w-60 bg-white text-slate-900 flex flex-col border-r border-slate-200 min-h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group" title="Go to RecoverIQ Home Page">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold shadow-xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 tracking-tight text-sm flex items-center gap-1.5">
              RecoverIQ
            </div>
            <div className="text-[11px] text-slate-500 font-normal">Revenue Recovery</div>
          </div>
        </Link>
      </div>

      {/* Dynamic Merchant Context */}
      <div className="px-3 pt-3">
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {currentMerchant?.name || 'SaaSify India'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {currentUser?.role === 'OPERATOR' ? 'Operator Console' : 'Live Gateway Sync'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-medium uppercase">
            {currentUser?.role || 'PROD'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Platform
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-slate-900' : 'text-slate-400'
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Public Website / Landing Page Link */}
        <div className="pt-2">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>Public Home Page</span>
          </Link>
        </div>
      </nav>

      {/* Footer / Mode switch */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-normal text-[11px]">Demo Mode</span>
          <button
            type="button"
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer ${
              isDemoMode
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium'
            }`}
          >
            {isDemoMode ? 'Active (Demo)' : 'Live API'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          <span>RecoverIQ Core</span>
          <span>v2.4.0</span>
        </div>
      </div>
    </aside>
  );
}

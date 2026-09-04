'use client';

import React from 'react';
import { PaymentStatus, FailureCategory, PaymentMethod } from '@/lib/engine/types';
import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (status) {
    case 'RECOVERED':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Recovered
        </span>
      );
    case 'NEEDS_APPROVAL':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          Review required
        </span>
      );
    case 'RECOVERING':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          In flight
        </span>
      );
    case 'SUPPRESSED':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Suppressed
        </span>
      );
    case 'FAILED':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-rose-50 text-rose-800 border border-rose-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Failed
        </span>
      );
    case 'SUCCESS':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Successful
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
}

export function CategoryBadge({ category }: { category: FailureCategory }) {
  const map: Record<FailureCategory, { label: string; color: string }> = {
    TECHNICAL: { label: 'Switch timeout', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    INSUFFICIENT_FUNDS: { label: 'Low balance', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    AUTHENTICATION: { label: '3DS / OTP drop', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    EXPIRED_OR_INVALID: { label: 'Expired instrument', color: 'bg-orange-50 text-orange-800 border-orange-200' },
    RISK_AND_FRAUD: { label: 'Risk flag', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    CUSTOMER_DROPOUT: { label: 'User abandoned', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    MANDATE_ISSUE: { label: 'Mandate issue', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const item = map[category] || { label: category, color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${item.color}`}>
      {item.label}
    </span>
  );
}

export function MethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
      {method}
    </span>
  );
}

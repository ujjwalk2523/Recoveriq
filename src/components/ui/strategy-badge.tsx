'use client';

import React from 'react';
import { RecoveryActionType } from '@/lib/engine/types';
import { Zap, Clock, MessageSquare, Link2, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';

interface StrategyBadgeProps {
  action: RecoveryActionType;
  showIcon?: boolean;
}

export function StrategyBadge({ action, showIcon = true }: StrategyBadgeProps) {
  const map: Record<RecoveryActionType, { label: string; icon: React.ElementType; color: string }> = {
    IMMEDIATE_RETRY: {
      label: 'Zero-delay retry',
      icon: Zap,
      color: 'bg-slate-100 text-slate-800 border-slate-200',
    },
    OPTIMAL_DELAYED_RETRY: {
      label: 'Scheduled retry (6h)',
      icon: Clock,
      color: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    WHATSAPP_NUDGE: {
      label: 'WhatsApp 1-tap',
      icon: MessageSquare,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
    },
    PAYMENT_LINK: {
      label: 'Payment link',
      icon: Link2,
      color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    },
    MANDATE_UPDATE: {
      label: 'Mandate flow',
      icon: RefreshCw,
      color: 'bg-slate-100 text-slate-800 border-slate-200',
    },
    HUMAN_ESCALATION: {
      label: 'Account manager review',
      icon: UserCheck,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    DO_NOT_RECOVER: {
      label: 'Suppressed',
      icon: ShieldAlert,
      color: 'bg-slate-100 text-slate-600 border-slate-200',
    },
  };

  const item = map[action] || {
    label: action,
    icon: Zap,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const Icon = item.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${item.color}`}>
      {showIcon && <Icon className="w-3 h-3 text-slate-500 shrink-0" />}
      <span>{item.label}</span>
    </span>
  );
}

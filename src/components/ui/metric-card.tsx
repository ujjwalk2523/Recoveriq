'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  badge?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  badge,
}: MetricCardProps) {
  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        {badge && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{value}</div>
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          {subtitle && <span className="text-slate-400 text-[11px] truncate">{subtitle}</span>}
          {trend && (
            <div
              className={`flex items-center gap-1 font-medium text-[11px] ${
                trend.isNeutral
                  ? 'text-slate-500'
                  : trend.isPositive
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              ) : trend.isNeutral ? (
                <Minus className="w-3 h-3 text-slate-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-600" />
              )}
              <span>{trend.value}</span>
              {trend.label && <span className="text-slate-400 text-[10px] font-normal">{trend.label}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { MetricCard } from '@/components/ui/metric-card';
import { useAppState } from '@/lib/store/app-state-provider';

export default function AnalyticsPage() {
  const { merchant } = useAppState();

  const methodData = [
    { method: 'UPI (PhonePe/GPay)', failed: 1850000, recovered: 1420000, rate: 76.8 },
    { method: 'Credit/Debit Cards', failed: 1120000, recovered: 780000, rate: 69.6 },
    { method: 'eNACH Mandates', failed: 340000, recovered: 260000, rate: 76.4 },
    { method: 'NetBanking (HDFC/ICICI)', failed: 170000, recovered: 115000, rate: 67.6 },
  ];

  const hourlyData = [
    { hour: '00:00', rate: 22 },
    { hour: '03:00', rate: 18 },
    { hour: '06:00', rate: 35 },
    { hour: '09:00', rate: 82 },
    { hour: '11:00', rate: 88 },
    { hour: '13:00', rate: 74 },
    { hour: '15:00', rate: 79 },
    { hour: '18:00', rate: 84 },
    { hour: '20:00', rate: 86 },
    { hour: '22:00', rate: 62 },
  ];

  return (
    <AppLayout
      title="Recovery Analytics"
      subtitle="Detailed breakdown of recovery performance across payment rails, time windows, and failure cohorts"
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Overall recovery rate"
          value={`${merchant.recoveryRatePercent}%`}
          subtitle="All payment rails"
          trend={{ value: '+44.4%', isPositive: true, label: 'lift' }}
        />

        <MetricCard
          title="Peak recovery window"
          value="09:00 - 11:30 AM"
          subtitle="Highest success rate"
          badge="88% yield"
        />

        <MetricCard
          title="Mean time to recovery"
          value="34 Minutes"
          subtitle="Down from 4.2 hours"
          trend={{ value: '-86%', isPositive: true, label: 'faster' }}
        />

        <MetricCard
          title="Intervention ROI"
          value="48.2x"
          subtitle="₹ recovered per ₹1 cost"
          trend={{ value: 'Top decile', isPositive: true }}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Method Chart */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Performance by payment rail</h3>
              <p className="text-xs text-slate-500">Failed volume vs recovered volume (₹ INR)</p>
            </div>
            <span className="text-xs font-mono text-slate-400">INR (₹)</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="method" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val / 100000}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Bar dataKey="failed" fill="#cbd5e1" radius={[3, 3, 0, 0]} name="Failed" />
                <Bar dataKey="recovered" fill="#0f172a" radius={[3, 3, 0, 0]} name="Recovered" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
            {methodData.map((m) => (
              <div key={m.method} className="bg-slate-50 p-2 rounded border border-slate-200">
                <span className="text-slate-500 text-[10px] truncate block">{m.method.split(' ')[0]}</span>
                <span className="text-slate-900 font-bold">{m.rate}% rate</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Yield Chart */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recovery rate by time of day</h3>
              <p className="text-xs text-slate-500">Hourly success curve across Indian banking rails (IST)</p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-medium">Optimal: 10 AM</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Recovery rate']}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0f172a' }}
                  name="Recovery rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <strong>Key finding:</strong> Retrying transactions at 10:00 AM IST (post morning salary credits & banking activity) yields <strong>3.8x higher recovery</strong> than immediate off-peak retries.
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

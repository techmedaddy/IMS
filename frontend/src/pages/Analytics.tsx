import React, { useEffect, useState } from 'react';
import { Activity, Clock, ShieldAlert, BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { metricsApi, SignalTrendPoint } from '@/src/api/metrics';
import { incidentsApi } from '@/src/api/incidents';
import { Metrics, Incident } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';

const CHART_COLORS = {
  brand: '#6366f1',
  red: '#f87171',
  orange: '#fb923c',
  yellow: '#fbbf24',
  green: '#4ade80',
  gray: '#6b7280',
  indigo: '#818cf8',
  emerald: '#34d399',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1a1b23',
    border: '1px solid #25262f',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e8e9ed',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  itemStyle: { color: '#9394a0' },
  labelStyle: { color: '#e8e9ed', fontWeight: 600, marginBottom: 4 },
};

export function Analytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [trendData, setTrendData] = useState<SignalTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [m, inc, trend] = await Promise.all([
          metricsApi.get(),
          incidentsApi.list(),
          metricsApi.signalTrend(60),
        ]);
        setMetrics(m);
        setIncidents(inc);
        setTrendData(trend);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="p-8 text-[var(--color-text-tertiary)] text-[13px] animate-pulse">Loading analytics…</div>;

  // Format trend data for the chart
  const throughputTrend = trendData.map((point) => {
    const date = new Date(point.minute);
    return {
      time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      signals: point.count,
    };
  });

  // Derive chart data
  const stateDistribution = [
    { name: 'Open', value: incidents.filter(i => i.state === 'OPEN').length, color: CHART_COLORS.red },
    { name: 'Investigating', value: incidents.filter(i => i.state === 'INVESTIGATING').length, color: CHART_COLORS.indigo },
    { name: 'Resolved', value: incidents.filter(i => i.state === 'RESOLVED').length, color: CHART_COLORS.emerald },
    { name: 'Closed', value: incidents.filter(i => i.state === 'CLOSED').length, color: CHART_COLORS.gray },
  ].filter(d => d.value > 0);

  const severityDistribution = [
    { severity: 'P0', count: incidents.filter(i => i.severity === 'P0').length, fill: CHART_COLORS.red },
    { severity: 'P1', count: incidents.filter(i => i.severity === 'P1').length, fill: CHART_COLORS.orange },
    { severity: 'P2', count: incidents.filter(i => i.severity === 'P2').length, fill: CHART_COLORS.yellow },
    { severity: 'P3', count: incidents.filter(i => i.severity === 'P3').length, fill: CHART_COLORS.green },
  ];

  const summaryCards = [
    { label: 'Throughput (1h)', value: metrics?.signals_aggregated_last_hour.toLocaleString() || '0', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/8', iconColor: 'text-emerald-500/50' },
    { label: 'Active Incidents', value: metrics?.open_incidents?.toString() || '0', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/8', iconColor: 'text-red-500/50' },
    { label: 'MTTR (1h avg)', value: metrics?.avg_mttr_seconds_last_hour ? `${Math.round(metrics.avg_mttr_seconds_last_hour / 60)}m` : '—', icon: Clock, color: 'text-[var(--color-brand-hover)]', bg: 'bg-[var(--color-brand-subtle)]', iconColor: 'text-[var(--color-brand)]/50' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Analytics</h2>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">System performance metrics and operational insights.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map((c, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] tracking-wide">{c.label}</span>
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", c.bg)}>
                  <c.icon className={cn("w-3.5 h-3.5", c.iconColor)} />
                </div>
              </div>
              <div className={cn("text-2xl font-semibold tracking-tight font-mono", c.color)}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Signal Throughput Area Chart */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--color-brand)]" />
              <CardTitle className="text-[12px]">Signal Throughput (Last Hour)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={throughputTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientBrand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#25262f" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#5f6070' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#5f6070' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="signals" stroke={CHART_COLORS.brand} strokeWidth={2} fill="url(#gradientBrand)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Distribution Bar Chart */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--color-brand)]" />
              <CardTitle className="text-[12px]">Incidents by Severity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityDistribution} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#25262f" vertical={false} />
                <XAxis dataKey="severity" tick={{ fontSize: 11, fill: '#9394a0', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#5f6070' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {severityDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* State distribution pie */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardHeader className="py-3">
            <div className="flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-[var(--color-brand)]" />
              <CardTitle className="text-[12px]">State Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-center">
            {stateDistribution.length === 0 ? (
              <p className="text-[var(--color-text-ghost)] text-[12px] py-8">No incident data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stateDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {stateDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={6}
                    formatter={(value: string) => <span style={{ color: '#9394a0', fontSize: '11px', marginLeft: 4 }}>{value}</span>}
                  />
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick stats panel */}
        <Card className="col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-[12px]">Operational Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Incidents', value: incidents.length, sub: 'All time' },
                { label: 'P0 Active', value: incidents.filter(i => i.severity === 'P0' && i.state !== 'CLOSED').length, sub: 'Critical, unresolved' },
                { label: 'Closed with RCA', value: incidents.filter(i => i.state === 'CLOSED').length, sub: 'Completed lifecycle' },
                { label: 'Open Rate', value: incidents.length > 0 ? `${Math.round((incidents.filter(i => i.state === 'OPEN').length / incidents.length) * 100)}%` : '0%', sub: 'Currently open' },
              ].map((stat, i) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)]">
                  <p className="text-[10px] text-[var(--color-text-ghost)] tracking-wide mb-1">{stat.label}</p>
                  <p className="text-lg font-semibold font-mono text-[var(--color-text-primary)]">{stat.value}</p>
                  <p className="text-[10px] text-[var(--color-text-ghost)] mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

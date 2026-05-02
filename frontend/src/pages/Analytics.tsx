import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Clock, ShieldAlert } from 'lucide-react';
import { metricsApi } from '@/src/api/metrics';
import { Metrics } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';

export function Analytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try { setMetrics(await metricsApi.get()); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchMetrics();
    const id = setInterval(fetchMetrics, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="p-8 text-[var(--color-text-tertiary)] text-[13px] animate-pulse">Loading analytics…</div>;

  const cards = [
    { label: 'Throughput (1h)', value: metrics?.signals_aggregated_last_hour.toLocaleString() || '0', sub: 'Total signals ingested', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/8', iconColor: 'text-emerald-500/50' },
    { label: 'Active Incidents', value: metrics?.open_incidents?.toString() || '0', sub: 'Requiring attention', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/8', iconColor: 'text-red-500/50' },
    { label: 'Mean Time To Repair', value: metrics?.avg_mttr_seconds_last_hour ? `${Math.round(metrics.avg_mttr_seconds_last_hour / 60)}m` : '—', sub: 'Average over last hour', icon: Clock, color: 'text-[var(--color-brand-hover)]', bg: 'bg-[var(--color-brand-subtle)]', iconColor: 'text-[var(--color-brand)]/50' },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Analytics</h2>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">System performance metrics and operational insights.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] tracking-wide">{c.label}</span>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>
                  <c.icon className={cn("w-4 h-4", c.iconColor)} />
                </div>
              </div>
              <div className={cn("text-3xl font-semibold tracking-tight font-mono", c.color)}>{c.value}</div>
              <p className="text-[11px] text-[var(--color-text-ghost)] mt-2">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <BarChart3 className="w-10 h-10 text-[var(--color-text-ghost)] mx-auto mb-3" />
          <h3 className="text-[14px] font-medium text-[var(--color-text-secondary)]">Advanced Analytics</h3>
          <p className="text-[var(--color-text-ghost)] text-[13px] max-w-sm mx-auto mt-1.5">
            Time-series charts, component-level breakdowns, and historical trend analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

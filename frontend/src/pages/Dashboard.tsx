import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, TrendingUp, Clock, Shield, Zap } from 'lucide-react';
import { incidentsApi } from '@/src/api/incidents';
import { metricsApi } from '@/src/api/metrics';
import { Incident, Metrics } from '@/src/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/Table';
import { Card, CardContent } from '@/src/components/ui/Card';
import { SeverityBadge, StatusBadge } from '@/src/components/ui/Badge';
import { formatDuration, cn } from '@/src/lib/utils';
import { format } from 'date-fns';

export function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incidentsData, metricsData] = await Promise.all([
          incidentsApi.list(),
          metricsApi.get()
        ]);
        const sortedData = [...incidentsData].sort((a, b) => {
          if (a.severity === 'P0' && b.severity !== 'P0') return -1;
          if (a.severity !== 'P0' && b.severity === 'P0') return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        setIncidents(sortedData);
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeP0 = incidents.filter(i => i.severity === 'P0' && i.state !== 'CLOSED').length;

  const statCards = [
    { 
      label: 'Critical Incidents', 
      value: activeP0, 
      icon: Shield,
      color: activeP0 > 0 ? 'text-red-400' : 'text-emerald-400',
      bg: activeP0 > 0 ? 'bg-red-500/8' : 'bg-emerald-500/8',
      iconColor: activeP0 > 0 ? 'text-red-500/60' : 'text-emerald-500/60',
    },
    { 
      label: 'MTTR (1h avg)', 
      value: metrics?.avg_mttr_seconds_last_hour ? `${Math.round(metrics.avg_mttr_seconds_last_hour / 60)}m` : '—',
      icon: Clock,
      color: 'text-[var(--color-text-primary)]',
      bg: 'bg-[var(--color-brand-subtle)]',
      iconColor: 'text-[var(--color-brand)]/50',
    },
    { 
      label: 'SLA Uptime', 
      value: '99.98%', 
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/6',
      iconColor: 'text-emerald-500/50',
    },
    { 
      label: 'Signals Ingested', 
      value: metrics ? (metrics.signals_aggregated_last_hour > 1000 ? `${(metrics.signals_aggregated_last_hour / 1000).toFixed(1)}k` : metrics.signals_aggregated_last_hour.toString()) : '—',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/6',
      iconColor: 'text-amber-500/50',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Dashboard</h2>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">Infrastructure health overview and active incident monitoring.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] tracking-wide">{stat.label}</span>
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", stat.bg)}>
                  <stat.icon className={cn("w-3.5 h-3.5", stat.iconColor)} />
                </div>
              </div>
              <span className={cn("text-2xl font-semibold tracking-tight font-mono", stat.color)}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent incidents section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Recent Incidents</h3>
          <button 
            onClick={() => navigate('/incidents')}
            className="text-[12px] text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] font-medium transition-colors flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">Severity</TableHead>
                  <TableHead>Incident ID</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <div className="h-4 bg-[var(--color-surface-hover)] rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-[var(--color-text-tertiary)] text-[13px]">
                      No active incidents — all systems operational.
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.slice(0, 5).map((incident) => (
                    <TableRow 
                      key={incident.id} 
                      className="cursor-pointer group"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <TableCell><SeverityBadge severity={incident.severity} /></TableCell>
                      <TableCell className="font-mono text-[12px] text-[var(--color-brand)] tracking-tight">
                        {incident.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium text-[var(--color-text-primary)]">{incident.component_id}</TableCell>
                      <TableCell>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-tertiary)] font-mono border border-[var(--color-border-subtle)]">
                          {incident.component_type}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge state={incident.state} /></TableCell>
                      <TableCell className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">
                        {formatDuration(incident.start_time)}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-tertiary)] text-[12px]">
                        {format(new Date(incident.updated_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-text-ghost)] group-hover:text-[var(--color-text-secondary)] transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, Clock, ShieldAlert } from 'lucide-react';
import { metricsApi } from '@/src/api/metrics';
import { Metrics } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';

export function Analytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await metricsApi.get();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch analytics metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8 font-mono text-xs animate-pulse">CARRIAGE RETURN: SYSTEM LOADING...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-blue/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-brand-blue" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Analytics</h2>
          <p className="text-slate-400 text-sm mt-1">High-level metrics and system performance overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              Throughput (Last Hour)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono tracking-tighter">
              {metrics?.signals_aggregated_last_hour.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Total signals ingested and processed</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono tracking-tighter text-red-400">
              {metrics?.open_incidents || '0'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Currently requiring engineer attention</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-blue" />
              Mean Time To Repair
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono tracking-tighter text-slate-200">
              {metrics?.avg_mttr_seconds_last_hour ? `${Math.round(metrics.avg_mttr_seconds_last_hour / 60)}m` : 'N/A'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Average MTTR over the last hour</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 bg-slate-950 border-slate-800">
         <CardContent className="p-16 text-center">
            <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">Advanced Analytics Hub</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-2">
              This module is reserved for time-series charts, component-level breakdown, and long-term historical trends. 
            </p>
         </CardContent>
      </Card>
    </div>
  );
}

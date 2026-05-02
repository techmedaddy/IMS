import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowUpRight } from 'lucide-react';
import { incidentsApi } from '@/src/api/incidents';
import { Incident } from '@/src/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/Table';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Form';
import { SeverityBadge, StatusBadge } from '@/src/components/ui/Badge';
import { formatDuration } from '@/src/lib/utils';
import { format } from 'date-fns';

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const data = await incidentsApi.list();
        const sortedData = [...data].sort((a, b) => {
          if (a.severity === 'P0' && b.severity !== 'P0') return -1;
          if (a.severity !== 'P0' && b.severity === 'P0') return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        setIncidents(sortedData);
      } catch (error) {
        console.error('Failed to fetch incidents', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredIncidents = incidents.filter(idx => 
    idx.component_id.toLowerCase().includes(search.toLowerCase()) ||
    idx.id.toLowerCase().includes(search.toLowerCase()) ||
    idx.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Incident Directory</h2>
          <p className="text-slate-400 text-sm mt-1">Comprehensive list of all tracked incidents and their statuses.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search ID, Component, State..." 
              className="pl-9 w-64 bg-slate-900/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-700 rounded-md bg-slate-900 hover:bg-slate-800 text-xs text-slate-300">
            <Filter className="w-3 h-3" />
            Filter
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">Severity</TableHead>
                <TableHead>Incident ID</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-12 text-center animate-pulse bg-slate-900/20" />
                  </TableRow>
                ))
              ) : filteredIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-500 font-mono">
                    NO INCIDENTS MATCHING CRITERIA
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncidents.map((incident) => (
                  <TableRow 
                    key={incident.id} 
                    className="cursor-pointer group"
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    <TableCell>
                      <SeverityBadge severity={incident.severity} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-brand-blue uppercase tracking-tighter">
                      {incident.id.split('-')[0]}...
                    </TableCell>
                    <TableCell className="font-semibold">{incident.component_id}</TableCell>
                    <TableCell>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-400 font-mono">
                        {incident.component_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge state={incident.state} />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-xs">
                      {formatDuration(incident.start_time)}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {format(new Date(incident.updated_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-200 transition-colors" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

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

import { useIncidentsSocket } from '@/src/hooks/useIncidentsSocket';
import { useCallback } from 'react';

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleIncidentUpdate = useCallback((updatedIncident: Incident) => {
    setIncidents(prev => {
      const exists = prev.find(i => i.id === updatedIncident.id);
      let newIncidents;
      if (exists) {
        newIncidents = prev.map(i => i.id === updatedIncident.id ? updatedIncident : i);
      } else {
        newIncidents = [updatedIncident, ...prev];
      }
      return newIncidents.sort((a, b) => {
        if (a.severity === 'P0' && b.severity !== 'P0') return -1;
        if (a.severity !== 'P0' && b.severity === 'P0') return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    });
  }, []);

  useIncidentsSocket(handleIncidentUpdate);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const data = await incidentsApi.list();
        const sorted = [...data].sort((a, b) => {
          if (a.severity === 'P0' && b.severity !== 'P0') return -1;
          if (a.severity !== 'P0' && b.severity === 'P0') return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        setIncidents(sorted);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchIncidents();
  }, []);

  const filtered = incidents.filter(i =>
    i.component_id.toLowerCase().includes(search.toLowerCase()) ||
    i.id.toLowerCase().includes(search.toLowerCase()) ||
    i.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Incidents</h2>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">Browse and manage all tracked incidents.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-[7px] h-3.5 w-3.5 text-[var(--color-text-ghost)]" />
            <Input placeholder="Search…" className="pl-8 w-56 h-8 text-[12px]" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="inline-flex items-center gap-1.5 px-2.5 h-8 border border-[var(--color-border-default)] rounded-md bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] text-[12px] text-[var(--color-text-secondary)] transition-colors">
            <Filter className="w-3 h-3" /> Filter
          </button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Severity</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({length:4}).map((_,i) => (
                <TableRow key={i}><TableCell colSpan={8}><div className="h-4 bg-[var(--color-surface-hover)] rounded animate-pulse" /></TableCell></TableRow>
              )) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-[var(--color-text-tertiary)]">No incidents found.</TableCell></TableRow>
              ) : filtered.map(inc => (
                <TableRow key={inc.id} className="cursor-pointer group" onClick={() => navigate(`/incidents/${inc.id}`)}>
                  <TableCell><SeverityBadge severity={inc.severity} /></TableCell>
                  <TableCell className="font-mono text-[12px] text-[var(--color-brand)]">{inc.id.slice(0,8)}</TableCell>
                  <TableCell className="font-medium">{inc.component_id}</TableCell>
                  <TableCell><span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-tertiary)] font-mono border border-[var(--color-border-subtle)]">{inc.component_type}</span></TableCell>
                  <TableCell><StatusBadge state={inc.state} /></TableCell>
                  <TableCell className="font-mono tabular-nums text-[12px] text-[var(--color-text-secondary)]">{formatDuration(inc.start_time)}</TableCell>
                  <TableCell className="text-[var(--color-text-tertiary)] text-[12px]">{format(new Date(inc.updated_at), 'MMM d, HH:mm')}</TableCell>
                  <TableCell><ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-text-ghost)] group-hover:text-[var(--color-text-secondary)] transition-colors" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

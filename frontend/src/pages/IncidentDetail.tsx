import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Terminal, CheckCircle2, History, AlertCircle, Clock, FileText, Activity } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { incidentsApi } from '@/src/api/incidents';
import { IncidentDetail, IncidentState, RCA } from '@/src/types';
import { Button } from '@/src/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/src/components/ui/Card';
import { SeverityBadge, StatusBadge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Input, Textarea, Label } from '@/src/components/ui/Form';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { Timeline } from '@/src/components/ui/Timeline';

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('signals');
  const [rcaForm, setRcaForm] = useState<RCA>({
    start_time: '', end_time: '', root_cause_category: 'Code Bug', fix_applied: '', prevention_steps: '',
  });
  const [submittingRca, setSubmittingRca] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const detail = await incidentsApi.get(id);
        setData(detail);
        if (detail.rca) setRcaForm(detail.rca);
        else if (detail.incident.start_time) setRcaForm(prev => ({...prev, start_time: detail.incident.start_time}));
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [id]);

  const handleTransition = async (to_state: IncidentState) => {
    if (!id) return;
    try {
      await incidentsApi.transition(id, { to_state });
      const updated = await incidentsApi.get(id);
      setData(updated);
      toast.success(`Transitioned to ${to_state}`);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        toast.error("Cannot close: " + (error.response?.data?.detail || "RCA required."));
        setActiveTab('rca');
      } else {
        toast.error('Transition failed');
        console.error(error);
      }
    }
  };

  const handleRcaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmittingRca(true);
    try {
      await incidentsApi.submitRca(id, rcaForm);
      const updated = await incidentsApi.get(id);
      setData(updated);
      toast.success("RCA submitted successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit RCA.");
    } finally { setSubmittingRca(false); }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      await incidentsApi.submitNote(id, noteText);
      const updated = await incidentsApi.get(id);
      setData(updated);
      setNoteText('');
      toast.success("Note added");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add note.");
    } finally { setSubmittingNote(false); }
  };

  if (loading) return <div className="p-8 text-[var(--color-text-tertiary)] text-[13px] animate-pulse">Loading incident…</div>;
  if (!data) return <div className="p-8 text-[var(--color-text-tertiary)]">Incident not found.</div>;

  const { incident, signals } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">{incident.component_id}</h2>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge state={incident.state} />
          </div>
          <p className="text-[var(--color-text-ghost)] text-[11px] mt-0.5 font-mono">{incident.id}</p>
        </div>
        <div className="flex gap-2">
          {incident.state === 'OPEN' && <Button size="sm" onClick={() => handleTransition('INVESTIGATING')}>Start Investigation</Button>}
          {incident.state === 'INVESTIGATING' && <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleTransition('RESOLVED')}>Mark Resolved</Button>}
          {incident.state === 'RESOLVED' && <Button size="sm" onClick={() => handleTransition('CLOSED')}>Close Case</Button>}
          {incident.state === 'CLOSED' && <Button size="sm" variant="ghost" disabled>Archived</Button>}
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          <Tabs>
            <TabsList>
              <TabsTrigger isActive={activeTab === 'signals'} onClick={() => setActiveTab('signals')}>
                <Terminal className="w-3 h-3 mr-1.5" /> Signals
              </TabsTrigger>
              <TabsTrigger isActive={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
                <Activity className="w-3 h-3 mr-1.5" /> Timeline
              </TabsTrigger>
              <TabsTrigger isActive={activeTab === 'rca'} onClick={() => setActiveTab('rca')}>
                <CheckCircle2 className="w-3 h-3 mr-1.5" /> Root Cause Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent className={activeTab === 'signals' ? 'block' : 'hidden'}>
              <Card className="bg-[var(--color-surface-base)] border-[var(--color-border-default)]">
                <CardHeader className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[12px] font-mono flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <History className="w-3 h-3" /> EVENT_LOG_STREAM
                    </CardTitle>
                    <span className="text-[10px] text-[var(--color-text-ghost)] font-mono">{signals.length} entries</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-auto custom-scrollbar font-mono text-[11px] leading-relaxed">
                    <table className="w-full border-collapse">
                      <thead className="bg-[var(--color-surface-raised)] sticky top-0">
                        <tr className="text-[var(--color-text-ghost)] border-b border-[var(--color-border-default)]">
                          <th className="p-2 text-left w-36 font-medium text-[10px]">TIMESTAMP</th>
                          <th className="p-2 text-left font-medium text-[10px]">EVENT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map((signal, i) => (
                          <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]/40 transition-colors">
                            <td className="p-2 text-[var(--color-text-ghost)] align-top">{format(new Date(signal.ts), 'HH:mm:ss.SSS')}</td>
                            <td className="p-2">
                              <span className={cn("block", signal.message.toLowerCase().includes('error') ? "text-red-400" : signal.message.toLowerCase().includes('fail') ? "text-orange-400" : "text-[var(--color-text-secondary)]")}>
                                {signal.message}
                              </span>
                              {signal.payload && (
                                <pre className="mt-1 p-1.5 bg-[var(--color-surface-overlay)] rounded text-[10px] text-[var(--color-text-ghost)] overflow-x-auto">
                                  {JSON.stringify(signal.payload, null, 2)}
                                </pre>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent className={activeTab === 'timeline' ? 'block' : 'hidden'}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-[14px]">Audit Log</CardTitle>
                  <CardDescription>Permanent record of state transitions and collaborative notes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Timeline events={data?.timeline || []} />
                  
                  <div className="pt-4 border-t border-[var(--color-border-subtle)]">
                    <form onSubmit={handleNoteSubmit} className="flex gap-3">
                      <Input 
                        placeholder="Add an operator note..." 
                        value={noteText} 
                        onChange={e => setNoteText(e.target.value)} 
                        className="flex-1"
                      />
                      <Button type="submit" disabled={submittingNote || !noteText.trim()}>
                        {submittingNote ? 'Adding...' : 'Add Note'}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent className={activeTab === 'rca' ? 'block' : 'hidden'}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-[14px]">Post-Mortem Analysis</CardTitle>
                  <CardDescription>Required for incident closure and prevention auditing.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRcaSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Detection Start (UTC)</Label>
                        <Input type="datetime-local" value={rcaForm.start_time ? format(new Date(rcaForm.start_time), "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setRcaForm({...rcaForm, start_time: new Date(e.target.value).toISOString()})} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Resolution End (UTC)</Label>
                        <Input type="datetime-local" value={rcaForm.end_time ? format(new Date(rcaForm.end_time), "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setRcaForm({...rcaForm, end_time: new Date(e.target.value).toISOString()})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Root Cause Category</Label>
                      <select className="flex h-8 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-3 py-1 text-[13px] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand)]" value={rcaForm.root_cause_category} onChange={e => setRcaForm({...rcaForm, root_cause_category: e.target.value})} required>
                        <option>Code Bug</option><option>Infrastructure</option><option>Configuration</option><option>Network</option><option>External Dependency</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Immediate Fix Applied</Label>
                      <Textarea placeholder="Steps taken to resolve the crisis…" value={rcaForm.fix_applied} onChange={e => setRcaForm({...rcaForm, fix_applied: e.target.value})} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prevention Steps</Label>
                      <Textarea placeholder="Long-term remedies to prevent recurrence…" value={rcaForm.prevention_steps} onChange={e => setRcaForm({...rcaForm, prevention_steps: e.target.value})} required />
                    </div>
                    <Button type="submit" disabled={submittingRca} className="w-full">
                      {submittingRca ? 'Submitting…' : data.rca ? 'Update RCA' : 'Save RCA'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-[12px] text-[var(--color-text-secondary)]">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[var(--color-text-ghost)] flex items-center gap-1"><Clock className="w-3 h-3" /> Started</span>
                <span className="font-mono text-[var(--color-text-secondary)]">{format(new Date(incident.start_time), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[var(--color-text-ghost)] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Type</span>
                <span className="font-mono text-[10px] bg-[var(--color-surface-overlay)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)]">{incident.component_type}</span>
              </div>
              <div className="pt-3 border-t border-[var(--color-border-subtle)]">
                <p className="text-[10px] text-[var(--color-text-ghost)] mb-2 tracking-wide">On-Call Engineer</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--color-brand)] to-purple-500 flex items-center justify-center text-[9px] font-bold text-white">UE</div>
                  <div>
                    <p className="text-[12px] font-medium">Umar Ejaz</p>
                    <p className="text-[10px] text-[var(--color-text-ghost)] font-mono">PRIMARY_RESPONDER</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--color-brand-subtle)] border-[var(--color-brand)]/15">
            <CardHeader className="py-3">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                <CardTitle className="text-[12px]">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-1.5 pt-0">
              <Button variant="outline" size="sm" className="justify-start text-[11px] font-mono h-7">GENERATE_STATUS_POST</Button>
              <Button variant="outline" size="sm" className="justify-start text-[11px] font-mono h-7">PAGE_ESCALATION</Button>
              <Button variant="outline" size="sm" className="justify-start text-[11px] font-mono h-7">EXPORT_SIGNALS_CSV</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

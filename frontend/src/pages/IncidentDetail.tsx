import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Terminal, FileText, CheckCircle2, History, AlertCircle, Clock } from 'lucide-react';
import { incidentsApi } from '@/src/api/incidents';
import { IncidentDetail, IncidentState, RCA } from '@/src/types';
import { Button } from '@/src/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/src/components/ui/Card';
import { SeverityBadge, StatusBadge } from '@/src/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/Tabs';
import { Input, Textarea, Label } from '@/src/components/ui/Form';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('signals');
  const [rcaForm, setRcaForm] = useState<RCA>({
    start_time: '',
    end_time: '',
    root_cause_category: 'Code Bug',
    fix_applied: '',
    prevention_steps: '',
  });
  const [submittingRca, setSubmittingRca] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const detail = await incidentsApi.get(id);
        setData(detail);
        if (detail.rca) {
          setRcaForm(detail.rca);
        } else if (detail.incident.start_time) {
           setRcaForm(prev => ({...prev, start_time: detail.incident.start_time}));
        }
      } catch (error) {
        console.error('Failed to fetch incident detail', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleTransition = async (to_state: IncidentState) => {
    if (!id) return;
    try {
      await incidentsApi.transition(id, { to_state });
      const updated = await incidentsApi.get(id);
      setData(updated);
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert("Cannot close incident: " + (error.response?.data?.detail || "RCA incomplete."));
        setActiveTab('rca');
      } else {
        console.error('Transition failed', error);
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
      alert("RCA submitted successfully.");
    } catch (error) {
      console.error('RCA submission failed', error);
      alert("Failed to submit RCA.");
    } finally {
      setSubmittingRca(false);
    }
  };

  if (loading) return <div className="p-8 font-mono text-xs animate-pulse">CARRIAGE RETURN: SYSTEM LOADING...</div>;
  if (!data) return <div className="p-8">Incident not found.</div>;

  const { incident, signals } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight uppercase font-mono">{incident.component_id}</h2>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge state={incident.state} />
          </div>
          <p className="text-slate-500 text-xs mt-1 font-mono uppercase">ID: {incident.id}</p>
        </div>
        <div className="flex gap-2">
          {incident.state === 'OPEN' && (
            <Button size="sm" onClick={() => handleTransition('INVESTIGATING')}>Start Investigation</Button>
          )}
          {incident.state === 'INVESTIGATING' && (
            <Button size="sm" variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/10" onClick={() => handleTransition('RESOLVED')}>Resolve Incident</Button>
          )}
          {incident.state === 'RESOLVED' && (
            <Button size="sm" variant="primary" onClick={() => handleTransition('CLOSED')}>Close Case</Button>
          )}
          {incident.state === 'CLOSED' && (
            <Button size="sm" variant="ghost" disabled>Archived</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Tabs>
            <TabsList>
              <TabsTrigger isActive={activeTab === 'signals'} onClick={() => setActiveTab('signals')}>
                <Terminal className="w-3 h-3 mr-2" />
                Signals (Logs)
              </TabsTrigger>
              <TabsTrigger isActive={activeTab === 'rca'} onClick={() => setActiveTab('rca')}>
                <CheckCircle2 className="w-3 h-3 mr-2" />
                Root Cause Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent className={activeTab === 'signals' ? 'block' : 'hidden'}>
              <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <History className="w-3 h-3" />
                      EVENT_LOG_STREAM
                    </CardTitle>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">
                      Showing {signals.length} entries
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-auto custom-scrollbar font-mono text-[11px] leading-relaxed">
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-900 sticky top-0">
                        <tr className="text-slate-500 border-b border-slate-800">
                          <th className="p-2 text-left w-48 font-medium">TIMESTAMP</th>
                          <th className="p-2 text-left font-medium">EVENT MESSAGE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map((signal, i) => (
                          <tr key={i} className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                            <td className="p-2 text-slate-500 align-top">
                              {format(new Date(signal.ts), 'HH:mm:ss.SSS')}
                            </td>
                            <td className="p-2">
                              <span className={cn(
                                "block",
                                signal.message.toLowerCase().includes('error') ? "text-red-400" :
                                signal.message.toLowerCase().includes('fail') ? "text-orange-400" : "text-slate-300"
                              )}>
                                {signal.message}
                              </span>
                              {signal.payload && (
                                <pre className="mt-1 p-2 bg-slate-900/50 rounded text-[10px] text-slate-500 overflow-x-auto">
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

            <TabsContent className={activeTab === 'rca' ? 'block' : 'hidden'}>
              <Card>
                <CardHeader>
                  <CardTitle>Post-Mortem Analysis</CardTitle>
                  <CardDescription>
                    Documentation required for incident closure and prevention auditing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRcaSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Detection Start Time (UTC)</Label>
                        <Input 
                          type="datetime-local" 
                          value={rcaForm.start_time.slice(0, 16)} 
                          onChange={e => setRcaForm({...rcaForm, start_time: new Date(e.target.value).toISOString()})}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Resolution End Time (UTC)</Label>
                        <Input 
                          type="datetime-local" 
                          value={rcaForm.end_time.slice(0, 16)} 
                          onChange={e => setRcaForm({...rcaForm, end_time: new Date(e.target.value).toISOString()})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Root Cause Category</Label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
                        value={rcaForm.root_cause_category}
                        onChange={e => setRcaForm({...rcaForm, root_cause_category: e.target.value})}
                        required
                      >
                        <option>Code Bug</option>
                        <option>Infrastructure</option>
                        <option>Configuration</option>
                        <option>Network</option>
                        <option>External Dependency</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Immediate Fix Applied</Label>
                      <Textarea 
                        placeholder="Detail the steps taken to resolve the immediate crisis..."
                        value={rcaForm.fix_applied}
                        onChange={e => setRcaForm({...rcaForm, fix_applied: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Prevention Steps / Long-term Remedies</Label>
                      <Textarea 
                        placeholder="What changes will prevent this from recurring?"
                        value={rcaForm.prevention_steps}
                        onChange={e => setRcaForm({...rcaForm, prevention_steps: e.target.value})}
                        required
                      />
                    </div>

                    <Button type="submit" disabled={submittingRca} className="w-full">
                      {submittingRca ? 'Submitting...' : data.rca ? 'Update RCA' : 'Save RCA'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Started
                </span>
                <span className="font-mono">{format(new Date(incident.start_time), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Type
                </span>
                <span className="font-mono bg-slate-800 px-1.5 rounded">{incident.component_type}</span>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">On-Call Engineer</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">UE</div>
                  <div>
                    <p className="text-xs font-semibold">Umar Ejaz</p>
                    <p className="text-[10px] text-slate-500 font-mono">PRIMARY_RESPONDER</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader className="py-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-blue" />
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 pt-0">
              <Button variant="outline" size="sm" className="justify-start text-xs font-mono h-8">
                GENERATE_STATUS_PAGE_POST
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs font-mono h-8">
                PAGING_ESCORT_SERVICE
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs font-mono h-8">
                DOWNLOAD_SIGNAL_EXPORT_CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

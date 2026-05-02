export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type IncidentState = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
export type ComponentType = 'MICROSERVICE' | 'DATABASE' | 'INFRASTRUCTURE' | 'API_GATEWAY';

export interface Incident {
  id: string;
  component_id: string;
  component_type: ComponentType;
  severity: Severity;
  state: IncidentState;
  start_time: string;
  updated_at: string;
}

export interface Signal {
  ts: string;
  message: string;
  payload: any;
  component_id: string;
}

export interface RCA {
  start_time: string;
  end_time: string;
  root_cause_category: 'Code Bug' | 'Infrastructure' | 'Configuration' | 'Network' | string;
  fix_applied: string;
  prevention_steps: string;
}

export interface IncidentDetail {
  incident: Incident;
  signals: Signal[];
  rca: RCA | null;
}

export interface TransitionPayload {
  to_state: IncidentState;
}

export interface Metrics {
  now: string;
  open_incidents: number;
  avg_mttr_seconds_last_hour: number | null;
  signals_aggregated_last_hour: number;
}

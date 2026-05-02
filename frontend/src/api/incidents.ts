import { apiClient } from './client';
import { Incident, IncidentDetail, RCA, TransitionPayload } from '../types';

export const incidentsApi = {
  list: async (): Promise<Incident[]> => {
    const response = await apiClient.get<Incident[]>('/incidents');
    return response.data;
  },

  get: async (id: string): Promise<IncidentDetail> => {
    const response = await apiClient.get<IncidentDetail>(`/incidents/${id}`);
    return response.data;
  },

  transition: async (id: string, payload: TransitionPayload): Promise<void> => {
    await apiClient.post(`/incidents/${id}/transition`, payload);
  },

  submitRca: async (id: string, payload: RCA): Promise<void> => {
    await apiClient.post(`/incidents/${id}/rca`, payload);
  },
};

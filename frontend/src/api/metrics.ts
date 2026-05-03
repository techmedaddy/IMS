import { apiClient } from './client';
import { Metrics } from '../types';

export interface SignalTrendPoint {
  minute: string;
  count: number;
}

export const metricsApi = {
  get: async (): Promise<Metrics> => {
    const response = await apiClient.get<Metrics>('/metrics');
    return response.data;
  },
  signalTrend: async (minutes: number = 60): Promise<SignalTrendPoint[]> => {
    const response = await apiClient.get<SignalTrendPoint[]>('/metrics/signal-trend', {
      params: { minutes },
    });
    return response.data;
  },
};

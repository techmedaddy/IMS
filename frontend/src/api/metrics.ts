import { apiClient } from './client';
import { Metrics } from '../types';

export const metricsApi = {
  get: async (): Promise<Metrics> => {
    const response = await apiClient.get<Metrics>('/metrics');
    return response.data;
  },
};

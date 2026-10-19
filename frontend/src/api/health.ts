import { apiClient } from './client';
import { HealthStatus } from '../types';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  return apiClient<HealthStatus>('/api/health');
}

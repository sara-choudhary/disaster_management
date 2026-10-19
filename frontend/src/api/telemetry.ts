import { apiClient } from './client';
import { TelemetryResponse } from '../types';
import { SimulationRunRecord } from './simulation';

export async function fetchTelemetry(timeRange: string = '24h'): Promise<TelemetryResponse> {
  const query = `?time_range=${encodeURIComponent(timeRange)}`;
  return apiClient<TelemetryResponse>(`/api/v1/telemetry${query}`);
}

export async function triggerTelemetryDrill(drillName?: string): Promise<SimulationRunRecord> {
  const query = drillName ? `?drill_name=${encodeURIComponent(drillName)}` : '';
  return apiClient<SimulationRunRecord>(`/api/v1/telemetry/drill${query}`, {
    method: 'POST',
  });
}

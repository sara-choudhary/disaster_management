import { apiClient } from './client';
import { SimulationRunRequest, SimulationRunResponse, EmergencyMessage } from '../types';

export async function runRoutingSimulation(
  payload: SimulationRunRequest,
): Promise<SimulationRunResponse> {
  return apiClient<SimulationRunResponse>('/api/v1/simulation/route', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDispatchedMessages(limit = 20): Promise<EmergencyMessage[]> {
  return apiClient<EmergencyMessage[]>(`/api/v1/simulation/messages?limit=${limit}`);
}

export interface SimulationRunRecord {
  id: number;
  run_id: string;
  scenario_id?: string;
  start_time: string;
  end_time?: string;
  initial_state?: Record<string, any>;
  final_state?: Record<string, any>;
  result: string;
  recovery_duration: number;
  packet_statistics: Record<string, any>;
  created_at: string;
}

export async function fetchSimulationRuns(limit = 10): Promise<SimulationRunRecord[]> {
  return apiClient<SimulationRunRecord[]>(`/api/v1/simulations?limit=${limit}`);
}


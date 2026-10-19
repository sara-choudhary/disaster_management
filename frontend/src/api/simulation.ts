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

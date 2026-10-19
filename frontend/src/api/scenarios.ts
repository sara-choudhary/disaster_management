import { apiClient } from './client';

export interface ScenarioItem {
  id: number;
  scenario_id: string;
  name: string;
  description: string;
  scenario_type: string;
  configuration: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function fetchScenarios(): Promise<ScenarioItem[]> {
  return apiClient<ScenarioItem[]>('/api/v1/scenarios');
}

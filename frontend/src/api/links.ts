import { apiClient } from './client';

export interface NetworkLinkRecord {
  id: number;
  link_id: string;
  source_node_id: string;
  destination_node_id: string;
  bandwidth: number;
  latency: number;
  operational_state: string;
  link_cost: number;
  created_at: string;
  updated_at: string;
}

export async function fetchLinks(): Promise<NetworkLinkRecord[]> {
  return apiClient<NetworkLinkRecord[]>('/api/v1/links');
}

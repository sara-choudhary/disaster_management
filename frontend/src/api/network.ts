import { apiClient } from './client';
import {
  NetworkTopology,
  NetworkMetrics,
  RoutePath,
  BaselineResetResponse,
  ReachabilityMatrixResponse,
  NetworkEventItem,
  FailureInjectionResponse,
} from '../types';

export async function fetchTopology(): Promise<NetworkTopology> {
  return apiClient<NetworkTopology>('/api/v1/network/topology');
}

export async function fetchMetrics(): Promise<NetworkMetrics> {
  return apiClient<NetworkMetrics>('/api/v1/network/metrics');
}

export async function failLink(linkId: string, reason?: string): Promise<FailureInjectionResponse> {
  return apiClient<FailureInjectionResponse>(`/api/v1/network/links/${linkId}/failure`, {
    method: 'POST',
    body: JSON.stringify({
      reason: reason || 'Simulated link severance via UI',
    }),
  });
}

export async function restoreLink(linkId: string): Promise<FailureInjectionResponse> {
  return apiClient<FailureInjectionResponse>(`/api/v1/network/links/${linkId}/restore`, {
    method: 'POST',
  });
}

export async function failNode(nodeId: string, reason?: string): Promise<FailureInjectionResponse> {
  return apiClient<FailureInjectionResponse>(`/api/v1/network/nodes/${nodeId}/failure`, {
    method: 'POST',
    body: JSON.stringify({
      reason: reason || 'Simulated node outage via UI',
    }),
  });
}

export async function restoreNode(nodeId: string): Promise<FailureInjectionResponse> {
  return apiClient<FailureInjectionResponse>(`/api/v1/network/nodes/${nodeId}/restore`, {
    method: 'POST',
  });
}

export async function fetchRoutes(
  source?: string,
  destination?: string,
  priority: string = 'CRITICAL_SOS',
): Promise<RoutePath> {
  const params = new URLSearchParams();
  if (source) params.append('source', source);
  if (destination) params.append('destination', destination);
  params.append('priority', priority);

  return apiClient<RoutePath>(`/api/v1/network/routes?${params.toString()}`);
}

export async function resetBaseline(): Promise<BaselineResetResponse> {
  return apiClient<BaselineResetResponse>('/api/v1/network/reset', {
    method: 'POST',
  });
}

export async function fetchReachability(sourceNodeId?: string): Promise<ReachabilityMatrixResponse> {
  const params = new URLSearchParams();
  if (sourceNodeId) params.append('source_node_id', sourceNodeId);
  return apiClient<ReachabilityMatrixResponse>(`/api/v1/network/reachability?${params.toString()}`);
}

export async function fetchEvents(limit: number = 20): Promise<NetworkEventItem[]> {
  return apiClient<NetworkEventItem[]>(`/api/v1/events?limit=${limit}`);
}



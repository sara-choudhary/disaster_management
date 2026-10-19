import { apiClient } from './client';
import { NetworkNode } from '../types';

export async function fetchNodes(): Promise<NetworkNode[]> {
  return apiClient<NetworkNode[]>('/api/v1/nodes');
}

export async function fetchNode(nodeId: string): Promise<NetworkNode> {
  return apiClient<NetworkNode>(`/api/v1/nodes/${nodeId}`);
}

export async function createNode(node: Partial<NetworkNode>): Promise<NetworkNode> {
  return apiClient<NetworkNode>('/api/v1/nodes', {
    method: 'POST',
    body: JSON.stringify(node),
  });
}

export async function updateNode(
  nodeId: string,
  updates: Partial<NetworkNode>,
): Promise<NetworkNode> {
  return apiClient<NetworkNode>(`/api/v1/nodes/${nodeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteNode(nodeId: string): Promise<void> {
  await apiClient<void>(`/api/v1/nodes/${nodeId}`, {
    method: 'DELETE',
  });
}

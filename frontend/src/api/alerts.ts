import { apiClient } from './client';

export interface AlertRecord {
  id: number;
  alert_id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  status: string;
  affected_resource?: string | null;
  related_run?: string | null;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface AlertFilters {
  status?: string;
  severity?: string;
  category?: string;
  resource?: string;
  timeRange?: string;
  limit?: number;
}

export async function fetchAlerts(statusFilter?: string): Promise<AlertRecord[]> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
  return apiClient<AlertRecord[]>(`/api/v1/alerts${query}`);
}

export async function fetchFilteredAlerts(filters: AlertFilters = {}): Promise<AlertRecord[]> {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') {
    query.append('status', filters.status);
  }
  if (filters.severity && filters.severity !== 'ALL') {
    query.append('severity', filters.severity);
  }
  if (filters.category && filters.category !== 'ALL') {
    query.append('category', filters.category);
  }
  if (filters.resource && filters.resource.trim()) {
    query.append('resource', filters.resource.trim());
  }
  if (filters.timeRange && filters.timeRange !== 'ALL') {
    query.append('time_range', filters.timeRange.toLowerCase());
  }
  if (filters.limit) {
    query.append('limit', filters.limit.toString());
  }
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiClient<AlertRecord[]>(`/api/v1/alerts${qs}`);
}

export async function updateAlertStatus(alertId: string, status: string): Promise<AlertRecord> {
  return apiClient<AlertRecord>(`/api/v1/alerts/${alertId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function acknowledgeAlert(alertId: string): Promise<AlertRecord> {
  return apiClient<AlertRecord>(`/api/v1/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
}

export async function resolveAlert(alertId: string): Promise<AlertRecord> {
  return apiClient<AlertRecord>(`/api/v1/alerts/${alertId}/resolve`, {
    method: 'POST',
  });
}

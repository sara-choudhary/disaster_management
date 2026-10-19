import { apiClient } from './client';
import { NetworkEventItem } from '../types';

export interface ForensicTimelineStep {
  step_number: number;
  phase: string;
  timestamp: string;
  title: string;
  description: string;
  severity: string;
  resource?: string | null;
  details?: Record<string, any>;
}

export interface ForensicTimelineResponse {
  run_id: string;
  scenario_id?: string | null;
  result: string;
  start_time: string;
  end_time?: string | null;
  recovery_duration_sec: number;
  initial_state: Record<string, any>;
  final_state: Record<string, any>;
  packet_statistics: Record<string, any>;
  steps: ForensicTimelineStep[];
  related_alerts: any[];
  related_events: NetworkEventItem[];
  explanation: string;
}

export async function fetchForensicTimeline(runId: string): Promise<ForensicTimelineResponse> {
  return apiClient<ForensicTimelineResponse>(`/api/v1/events/timeline/${encodeURIComponent(runId)}`);
}

export async function fetchEventsWithFilters(params?: {
  severity?: string;
  resource?: string;
  run_id?: string;
  event_type?: string;
  time_range?: string;
  limit?: number;
}): Promise<NetworkEventItem[]> {
  const query = new URLSearchParams();
  if (params?.severity && params.severity !== 'ALL') query.append('severity', params.severity);
  if (params?.resource && params.resource.trim()) query.append('resource', params.resource.trim());
  if (params?.run_id) query.append('run_id', params.run_id);
  if (params?.event_type && params.event_type !== 'ALL') query.append('event_type', params.event_type);
  if (params?.time_range && params.time_range !== 'ALL') query.append('time_range', params.time_range.toLowerCase());
  if (params?.limit) query.append('limit', params.limit.toString());
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiClient<NetworkEventItem[]>(`/api/v1/events${qs}`);
}

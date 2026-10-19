import { apiClient } from './client';

export interface ConciseSummary {
  network_availability_pct: number | null;
  failed_resources: string[];
  failed_resources_count: number;
  alternate_route_selected_count: number;
  total_drills_count: number;
  recovery_result: {
    status?: string;
    successful_drills?: number;
    failed_drills?: number;
    success_rate_pct?: number;
    avg_recovery_seconds?: number;
    summary?: string;
  };
  packet_delivery_statistics: {
    total_packets_sent?: number;
    total_packets_delivered?: number;
    total_packets_lost?: number;
    aggregate_delivery_ratio_pct?: number | null;
  };
  security_events_count: number;
  recent_security_events: Array<{
    event_id: string;
    timestamp: string;
    message: string;
    affected_resource?: string;
    severity: string;
  }>;
  qos_observations: {
    scheduler_policy?: string;
    congestion_incidents?: number;
    traffic_classes?: number;
    summary?: string;
  };
}

export interface SummaryReportResponse {
  timestamp: string;
  total_nodes: number;
  active_nodes: number;
  offline_nodes: number;
  total_links: number;
  up_links: number;
  down_links: number;
  network_health_score: number;
  total_simulation_runs: number;
  successful_simulations: number;
  failed_simulations: number;
  simulation_success_rate: number;
  average_recovery_duration_sec: number;
  active_alerts: number;
  events_by_severity: Record<string, number>;
  concise_summary?: ConciseSummary;
  network_availability_pct?: number | null;
  failed_resources: string[];
  alternate_route_selected_count: number;
  recovery_result: Record<string, any>;
  packet_delivery_statistics: Record<string, any>;
  security_events_count: number;
  qos_observations: Record<string, any>;
}

export interface SimulationHistoryItem {
  run_id: string;
  scenario_id?: string | null;
  scenario_name: string;
  start_time: string;
  completion_time?: string | null;
  final_outcome: string;
  recovery_duration_sec?: number | null;
  packets_sent?: number | null;
  packets_delivered?: number | null;
  packets_lost?: number | null;
  delivery_ratio_pct?: number | null;
  alternate_route_selected: boolean;
  source?: string | null;
  destination?: string | null;
}

export interface SimulationHistoryPaginationResponse {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: SimulationHistoryItem[];
}

export interface SimulationRunReportResponse {
  run_id: string;
  scenario_id?: string | null;
  scenario_name?: string | null;
  status: string;
  start_time: string;
  end_time?: string | null;
  duration_seconds: number;
  packet_statistics: Record<string, any>;
  route_taken?: string[] | null;
  alternate_route_selected: boolean;
  events_triggered: Array<{
    event_id: string;
    timestamp: string;
    event_type: string;
    severity: string;
    message: string;
    affected_resource?: string;
  }>;
  alerts_triggered: Array<{
    alert_id: string;
    timestamp: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    status: string;
    affected_resource?: string;
  }>;
  initial_topology: Record<string, any>;
  final_topology: Record<string, any>;
  route_changes: string[];
  resilience_score: number;
  assessment: string;
  qos_observations?: string | null;
}

export async function fetchSummaryReport(): Promise<SummaryReportResponse> {
  return apiClient<SummaryReportResponse>('/api/v1/reports/summary');
}

export async function fetchSimulationHistory(params?: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<SimulationHistoryPaginationResponse> {
  const query = new URLSearchParams();
  if (params?.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params?.status && params.status !== 'ALL') {
    query.set('status', params.status);
  }
  if (params?.page) {
    query.set('page', params.page.toString());
  }
  if (params?.pageSize) {
    query.set('page_size', params.pageSize.toString());
  }

  const endpoint = `/api/v1/reports/history${query.toString() ? `?${query.toString()}` : ''}`;
  return apiClient<SimulationHistoryPaginationResponse>(endpoint);
}

export async function fetchSimulationReport(runId: string): Promise<SimulationRunReportResponse> {
  return apiClient<SimulationRunReportResponse>(`/api/v1/reports/simulations/${encodeURIComponent(runId)}`);
}

export async function downloadHistoryCsv(): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(`${baseUrl}/api/v1/reports/export/csv`);
  if (!response.ok) {
    throw new Error(`Failed to export simulation history CSV: ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'simulation_history.csv');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadSimulationJson(runId: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(`${baseUrl}/api/v1/reports/export/json/${encodeURIComponent(runId)}`);
  if (!response.ok) {
    throw new Error(`Failed to export simulation drill JSON: ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `simulation_${runId}.json`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

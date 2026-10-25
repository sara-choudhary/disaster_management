import { apiClient } from './client';
import {
  QoSSimulationRequest,
  QoSSimulationResponse,
  TrafficClass,
  SchedulerComparisonResponse,
} from '../types';

export interface DepartmentItem {
  id: number;
  code: string;
  name: string;
  department_type: string;
  subnet: string;
  gateway?: string;
  vlan_id?: number;
  priority: number;
}

export async function fetchDepartments(): Promise<DepartmentItem[]> {
  return apiClient<DepartmentItem[]>('/api/v1/departments');
}

export async function simulateTrafficQoS(
  payload: QoSSimulationRequest,
): Promise<QoSSimulationResponse> {
  return apiClient<QoSSimulationResponse>('/api/v1/traffic/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTrafficClasses(): Promise<TrafficClass[]> {
  return apiClient<TrafficClass[]>('/api/v1/traffic/classes');
}

export async function fetchQoSArchitecture(): Promise<{
  routing_role: string;
  qos_role: string;
  scheduling_policy: string;
  safeguards: string;
  traffic_classes: Array<{ code: string; name: string; priority: number; latency_budget: string }>;
  disclaimer: string;
}> {
  return apiClient('/api/v1/traffic/architecture');
}

export async function compareQoSSchedulers(
  payload: QoSSimulationRequest,
): Promise<SchedulerComparisonResponse> {
  return apiClient<SchedulerComparisonResponse>('/api/v1/traffic/compare-schedulers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


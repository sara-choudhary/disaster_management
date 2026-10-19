import { apiClient } from './client';
import {
  AccessRule,
  AccessRuleCreate,
  AccessRuleUpdate,
  ACLEvaluationRequest,
  ACLEvaluationResponse,
  Department,
  DepartmentUpdate,
} from '../types';

export async function fetchAccessRules(): Promise<AccessRule[]> {
  return apiClient<AccessRule[]>('/api/v1/access-rules');
}

export async function createAccessRule(payload: AccessRuleCreate): Promise<AccessRule> {
  return apiClient<AccessRule>('/api/v1/access-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAccessRule(
  ruleId: string,
  payload: AccessRuleUpdate
): Promise<AccessRule> {
  return apiClient<AccessRule>(`/api/v1/access-rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAccessRule(ruleId: string): Promise<{ message: string; deleted: boolean }> {
  return apiClient<{ message: string; deleted: boolean }>(`/api/v1/access-rules/${ruleId}`, {
    method: 'DELETE',
  });
}

export async function evaluateConnection(
  payload: ACLEvaluationRequest
): Promise<ACLEvaluationResponse> {
  return apiClient<ACLEvaluationResponse>('/api/v1/access-rules/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDepartments(): Promise<Department[]> {
  return apiClient<Department[]>('/api/v1/departments');
}

export async function updateDepartment(
  deptId: string,
  payload: DepartmentUpdate
): Promise<Department> {
  return apiClient<Department>(`/api/v1/departments/${deptId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

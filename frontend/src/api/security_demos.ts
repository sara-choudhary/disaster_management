import { apiClient } from './client';
import {
  DHCPSubnetConfig,
  DHCPLeaseRequest,
  DHCPLeaseResponse,
  SSHDeviceConfig,
  SSHSimulationRequest,
  SSHSimulationResponse,
  PortSecurityConfig,
  PortSecurityTestRequest,
  PortSecurityTestResponse,
  NATTranslationEntry,
  NATSimulationRequest,
  NATSimulationResponse,
} from '../types';

// ---------------- DHCP APIs ----------------

export async function fetchDHCPConfigs(): Promise<DHCPSubnetConfig[]> {
  return apiClient<DHCPSubnetConfig[]>('/api/v1/security-demos/dhcp');
}

export async function requestDHCPLease(
  payload: DHCPLeaseRequest
): Promise<DHCPLeaseResponse> {
  return apiClient<DHCPLeaseResponse>('/api/v1/security-demos/dhcp/lease', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function releaseDHCPLease(
  departmentCode: string,
  ipAddress: string
): Promise<{ released: boolean; ip_address: string; department: string }> {
  return apiClient<{ released: boolean; ip_address: string; department: string }>(
    `/api/v1/security-demos/dhcp/release?department_code=${encodeURIComponent(
      departmentCode
    )}&ip_address=${encodeURIComponent(ipAddress)}`,
    {
      method: 'POST',
    }
  );
}

export async function resetDHCPPool(departmentCode?: string): Promise<{ status: string }> {
  const query = departmentCode ? `?department_code=${encodeURIComponent(departmentCode)}` : '';
  return apiClient<{ status: string }>(`/api/v1/security-demos/dhcp/reset${query}`, {
    method: 'POST',
  });
}

// ---------------- SSH Management APIs ----------------

export async function fetchSSHConfigs(): Promise<SSHDeviceConfig[]> {
  return apiClient<SSHDeviceConfig[]>('/api/v1/security-demos/ssh/configs');
}

export async function simulateSSHConnect(
  payload: SSHSimulationRequest
): Promise<SSHSimulationResponse> {
  return apiClient<SSHSimulationResponse>('/api/v1/security-demos/ssh/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------- Port Security APIs ----------------

export async function fetchPortSecurityConfigs(): Promise<PortSecurityConfig[]> {
  return apiClient<PortSecurityConfig[]>('/api/v1/security-demos/port-security');
}

export async function testPortSecurity(
  payload: PortSecurityTestRequest
): Promise<PortSecurityTestResponse> {
  return apiClient<PortSecurityTestResponse>('/api/v1/security-demos/port-security/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetSwitchPort(portId: string): Promise<PortSecurityConfig> {
  return apiClient<PortSecurityConfig>(
    `/api/v1/security-demos/port-security/reset?port_id=${encodeURIComponent(portId)}`,
    {
      method: 'POST',
    }
  );
}

// ---------------- NAT APIs ----------------

export async function fetchNATTable(): Promise<NATTranslationEntry[]> {
  return apiClient<NATTranslationEntry[]>('/api/v1/security-demos/nat/table');
}

export async function simulateNATFlow(
  payload: NATSimulationRequest
): Promise<NATSimulationResponse> {
  return apiClient<NATSimulationResponse>('/api/v1/security-demos/nat/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

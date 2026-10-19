import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SecurityPage } from '../pages/SecurityPage';
import * as accessApi from '../api/access_rules';
import * as alertApi from '../api/alerts';
import * as demoApi from '../api/security_demos';

const mockDepartments = [
  { id: 1, code: 'ECC', name: 'Emergency Control Center', department_type: 'command', subnet: '192.168.10.0/24', gateway: '192.168.10.1', vlan_id: 10, priority: 1 },
  { id: 2, code: 'POLICE', name: 'Police Station', department_type: 'public_safety', subnet: '192.168.20.0/24', gateway: '192.168.20.1', vlan_id: 20, priority: 2 },
  { id: 3, code: 'FIRE', name: 'Fire Department', department_type: 'public_safety', subnet: '192.168.30.0/24', gateway: '192.168.30.1', vlan_id: 30, priority: 2 },
  { id: 4, code: 'HOSPITAL', name: 'Hospital', department_type: 'medical', subnet: '192.168.40.0/24', gateway: '192.168.40.1', vlan_id: 40, priority: 1 },
  { id: 5, code: 'AMBULANCE', name: 'Ambulance Services', department_type: 'medical', subnet: '192.168.50.0/24', gateway: '192.168.50.1', vlan_id: 50, priority: 1 },
  { id: 6, code: 'RELIEF', name: 'Relief Camp', department_type: 'humanitarian', subnet: '192.168.60.0/24', gateway: '192.168.60.1', vlan_id: 60, priority: 3 },
  { id: 7, code: 'BACKUP_CC', name: 'Backup Control Center', department_type: 'command', subnet: '192.168.70.0/24', gateway: '192.168.70.1', vlan_id: 70, priority: 1 },
];

const mockAccessRules = [
  { id: 1, rule_id: 'RULE-ALL-EMERGENCY', source: 'Emergency Control Center', destination: 'ALL', protocol: 'ANY', action: 'PERMIT', enabled: true },
  { id: 2, rule_id: 'RULE-MED-TRIAGE', source: 'Ambulance Services', destination: 'Hospital', protocol: 'TCP', action: 'PERMIT', enabled: true },
  { id: 3, rule_id: 'RULE-PUBLIC-ISOLATION', source: 'Relief Camp', destination: 'Backup Control Center', protocol: 'ANY', action: 'DENY', enabled: true },
];

const mockAlerts = [
  {
    id: 1,
    alert_id: 'ALT-SEC-01',
    severity: 'HIGH',
    category: 'SECURITY',
    title: 'Unauthorized Connection Dropped',
    description: 'Relief Camp attempted to connect to Backup Control Center.',
    status: 'ACTIVE',
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    alert_id: 'ALT-SYS-02',
    severity: 'LOW',
    category: 'CONNECTIVITY',
    title: 'Mesh Infrastructure Online',
    description: 'All 4 core routers and 7 departmental switches online.',
    status: 'RESOLVED',
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockDhcpConfigs = [
  {
    department_code: 'ECC',
    department_name: 'Emergency Control Center',
    vlan_id: 10,
    subnet: '192.168.10.0/24',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.10.1',
    dns_servers: ['192.168.10.1', '1.1.1.1'],
    pool_start_ip: '192.168.10.50',
    pool_end_ip: '192.168.10.56',
    total_pool_addresses: 7,
    active_leases_count: 1,
    available_addresses_count: 6,
    utilization_pct: 14.3,
    leases: [
      {
        ip_address: '192.168.10.50',
        mac_address: '02:00:c0:a8:0a:32',
        hostname: 'ECC-CAD-SERVER',
        leased_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        is_static: true,
      },
    ],
  },
];

const mockSshConfigs = [
  {
    device_id: 'ROUTER-01',
    device_name: 'Core Router 1 (North Hub)',
    device_type: 'Cisco 2911 ISR',
    ip_address: '10.0.0.1',
    management_vlan: 10,
    allowed_management_subnets: ['192.168.10.0/24', '192.168.70.0/24'],
    ssh_version: 'SSHv2',
    ciphers: ['chacha20-poly1305@openssh.com'],
    rsa_key_bits: 2048,
    simulated_ios_config: 'hostname ROUTER-01\naccess-list 99 permit 192.168.10.0 0.0.0.255\nline vty 0 4\n  access-class 99 in\n  transport input ssh',
  },
];

const mockPortConfigs = [
  {
    port_id: 'SW-HOSPITAL-Fa0/1',
    switch_id: 'SW-HOSPITAL',
    department: 'Hospital',
    vlan_id: 40,
    allowed_mac: '00:1A:2B:3C:4D:5E',
    max_mac_count: 1,
    violation_action: 'SHUTDOWN',
    operational_status: 'SECURE_UP',
    violation_count: 0,
  },
];

const mockNatTable = [
  {
    id: 1,
    protocol: 'TCP',
    inside_local_ip: '192.168.10.10',
    inside_local_port: 49210,
    inside_global_ip: '203.0.113.1',
    inside_global_port: 10210,
    outside_local_ip: '198.51.100.50',
    outside_local_port: 443,
    outside_global_ip: '198.51.100.50',
    outside_global_port: 443,
    description: 'ECC Incident Command -> NDMA Cloud',
    created_at: new Date().toISOString(),
  },
];

describe('AlertsPage - Security, Segmentation & Management Hub', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(accessApi, 'fetchDepartments').mockResolvedValue(mockDepartments as any);
    vi.spyOn(accessApi, 'fetchAccessRules').mockResolvedValue(mockAccessRules as any);
    vi.spyOn(alertApi, 'fetchAlerts').mockResolvedValue(mockAlerts as any);
    vi.spyOn(demoApi, 'fetchDHCPConfigs').mockResolvedValue(mockDhcpConfigs as any);
    vi.spyOn(demoApi, 'fetchSSHConfigs').mockResolvedValue(mockSshConfigs as any);
    vi.spyOn(demoApi, 'fetchPortSecurityConfigs').mockResolvedValue(mockPortConfigs as any);
    vi.spyOn(demoApi, 'fetchNATTable').mockResolvedValue(mockNatTable as any);
  });

  it('renders the header, simulation notice, and all 6 sub-navigation tabs', async () => {
    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Security, Segmentation & Management Center')).toBeInTheDocument();
      expect(screen.getByText(/Educational Simulation Notice: Software Modeled Network Infrastructure/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /VLANs & Access Control/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /DHCP Address Services/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /SSH Device Management/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch Port Security/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Perimeter NAT Gateway/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Security Audit Feed/i })).toBeInTheDocument();
    });
  });

  it('evaluates connection in ACL tab with OSPF routing vs authorization separation notice', async () => {
    vi.spyOn(accessApi, 'evaluateConnection').mockResolvedValue({
      permitted: false,
      action: 'DENY',
      matched_rule_id: 'RULE-PUBLIC-ISOLATION',
      explanation: "Explicitly denied by rule 'RULE-PUBLIC-ISOLATION'.",
      source_department: 'Relief Camp',
      destination_department: 'Backup Control Center',
      source_vlan_id: 60,
      destination_vlan_id: 70,
      source_ip: '192.168.60.10',
      destination_ip: '192.168.70.10',
      protocol: 'ANY',
      path_reachable: true,
      path: ['SHELTER-SOUTH-05', 'SW-RELIEF', 'ROUTER-03', 'BACKUP-CC-07'],
      routing_status: 'Layer 3 path reachable via OSPF',
      security_event_logged: true,
      disclaimer: 'SIMULATION NOTICE: This ACL evaluation is software-modeled.',
    });

    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Live Access Control Tester')).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /Test Connection/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('ACCESS DENIED / BLOCKED')).toBeInTheDocument();
      expect(screen.getByText(/Separation Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/Physical\/OSPF path is fully reachable, but packets are intercepted and dropped/i)).toBeInTheDocument();
    });
  });

  it('switches to DHCP tab and simulates address lease allocation', async () => {
    vi.spyOn(demoApi, 'requestDHCPLease').mockResolvedValue({
      success: true,
      assigned_ip: '192.168.10.51',
      subnet: '192.168.10.0/24',
      subnet_mask: '255.255.255.0',
      gateway: '192.168.10.1',
      dns_servers: ['192.168.10.1', '1.1.1.1'],
      mac_address: '02:00:c0:a8:0a:99',
      hostname: 'ECC-CAD-02',
      lease_time_sec: 86400,
      subnet_validation: 'VALIDATED: 192.168.10.51 belongs to 192.168.10.0/24',
      message: 'DHCP ACK: Successfully leased 192.168.10.51',
      pool_exhausted: false,
    });

    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    // Click DHCP tab
    const dhcpTabBtn = screen.getByRole('button', { name: /DHCP Address Services/i });
    fireEvent.click(dhcpTabBtn);

    await waitFor(() => {
      expect(screen.getByText('DHCP Subnet Scope & Address Pool')).toBeInTheDocument();
      expect(screen.getByText('192.168.10.50 – 192.168.10.56')).toBeInTheDocument();
    });

    // Request lease button
    const requestLeaseBtn = screen.getByRole('button', { name: /Request Single Lease/i });
    fireEvent.click(requestLeaseBtn);

    await waitFor(() => {
      expect(screen.getByText(/DHCP ACK: Address Assigned/i)).toBeInTheDocument();
      expect(screen.getByText(/VALIDATED: 192.168.10.51 belongs to 192.168.10.0\/24/i)).toBeInTheDocument();
    });
  });

  it('switches to SSH tab, renders simulated Cisco configuration, and tests authorized connection', async () => {
    vi.spyOn(demoApi, 'simulateSSHConnect').mockResolvedValue({
      authenticated: true,
      target_device: 'ROUTER-01',
      source_ip: '192.168.10.15',
      source_subnet_authorized: true,
      session_id: 'SSH-SESS-ABCD',
      cipher_suite: 'chacha20-poly1305@openssh.com',
      terminal_prompt: 'ROUTER-01# ',
      device_summary: {
        os_version: 'Cisco IOS Version 15.7',
        uptime: '14 days',
        router_id: '10.0.0.1',
        active_interfaces: ['GigabitEthernet0/0'],
      },
      explanation: 'Authorized SSHv2 Handshake Successful.',
      security_event_logged: false,
      disclaimer: 'SIMULATION NOTICE: Software demonstration.',
    });

    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RULE-ALL-EMERGENCY')).toBeInTheDocument();
    });

    const sshTabBtn = screen.getByRole('button', { name: /SSH Device Management/i });
    fireEvent.click(sshTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Simulated Cisco IOS SSH Configuration')).toBeInTheDocument();
      expect(screen.getAllByText(/access-class 99 in/i).length).toBeGreaterThanOrEqual(1);
    });

    const connectBtn = screen.getByRole('button', { name: /Simulate SSH Connection/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByText(/SSHv2 Session Established/i)).toBeInTheDocument();
      expect(screen.getByText(/Encrypted: chacha20-poly1305@openssh.com/i)).toBeInTheDocument();
      expect(screen.getByText(/ROUTER-01# show version/i)).toBeInTheDocument();
    });
  });

  it('switches to Port Security tab and tests rogue MAC violation', async () => {
    vi.spyOn(demoApi, 'testPortSecurity').mockResolvedValue({
      port_id: 'SW-HOSPITAL-Fa0/1',
      switch_id: 'SW-HOSPITAL',
      incoming_mac: 'DE:AD:BE:EF:CA:FE',
      allowed_mac: '00:1A:2B:3C:4D:5E',
      is_authorized: false,
      violation_action: 'SHUTDOWN',
      port_status_before: 'SECURE_UP',
      port_status_after: 'ERR_DISABLED',
      traffic_forwarded: false,
      violation_count: 1,
      explanation: 'PORT SECURITY VIOLATION: Rogue MAC detected. Port transitioned to ERR_DISABLED.',
      security_event_logged: true,
      disclaimer: 'SIMULATION NOTICE',
    });

    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RULE-ALL-EMERGENCY')).toBeInTheDocument();
    });

    const portTabBtn = screen.getByRole('button', { name: /Switch Port Security/i });
    fireEvent.click(portTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Port Security Ingress Tester')).toBeInTheDocument();
    });

    const injectFrameBtn = screen.getByRole('button', { name: /Inject Ingress Ethernet Frame/i });
    fireEvent.click(injectFrameBtn);

    await waitFor(() => {
      expect(screen.getByText('Port Security Violation')).toBeInTheDocument();
      expect(screen.getByText(/Port transitioned to ERR_DISABLED/i)).toBeInTheDocument();
      expect(screen.getByText(/Security alert & event logged to persistent database/i)).toBeInTheDocument();
    });
  });

  it('switches to NAT tab and verifies private-to-public translation and internal direct-routing notice', async () => {
    vi.spyOn(demoApi, 'simulateNATFlow').mockResolvedValue({
      translation_success: true,
      source_department: 'Hospital',
      flow_type: 'OUTBOUND_WAN',
      nat_applied: true,
      inside_local: '192.168.40.10:51234',
      inside_global: '203.0.113.1:10523',
      outside_global: '198.51.100.50:443',
      service_name: 'National Disaster Management Cloud',
      header_rewrite_summary: 'OUTBOUND PACKET REWRITE: [Source: 192.168.40.10:51234] ➔ [Rewritten: 203.0.113.1:10523]',
      internal_routing_notice: 'INTERNAL ROUTING DISTINCTION: NAT is NOT required for internal communication between departments.',
      translation_entry: null,
      disclaimer: 'SIMULATION NOTICE',
    });

    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RULE-ALL-EMERGENCY')).toBeInTheDocument();
    });

    const natTabBtn = screen.getByRole('button', { name: /Perimeter NAT Gateway/i });
    fireEvent.click(natTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Outbound WAN NAT Simulator')).toBeInTheDocument();
      expect(screen.getByText(/Direct OSPF Routing vs NAT Overload/i)).toBeInTheDocument();
    });

    const natBtn = screen.getByRole('button', { name: /Simulate Outbound NAT Request/i });
    fireEvent.click(natBtn);

    await waitFor(() => {
      expect(screen.getByText('Address Translation Flow Verified')).toBeInTheDocument();
      expect(screen.getByText(/NAT Src: 203.0.113.1:10523/i)).toBeInTheDocument();
      expect(screen.getByText(/NAT is NOT required for internal communication between departments/i)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';

const mockTopology = {
  nodes: [
    {
      id: 1,
      node_id: 'HQ-COMMAND-01',
      name: 'Central Emergency Command',
      node_type: 'command_center',
      status: 'active',
      battery_level: 100,
      pos_x: 200,
      pos_y: 150,
      ip_address: '192.168.10.10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      node_id: 'HOSPITAL-TRIAGE-03',
      name: 'Memorial Hospital',
      node_type: 'hospital',
      status: 'active',
      battery_level: 95,
      pos_x: 500,
      pos_y: 350,
      ip_address: '192.168.40.10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  links: [
    {
      id: 1,
      link_id: 'LINK-R1-R2',
      source_node_id: 'HQ-COMMAND-01',
      destination_node_id: 'HOSPITAL-TRIAGE-03',
      bandwidth: 1000,
      latency: 2.5,
      operational_state: 'UP',
      link_cost: 10,
      link_type: 'backbone',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  departments: [
    {
      id: 1,
      code: 'ECC',
      name: 'Emergency Control Center',
      department_type: 'command',
      subnet: '192.168.10.0/24',
      gateway: '192.168.10.1',
      vlan_id: 10,
      priority: 1,
    },
  ],
  subnets: [
    {
      department: 'Emergency Control Center',
      code: 'ECC',
      subnet: '192.168.10.0/24',
      gateway: '192.168.10.1',
      vlan_id: 10,
    },
  ],
};

const mockMetrics = {
  total_nodes: 13,
  up_nodes: 13,
  down_nodes: 0,
  degraded_nodes: 0,
  total_links: 12,
  up_links: 12,
  down_links: 0,
  network_health_score: 98.5,
  active_nodes: 13,
  average_latency_ms: 3.2,
  packet_loss_rate: 0.0,
  critical_traffic_delivery_rate: 100.0,
  timestamp: new Date().toISOString(),
};

const mockReachability = {
  source_node_id: 'HQ-COMMAND-01',
  reachable_destinations: 7,
  total_destinations: 7,
  reachability_percentage: 100.0,
  reachability_matrix: {
    'HOSPITAL-TRIAGE-03': {
      reachable: true,
      cost: 10,
      hops: 2,
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
    },
  },
};

const mockRoute = {
  source: 'HQ-COMMAND-01',
  destination: 'HOSPITAL-TRIAGE-03',
  path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
  hops: 1,
  cost: 10,
  estimated_latency_ms: 2.5,
  reachability: true,
  status: 'OPTIMAL',
  alternate_path_selected: false,
  hop_list: [
    {
      hop_number: 1,
      from_node: 'HQ-COMMAND-01',
      to_node: 'HOSPITAL-TRIAGE-03',
      link_id: 'LINK-R1-R2',
      cost: 10,
    },
  ],
};

const mockSimulations = [
  {
    run_id: 'SIM-20261019-001',
    scenario_id: 'drill-primary-failure',
    start_time: new Date(Date.now() - 60000).toISOString(),
    end_time: new Date().toISOString(),
    result: 'SUCCESS',
    recovery_duration: 0.045,
    packet_loss_rate: 0.01,
    rerouted_paths_count: 2,
    isolated_nodes_count: 0,
    created_at: new Date().toISOString(),
  },
];

const mockEvents = [
  {
    event_id: 'EVT-101',
    timestamp: new Date().toISOString(),
    event_type: 'ROUTE_CHANGE',
    severity: 'INFO',
    affected_resource: 'ROUTER-01',
    message: 'Dijkstra SPF convergence completed',
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, _init?: RequestInit) => {
        const u = url.toString();

        if (u.includes('/api/v1/network/topology')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockTopology,
          });
        }
        if (u.includes('/api/v1/network/metrics')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockMetrics,
          });
        }
        if (u.includes('/api/v1/network/reachability')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockReachability,
          });
        }
        if (u.includes('/api/v1/network/routes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockRoute,
          });
        }
        if (u.includes('/api/v1/alerts')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [],
          });
        }
        if (u.includes('/api/v1/simulations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockSimulations,
          });
        }
        if (u.includes('/api/v1/events')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockEvents,
          });
        }
        if (u.includes('/api/v1/network/links/LINK-R1-R2/failure')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: 'simulated_failure',
              resource_id: 'LINK-R1-R2',
              recovery_metrics: {
                total_recovery_duration_sec: 0.045,
                detection_delay_sec: 0.015,
                spf_calculation_delay_sec: 0.008,
                fib_update_delay_sec: 0.012,
                propagation_delay_sec: 0.01,
              },
            }),
          });
        }
        if (u.includes('/api/v1/network/reset')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: 'baseline_restored',
              restored_nodes_count: 13,
              restored_links_count: 12,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      }),
    );
  });

  it('renders the 5 core metric cards with real backend data', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Metric 1: Network Availability
    expect(await screen.findByText('Network Availability')).toBeInTheDocument();
    expect(screen.getByText('98.5%')).toBeInTheDocument();

    // Metric 2: Reachable Departments
    expect(screen.getByText('Reachable Departments')).toBeInTheDocument();
    expect(screen.getByText('7 / 7')).toBeInTheDocument();

    // Metric 3: Active Links
    expect(screen.getByText('Active Links')).toBeInTheDocument();
    expect(screen.getByText('12 / 12')).toBeInTheDocument();

    // Metric 4: Open Critical Alerts
    expect(screen.getByText('Open Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('All systems clear')).toBeInTheDocument();

    // Metric 5: Last Recovery Time
    expect(screen.getByText('Last Recovery Time')).toBeInTheDocument();
    expect(screen.getAllByText('0.045s').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all 4 functional action buttons with high-contrast visible styling', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const testBtn = await screen.findByRole('button', { name: /run connectivity test/i });
    expect(testBtn).toBeInTheDocument();
    expect(testBtn).toHaveClass('bg-coastal-cream');
    expect(testBtn).toHaveClass('text-coastal-text');

    const failBtn = screen.getByRole('button', { name: /simulate primary link failure/i });
    expect(failBtn).toBeInTheDocument();
    expect(failBtn).toHaveClass('bg-coastal-dusty-rose');
    expect(failBtn).toHaveClass('text-white');

    const restoreBtn = screen.getByRole('button', { name: /restore network/i });
    expect(restoreBtn).toBeInTheDocument();
    expect(restoreBtn).toHaveClass('bg-coastal-cream');
    expect(restoreBtn).toHaveClass('text-coastal-text');

    const scenarioBtn = screen.getByRole('button', { name: /open scenario runner/i });
    expect(scenarioBtn).toBeInTheDocument();
    expect(scenarioBtn).toHaveClass('bg-coastal-cerulean');
    expect(scenarioBtn).toHaveClass('text-white');
  });

  it('displays the active route path information and hop sequence', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Active Route Path banner
    expect(await screen.findByText(/Active Route Path/i)).toBeInTheDocument();
    expect(screen.getByText('OPTIMAL')).toBeInTheDocument();
    expect(screen.getByText('2.5 ms')).toBeInTheDocument();
  });

  it('handles "Run Connectivity Test" action button click', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const testBtn = await screen.findByRole('button', { name: /run connectivity test/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Connectivity test complete/i)).toBeInTheDocument();
    });
  });

  it('handles "Simulate Primary Link Failure" action button click', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const failBtn = await screen.findByRole('button', { name: /simulate primary link failure/i });
    fireEvent.click(failBtn);

    await waitFor(() => {
      expect(screen.getByText(/Primary link LINK-R1-R2 severed/i)).toBeInTheDocument();
    });
  });

  it('handles "Restore Network" action button click', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const restoreBtn = await screen.findByRole('button', { name: /restore network/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network baseline restored/i)).toBeInTheDocument();
    });
  });

  it('renders recent network events and compact simulation history', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Recent Network Events
    expect(await screen.findByText(/Recent Network Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Dijkstra SPF convergence completed/i)).toBeInTheDocument();

    // Compact Simulation History
    expect(screen.getByText(/Compact Simulation History/i)).toBeInTheDocument();
    expect(screen.getByText('SIM-20261019-001')).toBeInTheDocument();
    expect(screen.getByText('drill-primary-failure')).toBeInTheDocument();
  });

  it('handles error state when topology fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.reject(new Error('Network connection timeout')),
      ),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Failed to load topology from backend server/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrafficPage } from '../pages/TrafficPage';

const mockDepartments = [
  { id: 1, code: 'ECC', name: 'Emergency Control Center', department_type: 'command', subnet: '192.168.10.0/24', priority: 1 },
  { id: 2, code: 'POLICE', name: 'Police Station', department_type: 'public_safety', subnet: '192.168.20.0/24', priority: 2 },
  { id: 3, code: 'HOSPITAL', name: 'Hospital', department_type: 'medical', subnet: '192.168.40.0/24', priority: 1 },
];

const mockTrafficClasses = [
  { id: 1, code: 'CRITICAL', name: 'Ambulance Dispatch and Hospital Coordination', priority: 1, bandwidth_req: 2.0, latency_budget: 20.0 },
  { id: 2, code: 'HIGH', name: 'Police and Fire Communication', priority: 2, bandwidth_req: 5.0, latency_budget: 45.0 },
  { id: 3, code: 'NORMAL', name: 'Ordinary Departmental Communication', priority: 3, bandwidth_req: 15.0, latency_budget: 100.0 },
  { id: 4, code: 'LOW', name: 'Administrative or Background Traffic', priority: 4, bandwidth_req: 30.0, latency_budget: 250.0 },
];

const mockQoSResponse = {
  simulation_id: 'QOS-TEST-123',
  timestamp: new Date().toISOString(),
  source_department: 'Emergency Control Center',
  destination_department: 'Hospital',
  selected_class: 'CRITICAL',
  path: ['HQ-COMMAND-01', 'ROUTER-01', 'ROUTER-02', 'HOSPITAL-TRIAGE-03'],
  bottleneck_link_id: 'LINK-R1-R2',
  bottleneck_capacity_mbps: 100.0,
  total_offered_load_mbps: 145.0,
  link_utilization_pct: 100.0,
  is_congested: true,
  scheduler_policy: 'Strict Priority with Starvation Safeguard (SP-SS)',
  test_duration_sec: 10.0,
  packets_sent: 100,
  packets_delivered: 100,
  packets_lost: 0,
  delivery_ratio_pct: 100.0,
  estimated_latency_ms: 4.82,
  queue_delay_ms: 1.02,
  results_by_class: [
    {
      traffic_class: 'CRITICAL',
      class_name: 'Critical: Ambulance Dispatch & Hospital Coordination',
      priority: 1,
      offered_mbps: 50.0,
      allocated_mbps: 50.0,
      packets_sent: 100,
      packets_delivered: 100,
      packets_lost: 0,
      delivery_ratio_pct: 100.0,
      estimated_latency_ms: 4.82,
      queue_delay_ms: 1.02,
      status: 'OPTIMAL',
    },
    {
      traffic_class: 'HIGH',
      class_name: 'High: Police & Fire Communication',
      priority: 2,
      offered_mbps: 25.0,
      allocated_mbps: 25.0,
      packets_sent: 50,
      packets_delivered: 50,
      packets_lost: 0,
      delivery_ratio_pct: 100.0,
      estimated_latency_ms: 7.65,
      queue_delay_ms: 3.85,
      status: 'OPTIMAL',
    },
    {
      traffic_class: 'NORMAL',
      class_name: 'Normal: Ordinary Departmental Communication',
      priority: 3,
      offered_mbps: 35.0,
      allocated_mbps: 17.0,
      packets_sent: 70,
      packets_delivered: 34,
      packets_lost: 36,
      delivery_ratio_pct: 48.57,
      estimated_latency_ms: 30.12,
      queue_delay_ms: 26.25,
      status: 'CONGESTED_DEGRADED',
    },
    {
      traffic_class: 'LOW',
      class_name: 'Low: Administrative or Background Traffic',
      priority: 4,
      offered_mbps: 35.0,
      allocated_mbps: 8.0,
      packets_sent: 70,
      packets_delivered: 16,
      packets_lost: 54,
      delivery_ratio_pct: 22.86,
      estimated_latency_ms: 85.45,
      queue_delay_ms: 81.5,
      status: 'RATE_LIMITED_DROPPING',
    },
  ],
  simulated_estimate_notice:
    'SIMULATED ESTIMATE: All queuing, transmission delay, and packet delivery ratios are calculated by the deterministic QoS queuing and transmission model.',
  qos_vs_routing_explanation:
    'ROUTING VS. QOS MODEL: OSPF-inspired routing calculates and selects the shortest topological paths between network nodes based on link costs and reachability.',
};

describe('TrafficPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const u = url.toString();
        if (u.includes('/api/v1/departments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockDepartments,
          });
        }
        if (u.includes('/api/v1/traffic/classes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockTrafficClasses,
          });
        }
        if (u.includes('/api/v1/traffic/simulate')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockQoSResponse,
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

  it('renders all required simulation controls', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    // Controls
    expect(await screen.findByText('Source Department')).toBeInTheDocument();
    expect(screen.getByText('Destination Department')).toBeInTheDocument();
    expect(screen.getByText('Traffic Class')).toBeInTheDocument();
    expect(screen.getByText('Packet Count')).toBeInTheDocument();
    expect(screen.getByText('Offered Traffic Load')).toBeInTheDocument();
    expect(screen.getByText('Test Duration / Interval')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /simulate qos dispatch/i })).toBeInTheDocument();
  });

  it('displays the core metric cards correctly', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Packets Sent')).toBeInTheDocument();
    expect(screen.getByText('Packets Delivered')).toBeInTheDocument();
    expect(screen.getAllByText('Packets Lost').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Delivery Ratio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Estimated Latency')).toBeInTheDocument();
    expect(screen.getAllByText('Queue Delay').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Link Utilization')).toBeInTheDocument();
  });

  it('displays the Results by Priority Class table with all 4 classes', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Results by Priority Class/i)).toBeInTheDocument();

    // Verify all 4 traffic classes appear in the table
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HIGH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('NORMAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('LOW').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the simulated estimates notice and OSPF vs QoS explanation', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    // Simulated estimates notice
    expect(await screen.findByText(/Simulated Estimates/i)).toBeInTheDocument();
    expect(screen.getByText(/All queuing, transmission latency, queue delays/i)).toBeInTheDocument();

    // Architectural explanation
    expect(
      screen.getByText(/Network Architecture: Path Selection \(OSPF\) vs. Traffic Scheduling \(QoS\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1. Routing Plane \(OSPF-Inspired SPF\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Quality of Service \(QoS Scheduler Plane\)/i)).toBeInTheDocument();
  });

  it('executes simulation when clicking the submit button', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>,
    );

    const submitBtn = await screen.findByRole('button', { name: /simulate qos dispatch/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText('4.82 ms').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1.02 ms').length).toBeGreaterThanOrEqual(1);
    });
  });
});

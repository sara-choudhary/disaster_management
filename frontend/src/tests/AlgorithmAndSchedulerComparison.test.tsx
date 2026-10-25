import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkTopologyPage } from '../pages/NetworkTopologyPage';
import { TrafficPage } from '../pages/TrafficPage';

const mockTopology = {
  nodes: [
    {
      id: 1,
      node_id: 'HQ-COMMAND-01',
      name: 'Emergency Headquarters',
      node_type: 'router',
      department: 'Emergency Control Center',
      ip_address: '192.168.10.1',
      status: 'active',
      battery_level: 98,
      pos_x: 100,
      pos_y: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      node_id: 'HOSPITAL-TRIAGE-03',
      name: 'City Hospital',
      node_type: 'hospital',
      department: 'Hospital',
      ip_address: '192.168.40.1',
      status: 'active',
      battery_level: 95,
      pos_x: 300,
      pos_y: 200,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  links: [
    {
      id: 1,
      link_id: 'LINK-HQ-HOSP',
      source_node_id: 'HQ-COMMAND-01',
      destination_node_id: 'HOSPITAL-TRIAGE-03',
      bandwidth: 100.0,
      latency: 4.5,
      operational_state: 'UP',
      link_cost: 4.5,
      link_type: 'backbone',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  departments: [],
  metrics: { availability: 100.0 },
};

const mockAlgoResponse = {
  source: 'HQ-COMMAND-01',
  destination: 'HOSPITAL-TRIAGE-03',
  active_nodes_count: 2,
  active_links_count: 1,
  k_paths_requested: 3,
  algorithms: [
    {
      algorithm_key: 'dijkstra_spf',
      algorithm_name: 'Dijkstra SPF',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      total_cost: 4.5,
      hop_count: 1,
      reachable: true,
      execution_time_ms: 0.05,
      time_complexity: 'O((|V| + |E|) log |V|)',
      space_complexity: 'O(|V|)',
      purpose: 'Link-state shortest path first',
      assumptions: 'Non-negative edge weights',
      is_optimal: true,
    },
    {
      algorithm_key: 'bellman_ford',
      algorithm_name: 'Bellman-Ford',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      total_cost: 4.5,
      hop_count: 1,
      reachable: true,
      execution_time_ms: 0.12,
      time_complexity: 'O(|V| * |E|)',
      space_complexity: 'O(|V|)',
      purpose: 'Distance-vector routing with cycle detection',
      assumptions: 'Detects negative cycles',
      is_optimal: true,
    },
    {
      algorithm_key: 'floyd_warshall',
      algorithm_name: 'Floyd-Warshall',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      total_cost: 4.5,
      hop_count: 1,
      reachable: true,
      execution_time_ms: 0.25,
      time_complexity: 'O(|V|^3)',
      space_complexity: 'O(|V|^2)',
      purpose: 'All-pairs shortest path matrix',
      assumptions: 'Precomputes all-pairs distance matrix',
      scalability_warning: 'O(|V|^3) cubic complexity warning',
      is_optimal: true,
    },
    {
      algorithm_key: 'yen_k_shortest',
      algorithm_name: "Yen's K-Shortest Paths",
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      total_cost: 4.5,
      hop_count: 1,
      reachable: true,
      execution_time_ms: 0.18,
      time_complexity: 'O(K * |V| * (|E| + |V| log |V|))',
      space_complexity: 'O(K * |V|)',
      purpose: 'Top K ranked loopless alternative backup paths',
      assumptions: 'Computes deviation paths',
      is_optimal: true,
      ranked_alternatives: [
        {
          rank: 1,
          path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
          total_cost: 4.5,
          hop_count: 1,
          role: 'Primary OSPF Route',
          valid_after_failure: true,
        },
      ],
    },
  ],
  educational_notes: 'Dijkstra provides rapid link-state SPF convergence while Yen provides loopless disaster backup paths.',
  timestamp: new Date().toISOString(),
};

const mockSchedulerResponse = {
  source_department: 'Emergency Control Center',
  destination_department: 'Hospital',
  bottleneck_link_id: 'LINK-HQ-HOSP',
  bottleneck_capacity_mbps: 100.0,
  total_offered_load_mbps: 120.0,
  is_congested: true,
  schedulers: [
    {
      policy_key: 'strict_priority',
      policy_name: 'Strict Priority (SP)',
      description: 'Critical traffic preempts all lower queues.',
      starvation_observed: true,
      starvation_safeguard_active: false,
      critical_delivery_pct: 100.0,
      normal_delivery_pct: 45.0,
      low_delivery_pct: 0.0,
      results_by_class: [
        {
          traffic_class: 'CRITICAL',
          priority: 1,
          offered_rate_mbps: 40.0,
          allocated_bandwidth_mbps: 40.0,
          queue_delay_ms: 1.0,
          loss_ratio_pct: 0.0,
          delivery_ratio_pct: 100.0,
          starved: false,
          qos_compliance: true,
        },
        {
          traffic_class: 'LOW',
          priority: 4,
          offered_rate_mbps: 30.0,
          allocated_bandwidth_mbps: 0.0,
          queue_delay_ms: 250.0,
          loss_ratio_pct: 100.0,
          delivery_ratio_pct: 0.0,
          starved: true,
          qos_compliance: false,
        },
      ],
    },
    {
      policy_key: 'strict_priority_with_safeguards',
      policy_name: 'Strict Priority with Safeguard (SP-SS)',
      description: 'Strict priority with 8% starvation safeguard floor.',
      starvation_observed: false,
      starvation_safeguard_active: true,
      critical_delivery_pct: 100.0,
      normal_delivery_pct: 55.0,
      low_delivery_pct: 26.67,
      results_by_class: [
        {
          traffic_class: 'CRITICAL',
          priority: 1,
          offered_rate_mbps: 40.0,
          allocated_bandwidth_mbps: 40.0,
          queue_delay_ms: 1.0,
          loss_ratio_pct: 0.0,
          delivery_ratio_pct: 100.0,
          starved: false,
          qos_compliance: true,
        },
        {
          traffic_class: 'LOW',
          priority: 4,
          offered_rate_mbps: 30.0,
          allocated_bandwidth_mbps: 8.0,
          queue_delay_ms: 80.0,
          loss_ratio_pct: 73.33,
          delivery_ratio_pct: 26.67,
          starved: false,
          qos_compliance: false,
        },
      ],
    },
    {
      policy_key: 'weighted_fair_queueing',
      policy_name: 'Weighted Fair Queueing (WFQ)',
      description: 'Proportional bandwidth sharing (50/30/15/5%).',
      starvation_observed: false,
      starvation_safeguard_active: false,
      critical_delivery_pct: 100.0,
      normal_delivery_pct: 75.0,
      low_delivery_pct: 35.0,
      results_by_class: [
        {
          traffic_class: 'CRITICAL',
          priority: 1,
          offered_rate_mbps: 40.0,
          allocated_bandwidth_mbps: 40.0,
          queue_delay_ms: 1.5,
          loss_ratio_pct: 0.0,
          delivery_ratio_pct: 100.0,
          starved: false,
          qos_compliance: true,
        },
      ],
    },
    {
      policy_key: 'round_robin',
      policy_name: 'Round Robin (RR)',
      description: 'Equal bandwidth slice (25% each).',
      starvation_observed: false,
      starvation_safeguard_active: false,
      critical_delivery_pct: 62.5,
      normal_delivery_pct: 62.5,
      low_delivery_pct: 62.5,
      results_by_class: [
        {
          traffic_class: 'CRITICAL',
          priority: 1,
          offered_rate_mbps: 40.0,
          allocated_bandwidth_mbps: 25.0,
          queue_delay_ms: 15.0,
          loss_ratio_pct: 37.5,
          delivery_ratio_pct: 62.5,
          starved: false,
          qos_compliance: false,
        },
      ],
    },
  ],
  engineering_insights: 'Strict priority guarantees zero latency for SOS dispatch but starves background relief logistics without safeguards.',
};

describe('Multi-Algorithm and QoS Scheduler Integration Suite', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const u = url.toString();
        if (u.includes('/api/v1/network/topology')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockTopology });
        }
        if (u.includes('/api/v1/network/reachability')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              source_node_id: 'HQ-COMMAND-01',
              total_destinations: 1,
              reachable_destinations: 1,
              reachability_percentage: 100.0,
              destinations: {},
            }),
          });
        }
        if (u.includes('/api/v1/events')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        }
        if (u.includes('/api/v1/network/routes/compare-algorithms')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockAlgoResponse });
        }
        if (u.includes('/api/v1/departments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              { id: 1, code: 'ECC', name: 'Emergency Control Center', department_type: 'command', subnet: '192.168.10.0/24', priority: 1 },
              { id: 2, code: 'HOSP', name: 'Hospital', department_type: 'medical', subnet: '192.168.40.0/24', priority: 1 },
            ],
          });
        }
        if (u.includes('/api/v1/traffic/classes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              { id: 1, code: 'CRITICAL', name: 'Critical: Ambulance & Hospital', priority: 1, bandwidth_req: 2.0, latency_budget: 20.0 },
            ],
          });
        }
        if (u.includes('/api/v1/traffic/simulate')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              simulation_id: 'QOS-TEST',
              timestamp: new Date().toISOString(),
              source_department: 'Emergency Control Center',
              destination_department: 'Hospital',
              selected_class: 'CRITICAL',
              path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
              bottleneck_link_id: 'LINK-HQ-HOSP',
              bottleneck_capacity_mbps: 100.0,
              total_offered_load_mbps: 50.0,
              link_utilization_pct: 50.0,
              is_congested: false,
              scheduler_policy: 'Strict Priority with Starvation Safeguard (SP-SS)',
              test_duration_sec: 10.0,
              packets_sent: 100,
              packets_delivered: 100,
              packets_lost: 0,
              delivery_ratio_pct: 100.0,
              estimated_latency_ms: 4.5,
              queue_delay_ms: 0.5,
              results_by_class: [],
              simulated_estimate_notice: 'SIMULATED ESTIMATE',
              qos_vs_routing_explanation: 'ROUTING VS QOS',
            }),
          });
        }
        if (u.includes('/api/v1/traffic/compare-schedulers')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockSchedulerResponse });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }),
    );
  });

  it('renders Multi-Algorithm Routing Comparison tab on NetworkTopologyPage and compares all 4 algorithms', async () => {
    render(
      <MemoryRouter>
        <NetworkTopologyPage />
      </MemoryRouter>
    );

    // Click Multi-Algorithm Routing Comparison tab
    const algoTabBtn = await screen.findByRole('button', { name: /Multi-Algorithm Routing Comparison/i });
    expect(algoTabBtn).toBeInTheDocument();
    fireEvent.click(algoTabBtn);

    // Verify all 4 algorithm cards render
    await waitFor(() => {
      expect(screen.getByText('Dijkstra SPF')).toBeInTheDocument();
      expect(screen.getByText('Bellman-Ford')).toBeInTheDocument();
      expect(screen.getByText('Floyd-Warshall')).toBeInTheDocument();
      expect(screen.getByText("Yen's K-Shortest Paths")).toBeInTheDocument();
    });

    // Verify complexity notices
    expect(screen.getByText('O((|V| + |E|) log |V|)')).toBeInTheDocument();
    expect(screen.getByText('O(|V|^3)')).toBeInTheDocument();

    // Verify Yen's alternative backup paths section
    expect(screen.getByText(/Yen's Loopless Backup Routes/i)).toBeInTheDocument();
    expect(screen.getByText('Primary OSPF Route')).toBeInTheDocument();
  });

  it('renders QoS Scheduler Comparison tab on TrafficPage and reveals starvation behavior', async () => {
    render(
      <MemoryRouter>
        <TrafficPage />
      </MemoryRouter>
    );

    // Switch to Compare QoS Schedulers tab
    const compTabBtn = await screen.findByRole('button', { name: /Compare QoS Schedulers & Starvation/i });
    expect(compTabBtn).toBeInTheDocument();
    fireEvent.click(compTabBtn);

    // Verify 4 scheduler policies render in cards and comparison table
    await waitFor(() => {
      expect(screen.getAllByText('Strict Priority (SP)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Strict Priority with Safeguard (SP-SS)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Weighted Fair Queueing (WFQ)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Round Robin (RR)').length).toBeGreaterThanOrEqual(1);
    });

    // Verify starvation observation tags
    expect(screen.getByText('STARVATION OBSERVED')).toBeInTheDocument();
    const noStarvBadges = screen.getAllByText('NO STARVATION');
    expect(noStarvBadges.length).toBeGreaterThanOrEqual(3);

    // Verify breakdown table headers
    expect(screen.getByText(/Cross-Scheduler Class Allocation Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Disaster Network Traffic Engineering Insights/i)).toBeInTheDocument();
  });
});

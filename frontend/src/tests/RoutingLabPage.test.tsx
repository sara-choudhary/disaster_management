import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoutingLabPage } from '../pages/RoutingLabPage';

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
      node_id: 'ROUTER-02',
      name: 'Midpoint Transit',
      node_type: 'router',
      department: 'Transit',
      ip_address: '192.168.20.1',
      status: 'active',
      battery_level: 90,
      pos_x: 200,
      pos_y: 150,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
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
    {
      id: 2,
      link_id: 'LINK-HQ-R2',
      source_node_id: 'HQ-COMMAND-01',
      destination_node_id: 'ROUTER-02',
      bandwidth: 50.0,
      latency: 2.0,
      operational_state: 'UP',
      link_cost: 2.0,
      link_type: 'secondary',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      link_id: 'LINK-R2-HOSP',
      source_node_id: 'ROUTER-02',
      destination_node_id: 'HOSPITAL-TRIAGE-03',
      bandwidth: 50.0,
      latency: 5.2,
      operational_state: 'UP',
      link_cost: 5.2,
      link_type: 'secondary',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

const mockAlgorithmComparison = {
  source: 'HQ-COMMAND-01',
  destination: 'HOSPITAL-TRIAGE-03',
  active_nodes_count: 3,
  active_links_count: 3,
  k_paths_requested: 3,
  algorithms: [
    {
      algorithm_key: 'dijkstra',
      algorithm_name: 'Dijkstra SPF',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      hop_count: 1,
      total_cost: 4.5,
      reachable: true,
      execution_time_ms: 0.045,
      time_complexity: 'O((|V| + |E|) log |V|)',
      space_complexity: 'O(|V|)',
      purpose: 'Link-state shortest path first (current baseline)',
      assumptions: 'Non-negative edge weights',
      is_optimal: true,
    },
    {
      algorithm_key: 'bellman_ford',
      algorithm_name: 'Bellman-Ford',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      hop_count: 1,
      total_cost: 4.5,
      reachable: true,
      execution_time_ms: 0.12,
      time_complexity: 'O(|V| * |E|)',
      space_complexity: 'O(|V|)',
      purpose: 'Distance-vector alternative & negative-cycle detection',
      assumptions: 'No negative cycles',
      is_optimal: true,
    },
    {
      algorithm_key: 'floyd_warshall',
      algorithm_name: 'Floyd-Warshall',
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      hop_count: 1,
      total_cost: 4.5,
      reachable: true,
      execution_time_ms: 0.35,
      time_complexity: 'O(|V|^3)',
      space_complexity: 'O(|V|^2)',
      purpose: 'Dynamic programming all-pairs distance matrix',
      assumptions: 'No negative cycles',
      is_optimal: true,
    },
    {
      algorithm_key: 'yen_k_shortest',
      algorithm_name: "Yen's K-Shortest Loopless Paths",
      path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
      hop_count: 1,
      total_cost: 4.5,
      reachable: true,
      execution_time_ms: 0.21,
      time_complexity: 'O(K * |V| (|E| + |V| log |V|))',
      space_complexity: 'O(K * |V|)',
      purpose: 'Top K ranked loopless alternative paths for disaster resilience',
      assumptions: 'Non-negative edge weights',
      is_optimal: true,
      ranked_alternatives: [
        {
          rank: 1,
          role: 'Optimal Primary Path',
          path: ['HQ-COMMAND-01', 'HOSPITAL-TRIAGE-03'],
          total_cost: 4.5,
          hop_count: 1,
          valid_after_failure: true,
        },
        {
          rank: 2,
          role: 'Alternate Path #1',
          path: ['HQ-COMMAND-01', 'ROUTER-02', 'HOSPITAL-TRIAGE-03'],
          total_cost: 7.2,
          hop_count: 2,
          valid_after_failure: true,
        },
      ],
    },
  ],
  educational_notes: 'Dijkstra, Bellman-Ford, and Floyd-Warshall calculate identical optimal path metrics.',
  timestamp: new Date().toISOString(),
};

describe('RoutingLabPage Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/v1/network/topology')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTopology),
          });
        }
        if (url.includes('/api/v1/network/routes/compare-algorithms')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAlgorithmComparison),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }),
    );
  });

  it('renders the header and all 4 routing algorithm cards', async () => {
    render(
      <MemoryRouter>
        <RoutingLabPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Multi-Algorithm Routing Lab & Disaster Recovery Analysis'),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Dijkstra SPF')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Bellman-Ford')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Floyd-Warshall')[0]).toBeInTheDocument();
      expect(screen.getAllByText("Yen's K-Shortest Loopless Paths")[0]).toBeInTheDocument();
    });
  });

  it('renders the 3-tier timing separation architecture', async () => {
    render(
      <MemoryRouter>
        <RoutingLabPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Architectural Separation: Algorithmic Compute vs Network Convergence vs Recovery Duration'),
      ).toBeInTheDocument();
      expect(screen.getByText(/1\. Algorithmic Compute Time/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Modeled Network Convergence/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. End-to-End Recovery Duration/i)).toBeInTheDocument();
    });
  });

  it('renders Yen ranked alternatives and constraints table', async () => {
    render(
      <MemoryRouter>
        <RoutingLabPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Yen's K-Shortest Loopless Paths: Pre-Computed Disaster Backup Routes"),
      ).toBeInTheDocument();
      expect(screen.getByText('Optimal Primary Path')).toBeInTheDocument();
      expect(screen.getByText('Alternate Path #1')).toBeInTheDocument();
      expect(
        screen.getByText('Comprehensive Routing Algorithm Constraints & Specifications'),
      ).toBeInTheDocument();
    });
  });
});

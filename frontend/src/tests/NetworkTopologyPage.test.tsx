import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NetworkTopologyPage } from '../pages/NetworkTopologyPage';

describe('NetworkTopologyPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/network/topology')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              nodes: [
                {
                  id: 1,
                  node_id: 'ROUTER-01',
                  name: 'Core Router 1 (North)',
                  node_type: 'router',
                  status: 'active',
                  battery_level: 100,
                  pos_x: 420,
                  pos_y: 180,
                  ip_address: '10.0.0.1',
                  extra_metadata: { subnet: '10.0.12.0/30' },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  id: 2,
                  node_id: 'SW-ECC',
                  name: 'ECC Switch',
                  node_type: 'switch',
                  status: 'active',
                  battery_level: 98,
                  pos_x: 240,
                  pos_y: 100,
                  ip_address: '192.168.10.2',
                  extra_metadata: { subnet: '192.168.10.0/24', gateway: '192.168.10.1' },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              links: [
                {
                  id: 1,
                  link_id: 'LINK-R1-SW-ECC',
                  source_node_id: 'ROUTER-01',
                  destination_node_id: 'SW-ECC',
                  bandwidth: 100,
                  latency: 1.0,
                  operational_state: 'UP',
                  link_cost: 1.0,
                  link_type: 'distribution',
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
              metrics: {
                total_nodes: 2,
                active_nodes: 2,
                total_links: 1,
                up_links: 1,
                network_health_score: 100,
              },
              subnets: [
                {
                  department: 'Emergency Control Center',
                  code: 'ECC',
                  subnet: '192.168.10.0/24',
                  gateway: '192.168.10.1',
                  vlan_id: 10,
                },
              ],
              status: 'ok',
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

  it('renders heading, fit view button, and topology legend', async () => {
    render(<NetworkTopologyPage />);

    expect(screen.getByText(/Redundant Ring Network Topology/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /fit view/i }).length).toBeGreaterThanOrEqual(1);

    // Verify legend items

    expect(screen.getByText(/Healthy Ring/i)).toBeInTheDocument();
    expect(screen.getByText(/Ordinary Link/i)).toBeInTheDocument();
    expect(screen.getByText(/Mauve Secondary/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed Link/i)).toBeInTheDocument();

    // Verify subnets summary loaded from backend
    await waitFor(() => {
      expect(screen.getByText(/192.168.10.0\/24/i)).toBeInTheDocument();
    });
  });
});

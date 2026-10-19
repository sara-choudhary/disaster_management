import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Emergency Communication Network Frontend', () => {
  beforeEach(() => {
    // Reset window history path to root
    window.history.pushState({}, 'Test', '/');

    // Mock global fetch for health check and initial API calls
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: 'ok',
              app_name: 'Disaster-Resistant Emergency Communication Network',
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              database: 'connected',
              details: {},
            }),
          });
        }
        if (url.includes('/api/v1/nodes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 1,
                node_id: 'HQ-COMMAND-01',
                name: 'Central Emergency Command',
                node_type: 'command_center',
                status: 'active',
                battery_level: 100,
                pos_x: 100,
                pos_y: 150,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          });
        }
        if (url.includes('/api/v1/network/topology')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              nodes: [
                {
                  id: 1,
                  node_id: 'HQ-COMMAND-01',
                  name: 'Central Emergency Command',
                  node_type: 'command_center',
                  status: 'active',
                  battery_level: 100,
                  pos_x: 100,
                  pos_y: 150,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              links: [],
              departments: [],
              subnets: [],
            }),
          });
        }
        if (url.includes('/api/v1/network/metrics')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              total_nodes: 1,
              up_nodes: 1,
              down_nodes: 0,
              degraded_nodes: 0,
              total_links: 0,
              up_links: 0,
              down_links: 0,
              network_health_score: 100.0,
              average_latency_ms: 1.5,
              packet_loss_rate: 0.0,
              critical_traffic_delivery_rate: 100.0,
              timestamp: new Date().toISOString(),
            }),
          });
        }
        if (url.includes('/api/v1/network/reachability')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              source_node_id: 'HQ-COMMAND-01',
              reachable_destinations: 1,
              total_destinations: 1,
              reachability_matrix: {},
            }),
          });
        }
        if (url.includes('/api/v1/network/routes')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              source: 'HQ-COMMAND-01',
              destination: 'HOSPITAL-TRIAGE-03',
              path: ['HQ-COMMAND-01'],
              hop_list: [],
              total_cost: 0,
              reachability: true,
            }),
          });
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [],
          });
        }
        if (url.includes('/api/v1/simulations')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [],
          });
        }
        if (url.includes('/api/v1/events')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [],
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

  it('renders compact header with hamburger button and hides sidebar by default', () => {
    render(<App />);

    // Header hamburger button exists
    const hamburgerBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(hamburgerBtn).toBeInTheDocument();
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');

    // Sidebar drawer is hidden by default (does not occupy screen space)
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('opens sidebar on hamburger click and displays all 7 navigation links', () => {
    render(<App />);

    const hamburgerBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(hamburgerBtn);

    // Sidebar dialog is now open
    const sidebar = screen.getByRole('dialog', { name: /navigation menu/i });
    expect(sidebar).toBeInTheDocument();
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'true');

    // Verify all 7 required navigation links are present
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /network topology/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /scenarios/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /traffic & qos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
  });

  it('closes sidebar when clicking hamburger again', () => {
    render(<App />);

    const hamburgerBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(hamburgerBtn);
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();

    // Click hamburger again to toggle closed
    fireEvent.click(hamburgerBtn);
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('closes sidebar when pressing Escape key', () => {
    render(<App />);

    const hamburgerBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(hamburgerBtn);
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();

    // Fire Escape key event
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('closes sidebar and navigates when clicking a navigation link', async () => {
    render(<App />);

    const hamburgerBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(hamburgerBtn);

    const overviewLink = screen.getByRole('link', { name: /overview/i });
    fireEvent.click(overviewLink);

    // Sidebar closes after selection
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();

    // Overview (Dashboard) view is displayed
    expect(await screen.findByText(/Emergency Operations Dashboard/i)).toBeInTheDocument();
  });

  it('renders the landing page hero section at / with Explore Dashboard button and navigates to dashboard', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Disaster-Resistant Emergency Communication Network with Priority Routing/i,
      }),
    ).toBeInTheDocument();

    const exploreBtn = screen.getByRole('link', { name: /Explore Dashboard/i });
    expect(exploreBtn).toBeInTheDocument();
    expect(exploreBtn).toHaveClass('bg-coastal-dusty-rose');
    expect(exploreBtn).toHaveClass('text-white');
    expect(exploreBtn).toHaveAttribute('href', '/dashboard');

    fireEvent.click(exploreBtn);
    expect(await screen.findByText(/Emergency Operations Dashboard/i)).toBeInTheDocument();
  });
});

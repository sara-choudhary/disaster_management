import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Emergency Communication Network Frontend', () => {
  beforeEach(() => {
    // Reset browser history / path to root
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
        if (url.includes('/api/v1/simulation/messages')) {
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

  it('renders the landing page hero section at root route / without displaying the dashboard immediately', async () => {
    render(<App />);
    
    // Verifies full title is displayed on landing page
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Disaster-Resistant Emergency Communication Network with Priority Routing/i,
      }),
    ).toBeInTheDocument();

    // Verifies supporting explanation text is present
    expect(
      screen.getByText(/Engineered for crisis environments where conventional internet infrastructure has collapsed/i),
    ).toBeInTheDocument();

    // Verifies single prominent action button exists
    const exploreBtn = screen.getByRole('link', { name: /Explore Dashboard/i });
    expect(exploreBtn).toBeInTheDocument();
    expect(exploreBtn).toHaveAttribute('href', '/dashboard');

    // Dashboard header should NOT be present on initial landing page load
    expect(screen.queryByText(/Emergency Operations Dashboard/i)).not.toBeInTheDocument();
  });

  it('renders branding and top-level navigation links', async () => {
    render(<App />);
    expect(screen.getByText(/DisasterComm/i)).toBeInTheDocument();
    expect(screen.getByText(/Mesh Router/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mesh topology/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /priority router/i })).toBeInTheDocument();
  });

  it('navigates to the dashboard when clicking Explore Dashboard', async () => {
    render(<App />);
    const exploreBtn = screen.getByRole('link', { name: /Explore Dashboard/i });
    fireEvent.click(exploreBtn);

    // Dashboard elements should now be visible
    expect(await screen.findByText(/Emergency Operations Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Route Emergency Packet/i)).toBeInTheDocument();
  });
});

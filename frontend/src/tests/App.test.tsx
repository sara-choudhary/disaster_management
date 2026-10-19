import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('Emergency Communication Network Frontend', () => {
  beforeEach(() => {
    // Mock global fetch for health check and initial page load
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

  it('renders the branding and navigation elements', async () => {
    render(<App />);
    expect(screen.getByText(/DisasterComm/i)).toBeInTheDocument();
    expect(screen.getByText(/Mesh Router/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mesh topology/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /priority router/i })).toBeInTheDocument();
  });

  it('renders operations dashboard headers and action buttons', async () => {
    render(<App />);
    expect(screen.getByText(/Emergency Operations Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Route Emergency Packet/i)).toBeInTheDocument();
  });
});

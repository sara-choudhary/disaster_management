import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TelemetryPage } from '../pages/TelemetryPage';
import * as telemetryApi from '../api/telemetry';
import { TelemetryResponse } from '../types';

// Mock Recharts ResponsiveContainer for jsdom test stability
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

const mockTelemetryData: TelemetryResponse = {
  time_range: '24h',
  data_points_count: 3,
  has_sufficient_data: true,
  explanation: null,
  snapshot: {
    total_simulation_runs: 12,
    current_health_score: 98.5,
    current_availability_pct: 99.2,
    current_avg_latency_ms: 12.4,
    active_nodes: 21,
    total_nodes: 21,
    active_links: 25,
    total_links: 25,
    active_alerts: 0,
    modeled_status: 'OPTIMAL',
  },
  availability_over_time: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      availability_pct: 100.0,
      node_availability_pct: 100.0,
      link_availability_pct: 100.0,
      reachability_pct: 100.0,
      run_id: 'RUN-BASE-01',
      drill_name: 'DRILL-BASELINE-RING',
    },
    {
      timestamp: '2026-10-20T00:30:00Z',
      time_label: '00:30:00',
      availability_pct: 98.5,
      node_availability_pct: 100.0,
      link_availability_pct: 96.0,
      reachability_pct: 100.0,
      run_id: 'RUN-BASE-02',
      drill_name: 'DRILL-AMBULANCE-VERIFY',
    },
  ],
  latency_over_time: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      estimated_latency_ms: 11.5,
      baseline_target_ms: 15.0,
      warning_threshold_ms: 45.0,
      run_id: 'RUN-BASE-01',
    },
    {
      timestamp: '2026-10-20T00:30:00Z',
      time_label: '00:30:00',
      estimated_latency_ms: 13.8,
      baseline_target_ms: 15.0,
      warning_threshold_ms: 45.0,
      run_id: 'RUN-BASE-02',
    },
  ],
  packet_delivery_and_loss: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      delivery_ratio_pct: 100.0,
      packet_loss_pct: 0.0,
      total_packets: 50,
      delivered_packets: 50,
      dropped_packets: 0,
      run_id: 'RUN-BASE-01',
    },
    {
      timestamp: '2026-10-20T00:30:00Z',
      time_label: '00:30:00',
      delivery_ratio_pct: 98.0,
      packet_loss_pct: 2.0,
      total_packets: 50,
      delivered_packets: 49,
      dropped_packets: 1,
      run_id: 'RUN-BASE-02',
    },
  ],
  link_utilization: [
    {
      link_id: 'LINK-R1-R2',
      link_name: 'ROUTER-01 ➔ ROUTER-02',
      source_node_id: 'ROUTER-01',
      destination_node_id: 'ROUTER-02',
      operational_state: 'UP',
      bandwidth_mbps: 1000.0,
      current_load_mbps: 624.0,
      utilization_pct: 62.4,
      link_cost: 1.0,
      is_secondary: false,
    },
    {
      link_id: 'LINK-R2-R3',
      link_name: 'ROUTER-02 ➔ ROUTER-03',
      source_node_id: 'ROUTER-02',
      destination_node_id: 'ROUTER-03',
      operational_state: 'UP',
      bandwidth_mbps: 1000.0,
      current_load_mbps: 450.0,
      utilization_pct: 45.0,
      link_cost: 1.0,
      is_secondary: false,
    },
  ],
  traffic_volume_by_class: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      critical_mbps: 18.5,
      high_mbps: 28.0,
      normal_mbps: 42.0,
      low_mbps: 16.5,
      total_offered_mbps: 105.0,
      run_id: 'RUN-BASE-01',
    },
  ],
  recovery_duration: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      recovery_duration_sec: 0.045,
      target_sla_sec: 1.5,
      scenario_name: 'DRILL-BASELINE-RING',
      result: 'SUCCESS',
      run_id: 'RUN-BASE-01',
    },
  ],
  route_changes_over_time: [
    {
      timestamp: '2026-10-20T00:10:00Z',
      time_label: '00:10:00',
      route_changes_count: 2,
      alternate_paths_activated: 0,
      events_logged: 1,
      run_id: 'RUN-BASE-01',
    },
  ],
  disclaimer: 'SIMULATED TELEMETRY NOTICE: Modeled algorithmic estimates.',
};

describe('TelemetryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header, simulation disclaimer notice, and 5 snapshot metric cards', async () => {
    vi.spyOn(telemetryApi, 'fetchTelemetry').mockResolvedValue(mockTelemetryData);

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    // Header & Disclaimer
    expect(screen.getByText('Network Telemetry & Historical Trends')).toBeInTheDocument();
    expect(screen.getByText('Modeled Telemetry Notice')).toBeInTheDocument();
    expect(screen.getAllByText(/Simulated Estimates/i).length).toBeGreaterThanOrEqual(1);

    // Snapshot Metric Cards
    await waitFor(() => {
      expect(screen.getByText('99.2%')).toBeInTheDocument();
      expect(screen.getByText('12.4')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('98.5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument(); // total drills
    });
  });

  it('renders all 8 visualization sections when sufficient historical data exists', async () => {
    vi.spyOn(telemetryApi, 'fetchTelemetry').mockResolvedValue(mockTelemetryData);

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Chart 1: Availability
      expect(screen.getByText(/Network Availability Over Time/i)).toBeInTheDocument();
      // Chart 2: Latency
      expect(screen.getByText(/Estimated Latency \(Dijkstra Shortest Path\)/i)).toBeInTheDocument();
      // Chart 3 & 4: Packet delivery & loss
      expect(screen.getByText(/Packet Delivery Ratio & Packet Loss/i)).toBeInTheDocument();
      // Chart 5: Traffic volume by class
      expect(screen.getByText(/Traffic Volume by Priority Class/i)).toBeInTheDocument();
      // Chart 6: Recovery duration
      expect(screen.getByText(/Recovery Duration \(SPF Convergence\)/i)).toBeInTheDocument();
      // Chart 7: Route changes
      expect(screen.getByText(/Route Changes & Alternate Paths Over Time/i)).toBeInTheDocument();
      // Chart 8: Link utilization
      expect(screen.getByText(/Physical & Logical Link Utilization/i)).toBeInTheDocument();
    });
  });

  it('handles time range filtering controls and re-fetches with new parameter', async () => {
    const fetchSpy = vi.spyOn(telemetryApi, 'fetchTelemetry').mockResolvedValue(mockTelemetryData);

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('24h');
    });

    // Click '1 Hour' filter
    const oneHourBtn = screen.getByRole('button', { name: '1 Hour' });
    fireEvent.click(oneHourBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('1h');
    });

    // Click 'All Drills' filter
    const allBtn = screen.getByRole('button', { name: 'All Drills' });
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('all');
    });
  });

  it('displays meaningful empty state when insufficient historical data exists', async () => {
    const emptyTelemetryData: TelemetryResponse = {
      ...mockTelemetryData,
      has_sufficient_data: false,
      data_points_count: 1,
      explanation: 'Only 1 simulation run found. Historical telemetry progression requires at least 2 simulation drill runs.',
    };

    vi.spyOn(telemetryApi, 'fetchTelemetry').mockResolvedValue(emptyTelemetryData);

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Insufficient Historical Data for Selected Window')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Historical telemetry progression requires at least 2 simulation drill runs/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View All Recorded Drills/i })).toBeInTheDocument();
    });
  });

  it('triggers on-demand simulation drill when "Run Simulation Drill" is clicked', async () => {
    vi.spyOn(telemetryApi, 'fetchTelemetry').mockResolvedValue(mockTelemetryData);
    const drillSpy = vi.spyOn(telemetryApi, 'triggerTelemetryDrill').mockResolvedValue({
      id: 99,
      run_id: 'RUN-TEST-99',
      scenario_id: 'TELEMETRY-VERIFICATION-DRILL',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      initial_state: {},
      final_state: {},
      result: 'SUCCESS',
      recovery_duration: 0.045,
      packet_statistics: {},
      created_at: new Date().toISOString(),
    });

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Network Telemetry & Historical Trends')).toBeInTheDocument();
      expect(screen.getByText('99.2%')).toBeInTheDocument();
    });

    const runDrillBtn = screen.getByRole('button', { name: /Run Simulation Drill/i });
    expect(runDrillBtn).not.toBeDisabled();
    fireEvent.click(runDrillBtn);

    await waitFor(() => {
      expect(drillSpy).toHaveBeenCalledWith('TELEMETRY-VERIFICATION-DRILL');
    });
  });

  it('handles API error state gracefully with retry capability', async () => {
    const fetchSpy = vi.spyOn(telemetryApi, 'fetchTelemetry')
      .mockRejectedValueOnce(new Error('Backend connection refused'))
      .mockResolvedValueOnce(mockTelemetryData);

    render(
      <MemoryRouter>
        <TelemetryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Backend connection refused')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText('99.2%')).toBeInTheDocument();
    });
  });
});

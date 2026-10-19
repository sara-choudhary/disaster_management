import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from '../pages/ReportsPage';
import * as reportsApi from '../api/reports';
import {
  SummaryReportResponse,
  SimulationHistoryPaginationResponse,
  SimulationRunReportResponse,
} from '../api/reports';

const mockSummaryData: SummaryReportResponse = {
  timestamp: '2026-10-20T02:00:00Z',
  total_nodes: 21,
  active_nodes: 21,
  offline_nodes: 0,
  total_links: 25,
  up_links: 24,
  down_links: 1,
  network_health_score: 97.8,
  total_simulation_runs: 8,
  successful_simulations: 7,
  failed_simulations: 1,
  simulation_success_rate: 87.5,
  average_recovery_duration_sec: 0.052,
  active_alerts: 1,
  events_by_severity: { INFO: 20, WARNING: 3, CRITICAL: 1 },
  concise_summary: {
    network_availability_pct: 97.8,
    failed_resources: ['LINK-R1-R2'],
    failed_resources_count: 1,
    alternate_route_selected_count: 3,
    total_drills_count: 8,
    recovery_result: {
      status: 'DEGRADED',
      successful_drills: 7,
      failed_drills: 1,
      success_rate_pct: 87.5,
      avg_recovery_seconds: 0.052,
      summary: '7 of 8 simulation drills recovered autonomously via Dijkstra SPF.',
    },
    packet_delivery_statistics: {
      total_packets_sent: 500,
      total_packets_delivered: 492,
      total_packets_lost: 8,
      aggregate_delivery_ratio_pct: 98.4,
    },
    security_events_count: 2,
    recent_security_events: [
      {
        event_id: 'EV-SEC-01',
        timestamp: '2026-10-20T01:50:00Z',
        message: 'Port security violation: unauthorized MAC address detected.',
        affected_resource: 'SWITCH-ECC',
        severity: 'WARNING',
      },
    ],
    qos_observations: {
      scheduler_policy: 'Strict Priority with Starvation Safeguards',
      congestion_incidents: 1,
      traffic_classes: 4,
      summary: '1 bottleneck saturation event observed; priority scheduler preserved critical streams.',
    },
  },
  network_availability_pct: 97.8,
  failed_resources: ['LINK-R1-R2'],
  alternate_route_selected_count: 3,
  recovery_result: {},
  packet_delivery_statistics: {},
  security_events_count: 2,
  qos_observations: {},
};

const mockHistoryData: SimulationHistoryPaginationResponse = {
  total_count: 2,
  page: 1,
  page_size: 10,
  total_pages: 1,
  items: [
    {
      run_id: 'RUN-BASE-01',
      scenario_id: 'DRILL-LINK-FAIL',
      scenario_name: 'Primary Link Failure Drill',
      start_time: '2026-10-20T01:00:00Z',
      completion_time: '2026-10-20T01:00:01Z',
      final_outcome: 'SUCCESS',
      recovery_duration_sec: 0.045,
      packets_sent: 100,
      packets_delivered: 98,
      packets_lost: 2,
      delivery_ratio_pct: 98.0,
      alternate_route_selected: true,
      source: 'HQ-COMMAND-01',
      destination: 'HOSPITAL-TRIAGE-03',
    },
    {
      run_id: 'RUN-BASE-02',
      scenario_id: 'DRILL-CORE-OUTAGE',
      scenario_name: 'Main Router Outage Drill',
      start_time: '2026-10-20T00:30:00Z',
      completion_time: '2026-10-20T00:30:02Z',
      final_outcome: 'FAILED',
      recovery_duration_sec: 0.12,
      packets_sent: 100,
      packets_delivered: 20,
      packets_lost: 80,
      delivery_ratio_pct: 20.0,
      alternate_route_selected: false,
      source: 'HQ-COMMAND-01',
      destination: 'RELIEF-CAMP-06',
    },
  ],
};

const mockDrillReport: SimulationRunReportResponse = {
  run_id: 'RUN-BASE-01',
  scenario_id: 'DRILL-LINK-FAIL',
  scenario_name: 'Primary Link Failure Drill',
  status: 'SUCCESS',
  start_time: '2026-10-20T01:00:00Z',
  end_time: '2026-10-20T01:00:01Z',
  duration_seconds: 0.045,
  packet_statistics: {
    packets_sent: 100,
    packets_delivered: 98,
    packets_lost: 2,
    avg_latency_ms: 14.2,
    delivery_rate_pct: 98.0,
  },
  route_taken: ['HQ-COMMAND-01', 'SWITCH-EAST', 'HOSPITAL-TRIAGE-03'],
  alternate_route_selected: true,
  events_triggered: [
    {
      event_id: 'EVT-01',
      timestamp: '2026-10-20T01:00:00Z',
      event_type: 'LINK_FAILURE',
      severity: 'WARNING',
      message: 'Fiber severed between R1 and R2.',
      affected_resource: 'LINK-R1-R2',
    },
    {
      event_id: 'EVT-02',
      timestamp: '2026-10-20T01:00:00.045Z',
      event_type: 'ROUTE_CHANGE',
      severity: 'INFO',
      message: 'SPF recalculated alternate detour via SWITCH-EAST.',
      affected_resource: 'ROUTER-R1',
    },
  ],
  alerts_triggered: [
    {
      alert_id: 'ALT-01',
      timestamp: '2026-10-20T01:00:00Z',
      severity: 'WARNING',
      category: 'LINK',
      title: 'Link Degradation Alert',
      description: 'Backbone link offline; traffic redirected.',
      status: 'RESOLVED',
      affected_resource: 'LINK-R1-R2',
    },
  ],
  initial_topology: {
    source: 'HQ-COMMAND-01',
    target: 'HOSPITAL-TRIAGE-03',
    failed_nodes: ['ROUTER-R2'],
  },
  final_topology: {
    alternate_path_selected: true,
    path: ['HQ-COMMAND-01', 'SWITCH-EAST', 'HOSPITAL-TRIAGE-03'],
  },
  route_changes: ['Dijkstra SPF recalculation selected alternate route via SWITCH-EAST.'],
  resilience_score: 95.0,
  assessment: 'Autonomous priority routing established an alternate resilient route via 2 hops.',
  qos_observations: 'Observed end-to-end hop latency of 14.2ms with 98.0% packet delivery ratio.',
};

describe('ReportsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reportsApi, 'fetchSummaryReport').mockResolvedValue(mockSummaryData);
    vi.spyOn(reportsApi, 'fetchSimulationHistory').mockResolvedValue(mockHistoryData);
    vi.spyOn(reportsApi, 'fetchSimulationReport').mockResolvedValue(mockDrillReport);
    vi.spyOn(reportsApi, 'downloadHistoryCsv').mockResolvedValue(undefined);
    vi.spyOn(reportsApi, 'downloadSimulationJson').mockResolvedValue(undefined);
  });

  it('renders page header and export action buttons', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Operational Reports & Simulation History/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export History \(CSV\)/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(reportsApi.fetchSummaryReport).toHaveBeenCalledTimes(1);
      expect(reportsApi.fetchSimulationHistory).toHaveBeenCalledTimes(1);
    });
  });

  it('renders all 7 Concise Summary domains with real backend values', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 1. Network Availability
      expect(screen.getByText('1. Network Availability')).toBeInTheDocument();
      expect(screen.getByText('97.8%')).toBeInTheDocument();

      // 2. Failed Resources
      expect(screen.getByText('2. Failed Resources')).toBeInTheDocument();
      expect(screen.getByText('1 Failed')).toBeInTheDocument();
      expect(screen.getByText('LINK-R1-R2')).toBeInTheDocument();

      // 3. Alternate Routes Selected
      expect(screen.getByText('3. Alternate Routes Selected')).toBeInTheDocument();
      expect(screen.getByText('3 Drills')).toBeInTheDocument();

      // 4. Recovery Result
      expect(screen.getByText('4. Recovery Result')).toBeInTheDocument();
      expect(screen.getByText('87.5% Success')).toBeInTheDocument();

      // 5. Packet Delivery
      expect(screen.getByText('5. Packet Delivery')).toBeInTheDocument();
      expect(screen.getByText('98.4%')).toBeInTheDocument();

      // 6. Security Events
      expect(screen.getByText('6. Security Events')).toBeInTheDocument();
      expect(screen.getByText('2 Events')).toBeInTheDocument();

      // 7. QoS Observations
      expect(screen.getByText('7. QoS Observations')).toBeInTheDocument();
      expect(screen.getByText('Strict Priority with Starvation Safeguards')).toBeInTheDocument();
    });
  });

  it('renders "Unavailable" honestly when metrics are missing (no fabrication)', async () => {
    const incompleteSummary: SummaryReportResponse = {
      ...mockSummaryData,
      concise_summary: {
        network_availability_pct: null,
        failed_resources: [],
        failed_resources_count: 0,
        alternate_route_selected_count: 0,
        total_drills_count: 0,
        recovery_result: {},
        packet_delivery_statistics: {},
        security_events_count: 0,
        recent_security_events: [],
        qos_observations: {},
      },
    };
    vi.spyOn(reportsApi, 'fetchSummaryReport').mockResolvedValue(incompleteSummary);

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Missing network availability and packet statistics should show "Unavailable"
      const unavailables = screen.getAllByText('Unavailable');
      expect(unavailables.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders the searchable, paginated history table with correct drill rows', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RUN-BASE-01')).toBeInTheDocument();
      expect(screen.getByText('Primary Link Failure Drill')).toBeInTheDocument();
      expect(screen.getByText('RUN-BASE-02')).toBeInTheDocument();
      expect(screen.getByText('Main Router Outage Drill')).toBeInTheDocument();

      // Check rerouted badge
      expect(screen.getByText('Rerouted')).toBeInTheDocument();

      // Outcomes
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILED')).toBeInTheDocument();

      // Delivery ratios
      expect(screen.getByText('98.0%')).toBeInTheDocument();
      expect(screen.getByText('20.0%')).toBeInTheDocument();
    });
  });

  it('handles search and outcome status filters', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search Run ID or Scenario/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search Run ID or Scenario/i);
    fireEvent.change(searchInput, { target: { value: 'LINK-FAIL' } });

    await waitFor(() => {
      expect(reportsApi.fetchSimulationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'LINK-FAIL' })
      );
    });

    // Test status filter dropdown
    const statusSelect = screen.getByDisplayValue('All Outcomes');
    fireEvent.change(statusSelect, { target: { value: 'SUCCESS' } });

    await waitFor(() => {
      expect(reportsApi.fetchSimulationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' })
      );
    });
  });

  it('opens drill inspector modal with complete engineering audit and allows JSON export', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RUN-BASE-01')).toBeInTheDocument();
    });

    // Click "Inspect Drill" on RUN-BASE-01
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Drill/i });
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(reportsApi.fetchSimulationReport).toHaveBeenCalledWith('RUN-BASE-01');
      expect(screen.getByText(/Network Resilience Score/i)).toBeInTheDocument();
      expect(screen.getByText('95 / 100')).toBeInTheDocument();
      expect(screen.getByText(/Autonomous priority routing established an alternate resilient route/i)).toBeInTheDocument();
      expect(screen.getByText(/Fiber severed between R1 and R2/i)).toBeInTheDocument();
      expect(screen.getByText(/Link Degradation Alert/i)).toBeInTheDocument();
    });

    // Test JSON export button in modal
    const exportJsonBtn = screen.getByRole('button', { name: /Export JSON/i });
    fireEvent.click(exportJsonBtn);

    await waitFor(() => {
      expect(reportsApi.downloadSimulationJson).toHaveBeenCalledWith('RUN-BASE-01');
    });

    // Close modal
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);
  });

  it('triggers CSV history export on button click', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export History \(CSV\)/i })).toBeInTheDocument();
    });

    const exportCsvBtn = screen.getByRole('button', { name: /Export History \(CSV\)/i });
    fireEvent.click(exportCsvBtn);

    await waitFor(() => {
      expect(reportsApi.downloadHistoryCsv).toHaveBeenCalledTimes(1);
    });
  });
});

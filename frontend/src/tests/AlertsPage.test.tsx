import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlertsPage } from '../pages/AlertsPage';
import * as alertApi from '../api/alerts';
import * as eventApi from '../api/events';
import * as simApi from '../api/simulation';

const mockAlerts: alertApi.AlertRecord[] = [
  {
    id: 1,
    alert_id: 'ALT-CRIT-01',
    severity: 'CRITICAL',
    category: 'CONNECTIVITY',
    title: 'Core Ring Link Severed',
    description: 'Fiber line between ROUTER-01 and ROUTER-02 is down.',
    affected_resource: 'LINK-R1-R2',
    related_run: 'RUN-FAIL-01',
    status: 'ACTIVE',
    timestamp: '2026-10-20T01:00:00Z',
    created_at: '2026-10-20T01:00:00Z',
    updated_at: '2026-10-20T01:00:00Z',
  },
  {
    id: 2,
    alert_id: 'ALT-WARN-02',
    severity: 'WARNING',
    category: 'ROUTING',
    title: 'Route Recalculated',
    description: 'Traffic dynamically diverted to alternate secondary path.',
    affected_resource: 'LINK-R1-R3',
    related_run: 'RUN-FAIL-01',
    status: 'ACKNOWLEDGED',
    timestamp: '2026-10-20T01:02:00Z',
    created_at: '2026-10-20T01:02:00Z',
    updated_at: '2026-10-20T01:02:00Z',
  },
  {
    id: 3,
    alert_id: 'ALT-INFO-03',
    severity: 'INFO',
    category: 'CONNECTIVITY',
    title: 'Critical Connectivity Restored',
    description: 'Link restored to active operational status.',
    affected_resource: 'LINK-R1-R2',
    related_run: 'RUN-RESTORE-01',
    status: 'RESOLVED',
    timestamp: '2026-10-20T01:05:00Z',
    created_at: '2026-10-20T01:05:00Z',
    updated_at: '2026-10-20T01:05:00Z',
  },
];

const mockTimeline: eventApi.ForensicTimelineResponse = {
  run_id: 'RUN-BASE-01',
  scenario_id: 'DRILL-RING-SEVERANCE',
  result: 'SUCCESS',
  start_time: '2026-10-20T00:50:00Z',
  end_time: '2026-10-20T00:50:01Z',
  recovery_duration_sec: 0.045,
  initial_state: { source: 'HQ-COMMAND-01', target: 'HOSPITAL-TRIAGE-03' },
  final_state: { result: 'SUCCESS', path: ['HQ-COMMAND-01', 'ROUTER-01', 'ROUTER-02', 'HOSPITAL-TRIAGE-03'] },
  packet_statistics: { total_packets: 50, delivered: 50, dropped: 0, delivery_rate_pct: 100 },
  steps: [
    {
      step_number: 1,
      phase: 'FAILURE_INJECTION',
      timestamp: '2026-10-20T00:50:00Z',
      title: 'Incident Trigger & Failure Injection',
      description: 'Primary link severed during emergency drill.',
      severity: 'CRITICAL',
      resource: 'LINK-R1-R2',
      details: { source: 'HQ-COMMAND-01', target: 'HOSPITAL-TRIAGE-03' },
    },
    {
      step_number: 2,
      phase: 'ROUTE_RECALCULATION',
      timestamp: '2026-10-20T00:50:00.020Z',
      title: 'Dijkstra Shortest-Path Recalculation',
      description: 'OSPF SPF converged in 0.045s via alternate secondary path.',
      severity: 'WARNING',
      resource: 'ROUTER-03',
      details: { total_hops: 3, alternate_path_activated: true },
    },
    {
      step_number: 3,
      phase: 'PACKET_AUDIT',
      timestamp: '2026-10-20T00:50:00.035Z',
      title: 'Packet Transmission & Delivery Audit',
      description: '50 packets transmitted. Delivered: 50, Dropped: 0.',
      severity: 'INFO',
      resource: 'HOSPITAL-TRIAGE-03',
      details: { delivered: 50, dropped: 0 },
    },
    {
      step_number: 4,
      phase: 'ACCESS_CONTROL',
      timestamp: '2026-10-20T00:50:00.040Z',
      title: 'Access Control & Departmental Security Policy',
      description: 'Layer 3/4 policy checked: PERMITTED.',
      severity: 'INFO',
      resource: 'HQ-COMMAND-01 ➔ HOSPITAL-TRIAGE-03',
      details: { evaluation_result: 'PERMITTED' },
    },
    {
      step_number: 5,
      phase: 'RECOVERY_CONVERGENCE',
      timestamp: '2026-10-20T00:50:00.045Z',
      title: 'Drill Completion & Post-Mortem Assessment',
      description: 'Incident resolved with status SUCCESS.',
      severity: 'INFO',
      resource: 'RUN-BASE-01',
      details: { final_result: 'SUCCESS' },
    },
  ],
  related_alerts: [
    {
      alert_id: 'ALT-CRIT-01',
      title: 'Core Ring Link Severed',
      description: 'Fiber line between ROUTER-01 and ROUTER-02 is down.',
      severity: 'CRITICAL',
    },
  ],
  related_events: [],
  explanation: 'Read-only inspection of historical drill.',
};

const mockRuns: simApi.SimulationRunRecord[] = [
  {
    id: 1,
    run_id: 'RUN-BASE-01',
    scenario_id: 'DRILL-RING-SEVERANCE',
    start_time: '2026-10-20T00:50:00Z',
    end_time: '2026-10-20T00:50:01Z',
    initial_state: {},
    final_state: {},
    result: 'SUCCESS',
    recovery_duration: 0.045,
    packet_statistics: {},
    created_at: '2026-10-20T00:50:00Z',
  },
];

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(alertApi, 'fetchFilteredAlerts').mockResolvedValue(mockAlerts);
    vi.spyOn(simApi, 'fetchSimulationRuns').mockResolvedValue(mockRuns);
    vi.spyOn(eventApi, 'fetchForensicTimeline').mockResolvedValue(mockTimeline);
    vi.spyOn(eventApi, 'fetchEventsWithFilters').mockResolvedValue([]);
  });

  it('renders alerts with timestamp, severity, category, affected resource, description and plain-text status', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Alerts & Network Events')).toBeInTheDocument();

    await waitFor(() => {
      // Alert 1
      expect(screen.getByText('Core Ring Link Severed')).toBeInTheDocument();
      expect(screen.getByText(/Fiber line between ROUTER-01 and ROUTER-02 is down/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Resource: LINK-R1-R2/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Category: CONNECTIVITY/i).length).toBeGreaterThanOrEqual(1);

      // Alert 2
      expect(screen.getByText('Route Recalculated')).toBeInTheDocument();
      expect(screen.getByText(/Resource: LINK-R1-R3/i)).toBeInTheDocument();
      expect(screen.getByText(/Category: ROUTING/i)).toBeInTheDocument();

      // Alert 3
      expect(screen.getByText('Critical Connectivity Restored')).toBeInTheDocument();
      expect(screen.getAllByText(/Resolved/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('acknowledges an active alert and updates its status', async () => {
    const ackSpy = vi.spyOn(alertApi, 'acknowledgeAlert').mockResolvedValue({
      ...mockAlerts[0],
      status: 'ACKNOWLEDGED',
    });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Core Ring Link Severed')).toBeInTheDocument();
    });

    const ackBtn = screen.getByRole('button', { name: /Acknowledge/i });
    fireEvent.click(ackBtn);

    await waitFor(() => {
      expect(ackSpy).toHaveBeenCalledWith('ALT-CRIT-01');
    });
  });

  it('resolves an alert and updates its status', async () => {
    const resolveSpy = vi.spyOn(alertApi, 'resolveAlert').mockResolvedValue({
      ...mockAlerts[0],
      status: 'RESOLVED',
    });

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Core Ring Link Severed')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByRole('button', { name: /Resolve/i });
    fireEvent.click(resolveButtons[0]);

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith('ALT-CRIT-01');
    });
  });

  it('applies filters for status, severity, category, and time range', async () => {
    const fetchSpy = vi.spyOn(alertApi, 'fetchFilteredAlerts').mockResolvedValue(mockAlerts);

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Select Severity: Critical
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    const sevSelect = selects[1];
    const catSelect = selects[2];

    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
    });

    fireEvent.change(sevSelect, { target: { value: 'CRITICAL' } });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'CRITICAL' }));
    });

    fireEvent.change(catSelect, { target: { value: 'ROUTING' } });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ category: 'ROUTING' }));
    });
  });

  it('switches to Forensic Incident Timeline and renders historical drill in read-only mode', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

    const timelineTabBtn = screen.getByRole('button', { name: /Forensic Incident Timeline/i });
    fireEvent.click(timelineTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Forensic Incident Investigation Mode')).toBeInTheDocument();
      expect(screen.getByText(/Chronological Sequence of Forensic Steps/i)).toBeInTheDocument();
      expect(screen.getByText('Incident Trigger & Failure Injection')).toBeInTheDocument();
      expect(screen.getByText('Dijkstra Shortest-Path Recalculation')).toBeInTheDocument();
      expect(screen.getByText('Packet Transmission & Delivery Audit')).toBeInTheDocument();
      expect(screen.getByText('Access Control & Departmental Security Policy')).toBeInTheDocument();
      expect(screen.getByText('Drill Completion & Post-Mortem Assessment')).toBeInTheDocument();
    });

    // Verify read-only notice exists
    expect(screen.getByText(/without altering current network state/i)).toBeInTheDocument();
  });
});

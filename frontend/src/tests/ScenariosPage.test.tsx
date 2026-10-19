import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ScenariosPage } from '../pages/ScenariosPage';
import * as scenariosApi from '../api/scenarios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ScenariosPage - Disaster Drills & Failure Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockScenarios: scenariosApi.ScenarioItem[] = [
    {
      id: 1,
      scenario_id: 'SCEN-QUAKE-01',
      name: 'Earthquake Fault Severance',
      description: 'Seismic event isolates the southern valley corridor, severing primary relay lines.',
      scenario_type: 'earthquake',
      configuration: {
        disabled_nodes: ['RELAY-VALLEY-04'],
        link_penalties: { 'LINK-FIRE-RELIEF': 3.0 },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      scenario_id: 'SCEN-FLOOD-02',
      name: 'Coastal Inundation Surge',
      description: 'Flash flooding knocks out northern high-ground microwave relay.',
      scenario_type: 'flood',
      configuration: {
        disabled_nodes: ['RELAY-NORTH-02'],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      scenario_id: 'SCEN-TRIAGE-03',
      name: 'Mass Casualty Emergency',
      description: 'Hospital triage overload triggers highest-priority life-safety telemetry burst.',
      scenario_type: 'casualty_surge',
      configuration: {
        traffic_multiplier: 3.0,
        preempt_non_critical: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it('renders the scenario drill list from backend data', async () => {
    vi.spyOn(scenariosApi, 'fetchScenarios').mockResolvedValue(mockScenarios);

    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Disaster Scenarios & Emergency Drills/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Earthquake Fault Severance')).toBeInTheDocument();
      expect(screen.getByText('Coastal Inundation Surge')).toBeInTheDocument();
      expect(screen.getByText('Mass Casualty Emergency')).toBeInTheDocument();
    });

    // Check simulated outages list rendered
    expect(screen.getByText('RELAY-VALLEY-04')).toBeInTheDocument();
    expect(screen.getByText('RELAY-NORTH-02')).toBeInTheDocument();
  });

  it('navigates to simulation runner with preset parameters when Launch button is clicked', async () => {
    vi.spyOn(scenariosApi, 'fetchScenarios').mockResolvedValue(mockScenarios);

    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Earthquake Fault Severance')).toBeInTheDocument();
    });

    const launchButtons = screen.getAllByRole('button', { name: /launch in priority router/i });
    expect(launchButtons.length).toBe(3);

    fireEvent.click(launchButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/simulation', {
      state: {
        presetId: 'SCEN-QUAKE-01',
        suggestedPriority: 'HIGH_MEDICAL',
        failedNodes: ['RELAY-VALLEY-04'],
      },
    });
  });

  it('navigates with CRITICAL_SOS priority when preempt_non_critical is true', async () => {
    vi.spyOn(scenariosApi, 'fetchScenarios').mockResolvedValue(mockScenarios);

    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mass Casualty Emergency')).toBeInTheDocument();
    });

    const launchButtons = screen.getAllByRole('button', { name: /launch in priority router/i });
    fireEvent.click(launchButtons[2]);

    expect(mockNavigate).toHaveBeenCalledWith('/simulation', {
      state: {
        presetId: 'SCEN-TRIAGE-03',
        suggestedPriority: 'CRITICAL_SOS',
        failedNodes: [],
      },
    });
  });

  it('refreshes scenarios when reload button is clicked', async () => {
    const fetchSpy = vi.spyOn(scenariosApi, 'fetchScenarios').mockResolvedValue(mockScenarios);

    render(
      <BrowserRouter>
        <ScenariosPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Earthquake Fault Severance')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle(/refresh scenarios/i);
    fireEvent.click(refreshBtn);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

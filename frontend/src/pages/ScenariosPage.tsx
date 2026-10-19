import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, Waves, Zap, Shield, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchScenarios, ScenarioItem } from '../api/scenarios';

export const ScenariosPage: React.FC = () => {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchScenarios();
      setScenarios(data);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunPreset = (scenario: ScenarioItem) => {
    const disabledNodes = scenario.configuration?.disabled_nodes || [];
    navigate('/simulation', {
      state: {
        presetId: scenario.scenario_id,
        suggestedPriority: scenario.configuration?.preempt_non_critical ? 'CRITICAL_SOS' : 'HIGH_MEDICAL',
        failedNodes: disabledNodes,
      },
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'earthquake':
        return Zap;
      case 'flood':
        return Waves;
      default:
        return Shield;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <Sliders className="w-5 h-5" />
            </div>
            Disaster Scenarios & Emergency Drills
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Simulate pre-configured catastrophic failure modes to stress-test mesh routing determinism.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text shadow-coastal-sm transition-all self-start sm:self-auto"
          title="Refresh Scenarios"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((scenario) => {
          const Icon = getIcon(scenario.scenario_type);
          const disabledNodes = scenario.configuration?.disabled_nodes || [];

          return (
            <div
              key={scenario.scenario_id}
              className="bg-coastal-cream border border-coastal-border rounded-2xl p-6 shadow-coastal-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 bg-coastal-powder text-coastal-cerulean rounded-xl">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-coastal-warning/20 text-coastal-warning-text border-coastal-warning/40 uppercase">
                    {scenario.scenario_type}
                  </span>
                </div>
                <h2 className="text-base font-bold text-coastal-text mb-2">{scenario.name}</h2>
                <p className="text-xs text-coastal-text-muted leading-relaxed mb-4">
                  {scenario.description}
                </p>

                {disabledNodes.length > 0 && (
                  <div className="mb-4 pt-3 border-t border-coastal-border text-[11px] text-coastal-text-muted">
                    <span className="font-semibold block mb-1">Simulated Outages:</span>
                    <div className="flex flex-wrap gap-1 font-mono">
                      {disabledNodes.map((node: string) => (
                        <span
                          key={node}
                          className="px-2 py-0.5 rounded bg-coastal-critical/15 text-coastal-critical-text border border-coastal-critical/30"
                        >
                          {node}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRunPreset(scenario)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white text-xs font-semibold rounded-md shadow-coastal-sm transition-all focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                <span>Launch in Priority Router</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

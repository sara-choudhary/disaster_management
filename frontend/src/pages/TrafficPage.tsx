import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Gauge,
  Sliders,
  Layers,
  Info,
} from 'lucide-react';
import {
  QoSSimulationRequest,
  QoSSimulationResponse,
  TrafficClass,
} from '../types';
import {
  simulateTrafficQoS,
  fetchTrafficClasses,
  fetchDepartments,
  DepartmentItem,
} from '../api/traffic';
import { coastalColors } from '../theme/tokens';

export const TrafficPage: React.FC = () => {
  // Department options
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [trafficClasses, setTrafficClasses] = useState<TrafficClass[]>([]);

  // Simulation Controls
  const [sourceDept, setSourceDept] = useState<string>('Emergency Control Center');
  const [destDept, setDestDept] = useState<string>('Hospital');
  const [selectedClass, setSelectedClass] = useState<string>('CRITICAL');
  const [packetCount, setPacketCount] = useState<number>(100);
  const [offeredLoadMbps, setOfferedLoadMbps] = useState<number>(50.0);
  const [durationSec, setDurationSec] = useState<number>(10.0);
  const [competingTraffic, setCompetingTraffic] = useState<boolean>(true);

  // Results & UI state
  const [result, setResult] = useState<QoSSimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial departments & classes
  useEffect(() => {
    async function loadInitialData() {
      try {
        setPageLoading(true);
        const [deptList, classList] = await Promise.all([
          fetchDepartments().catch(() => []),
          fetchTrafficClasses().catch(() => []),
        ]);

        if (deptList && deptList.length > 0) {
          setDepartments(deptList);
          setSourceDept(deptList[0].name);
          if (deptList.length > 3) {
            setDestDept(deptList[3].name);
          } else {
            setDestDept(deptList[deptList.length - 1].name);
          }
        } else {
          // Fallback departmental list
          const fallbackDepts: DepartmentItem[] = [
            { id: 1, code: 'ECC', name: 'Emergency Control Center', department_type: 'command', subnet: '192.168.10.0/24', priority: 1 },
            { id: 2, code: 'POLICE', name: 'Police Station', department_type: 'public_safety', subnet: '192.168.20.0/24', priority: 2 },
            { id: 3, code: 'FIRE', name: 'Fire Department', department_type: 'public_safety', subnet: '192.168.30.0/24', priority: 2 },
            { id: 4, code: 'HOSPITAL', name: 'Hospital', department_type: 'medical', subnet: '192.168.40.0/24', priority: 1 },
            { id: 5, code: 'AMBULANCE', name: 'Ambulance Services', department_type: 'medical', subnet: '192.168.50.0/24', priority: 1 },
            { id: 6, code: 'RELIEF', name: 'Relief Camp', department_type: 'humanitarian', subnet: '192.168.60.0/24', priority: 3 },
            { id: 7, code: 'BACKUP_CC', name: 'Backup Control Center', department_type: 'command', subnet: '192.168.70.0/24', priority: 1 },
          ];
          setDepartments(fallbackDepts);
        }

        if (classList && classList.length > 0) {
          setTrafficClasses(classList);
        }
      } catch (err) {
        console.warn('Initial data load warning:', err);
      } finally {
        setPageLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Execute QoS simulation
  const handleRunSimulation = useCallback(
    async (overrideOffered?: number, overrideClass?: string) => {
      try {
        setLoading(true);
        setError(null);

        const payload: QoSSimulationRequest = {
          source_department: sourceDept,
          destination_department: destDept,
          traffic_class: overrideClass || selectedClass,
          packet_count: packetCount,
          offered_load_mbps: overrideOffered !== undefined ? overrideOffered : offeredLoadMbps,
          test_duration_sec: durationSec,
          competing_traffic: competingTraffic,
        };

        const response = await simulateTrafficQoS(payload);
        setResult(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'QoS simulation failed');
      } finally {
        setLoading(false);
      }
    },
    [sourceDept, destDept, selectedClass, packetCount, offeredLoadMbps, durationSec, competingTraffic],
  );

  // Auto-run once initial departments are ready
  useEffect(() => {
    if (!pageLoading && !result) {
      handleRunSimulation();
    }
  }, [pageLoading, result, handleRunSimulation]);

  return (
    <div className="space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <Gauge className="w-5 h-5" />
            </div>
            Traffic-Priority & Quality of Service (QoS) Simulation
          </h1>
          <p className="text-xs sm:text-sm text-coastal-text-muted mt-1">
            Simulate link bandwidth constraints, strict priority queue scheduling, and cross-traffic preemption.
          </p>
        </div>

        <button
          onClick={() => handleRunSimulation()}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Simulation</span>
        </button>
      </div>

      {/* Simulated Estimate Disclaimer Alert */}
      <div className="p-3.5 bg-coastal-powder/60 border border-coastal-border rounded-xl text-xs flex items-start gap-2.5 shadow-coastal-sm">
        <Info className="w-4 h-4 text-coastal-cerulean shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-coastal-text uppercase text-[10px] tracking-wide block">
            Simulated Estimates
          </span>
          <p className="text-coastal-text-muted text-[11px] leading-relaxed">
            All queuing, transmission latency, queue delays, and delivery ratios are calculated by the deterministic
            backend QoS queuing model. These metrics reflect modeled packet transit in emergency network conditions.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical/40 rounded-xl text-coastal-critical-text text-xs flex items-center gap-2.5 shadow-coastal-sm">
          <AlertTriangle className="w-4 h-4 text-coastal-critical shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------- Simulation Controls Form (Rectangular, Clean) ---------------- */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
        <div className="flex items-center justify-between border-b border-coastal-border pb-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text flex items-center gap-2">
            <Sliders className="w-4 h-4 text-coastal-cerulean" /> Simulation Parameters
          </h2>
          <span className="text-[11px] text-coastal-text-muted">Configurable Traffic Parameters</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunSimulation();
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Control 1: Source Department */}
            <div>
              <label className="block text-[11px] font-bold text-coastal-text-muted uppercase mb-1">
                Source Department
              </label>
              <select
                value={sourceDept}
                onChange={(e) => setSourceDept(e.target.value)}
                className="w-full px-3 py-2 bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.subnet})
                  </option>
                ))}
              </select>
            </div>

            {/* Control 2: Destination Department */}
            <div>
              <label className="block text-[11px] font-bold text-coastal-text-muted uppercase mb-1">
                Destination Department
              </label>
              <select
                value={destDept}
                onChange={(e) => setDestDept(e.target.value)}
                className="w-full px-3 py-2 bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                {departments.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.subnet})
                  </option>
                ))}
              </select>
            </div>

            {/* Control 3: Traffic Class */}
            <div>
              <label className="block text-[11px] font-bold text-coastal-text-muted uppercase mb-1">
                Traffic Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                {trafficClasses.length > 0 ? (
                  trafficClasses
                    .filter((tc) => ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'].includes(tc.code))
                    .map((tc) => (
                      <option key={tc.code} value={tc.code}>
                        {tc.name}
                      </option>
                    ))
                ) : (
                  <>
                    <option value="CRITICAL">Critical: Ambulance Dispatch & Hospital</option>
                    <option value="HIGH">High: Police & Fire Communication</option>
                    <option value="NORMAL">Normal: Ordinary Departmental Traffic</option>
                    <option value="LOW">Low: Administrative or Background Traffic</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Control 4: Packet Count */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-coastal-text-muted uppercase">
                  Packet Count
                </label>
                <span className="font-mono text-xs font-bold text-coastal-text">{packetCount} pkts</span>
              </div>
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={packetCount}
                onChange={(e) => setPacketCount(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-full px-3 py-2 bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-xs font-mono font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              />
            </div>

            {/* Control 5: Offered Traffic Load */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-coastal-text-muted uppercase">
                  Offered Traffic Load
                </label>
                <span className="font-mono text-xs font-bold text-coastal-cerulean">
                  {offeredLoadMbps} Mbps
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={5}
                  max={160}
                  step={5}
                  value={offeredLoadMbps}
                  onChange={(e) => setOfferedLoadMbps(parseFloat(e.target.value))}
                  className="w-full accent-coastal-cerulean"
                />
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={offeredLoadMbps}
                  onChange={(e) => setOfferedLoadMbps(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-16 px-2 py-1 bg-coastal-cream-dark/60 border border-coastal-border rounded-lg text-xs font-mono font-semibold text-coastal-text text-right"
                />
              </div>
            </div>

            {/* Control 6: Test Duration / Simulation Interval */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-coastal-text-muted uppercase">
                  Test Duration / Interval
                </label>
                <span className="font-mono text-xs font-bold text-coastal-text">{durationSec}s</span>
              </div>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                <option value={5}>5 Seconds (Quick Burst)</option>
                <option value={10}>10 Seconds (Standard Drill)</option>
                <option value={30}>30 Seconds (Sustained Load)</option>
                <option value={60}>60 Seconds (Full Stress Interval)</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Buttons & Competing Traffic Toggle */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-coastal-border/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-coastal-text-muted uppercase">Quick Scenarios:</span>
              <button
                type="button"
                onClick={() => {
                  setOfferedLoadMbps(25.0);
                  setCompetingTraffic(false);
                  handleRunSimulation(25.0);
                }}
                className="px-2.5 py-1 bg-coastal-cream border border-coastal-border hover:bg-coastal-powder rounded-lg text-[11px] font-medium text-coastal-text transition-all"
              >
                Uncongested Flow (25 Mbps)
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfferedLoadMbps(60.0);
                  setCompetingTraffic(true);
                  handleRunSimulation(60.0);
                }}
                className="px-2.5 py-1 bg-coastal-cream border border-coastal-border hover:bg-coastal-powder rounded-lg text-[11px] font-medium text-coastal-text transition-all"
              >
                Moderate Cross-Traffic (60 Mbps)
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfferedLoadMbps(120.0);
                  setCompetingTraffic(true);
                  handleRunSimulation(120.0);
                }}
                className="px-2.5 py-1 bg-coastal-cream border border-coastal-border hover:bg-coastal-critical/15 rounded-lg text-[11px] font-medium text-coastal-critical-text transition-all"
              >
                Severe Link Congestion (120 Mbps)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-coastal-text">
                <input
                  type="checkbox"
                  checked={competingTraffic}
                  onChange={(e) => setCompetingTraffic(e.target.checked)}
                  className="rounded border-coastal-border text-coastal-cerulean focus:ring-coastal-cerulean"
                />
                <span>Include Competing Cross-Traffic</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-bold shadow-coastal-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Evaluating...' : 'Simulate QoS Dispatch'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ---------------- Core Metric Display Cards ---------------- */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Card 1: Packets Sent */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Packets Sent</span>
            <div className="mt-2 text-xl font-black font-mono text-coastal-text">{result.packets_sent}</div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5">Offered load</span>
          </div>

          {/* Card 2: Packets Delivered */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Packets Delivered</span>
            <div className="mt-2 text-xl font-black font-mono text-coastal-safe-text">{result.packets_delivered}</div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5">Successfully served</span>
          </div>

          {/* Card 3: Packets Lost */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Packets Lost</span>
            <div
              className={`mt-2 text-xl font-black font-mono ${
                result.packets_lost > 0 ? 'text-coastal-critical-text' : 'text-coastal-text'
              }`}
            >
              {result.packets_lost}
            </div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5">
              {result.packets_lost > 0 ? 'Tail dropped' : 'Zero drop'}
            </span>
          </div>

          {/* Card 4: Delivery Ratio */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Delivery Ratio</span>
            <div className="mt-2 text-xl font-black font-mono text-coastal-text">
              {result.delivery_ratio_pct}%
            </div>
            <div className="w-full bg-coastal-cream-dark rounded h-1 mt-1 border border-coastal-border overflow-hidden">
              <div
                className="h-1 rounded"
                style={{
                  width: `${result.delivery_ratio_pct}%`,
                  backgroundColor:
                    result.delivery_ratio_pct >= 95
                      ? coastalColors.safe
                      : result.delivery_ratio_pct >= 70
                      ? coastalColors.warning
                      : coastalColors.critical,
                }}
              />
            </div>
          </div>

          {/* Card 5: Estimated Latency */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Estimated Latency</span>
            <div className="mt-2 text-xl font-black font-mono text-coastal-cerulean">
              {result.estimated_latency_ms} ms
            </div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5">End-to-end</span>
          </div>

          {/* Card 6: Queue Delay */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Queue Delay</span>
            <div
              className={`mt-2 text-xl font-black font-mono ${
                result.queue_delay_ms > 15 ? 'text-coastal-warning-text' : 'text-coastal-text'
              }`}
            >
              {result.queue_delay_ms} ms
            </div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5">Buffer wait</span>
          </div>

          {/* Card 7: Link Utilization */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Link Utilization</span>
            <div
              className={`mt-2 text-xl font-black font-mono ${
                result.is_congested ? 'text-coastal-critical-text' : 'text-coastal-cerulean'
              }`}
            >
              {result.link_utilization_pct}%
            </div>
            <span className="text-[10px] text-coastal-text-muted mt-0.5 truncate" title={result.bottleneck_link_id}>
              {result.bottleneck_capacity_mbps} Mbps limit
            </span>
          </div>
        </div>
      )}

      {/* ---------------- Clean Progress Timeline Indicator ---------------- */}
      {result && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
          <span className="text-[10px] font-bold text-coastal-text-muted uppercase block mb-2.5">
            QoS Scheduling Pipeline & Path Execution
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {/* Step 1 */}
            <div className="p-3 bg-coastal-cream-dark/50 border border-coastal-border rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-coastal-text mb-1">
                <span className="w-5 h-5 rounded-md bg-coastal-powder text-coastal-cerulean flex items-center justify-center text-[10px] font-mono">1</span>
                <span>OSPF Route Path</span>
              </div>
              <div className="text-[11px] text-coastal-text-muted font-mono truncate" title={result.path.join(' ➔ ')}>
                {result.path.join(' ➔ ')}
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-coastal-cream-dark/50 border border-coastal-border rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-coastal-text mb-1">
                <span className="w-5 h-5 rounded-md bg-coastal-powder text-coastal-cerulean flex items-center justify-center text-[10px] font-mono">2</span>
                <span>Bottleneck Constraint</span>
              </div>
              <div className="text-[11px] text-coastal-text-muted font-mono">
                {result.bottleneck_link_id} ({result.bottleneck_capacity_mbps} Mbps)
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-coastal-cream-dark/50 border border-coastal-border rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-coastal-text mb-1">
                <span className="w-5 h-5 rounded-md bg-coastal-powder text-coastal-cerulean flex items-center justify-center text-[10px] font-mono">3</span>
                <span>Scheduling Policy</span>
              </div>
              <div className="text-[11px] text-coastal-text-muted">
                {result.scheduler_policy}
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-3 bg-coastal-cream-dark/50 border border-coastal-border rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-coastal-text mb-1">
                <span className="w-5 h-5 rounded-md bg-coastal-powder text-coastal-cerulean flex items-center justify-center text-[10px] font-mono">4</span>
                <span>Congestion State</span>
              </div>
              <div className="text-[11px]">
                {result.is_congested ? (
                  <span className="font-bold text-coastal-critical-text">
                    CONGESTED ({result.total_offered_load_mbps} Mbps offered)
                  </span>
                ) : (
                  <span className="font-bold text-coastal-safe-text">
                    UNCONGESTED ({result.total_offered_load_mbps} Mbps offered)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Results by Priority Class Table ---------------- */}
      {result && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-coastal-border pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                <Layers className="w-4 h-4 text-coastal-cerulean" /> Results by Priority Class
              </h2>
              <p className="text-xs text-coastal-text-muted mt-0.5">
                Comparative performance demonstrating strict priority scheduling and starvation safeguard bandwidth allocation.
              </p>
            </div>
            <span className="text-[11px] font-mono text-coastal-text-muted">
              Capacity: {result.bottleneck_capacity_mbps} Mbps
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-coastal-border text-[10px] font-bold text-coastal-text-muted uppercase">
                  <th className="pb-2.5">Traffic Class & Scope</th>
                  <th className="pb-2.5">Priority</th>
                  <th className="pb-2.5 text-right">Offered Load</th>
                  <th className="pb-2.5 text-right">Allocated BW</th>
                  <th className="pb-2.5 text-right">Sent / Delivered</th>
                  <th className="pb-2.5 text-right">Packets Lost</th>
                  <th className="pb-2.5 text-right">Delivery Ratio</th>
                  <th className="pb-2.5 text-right">Queue Delay</th>
                  <th className="pb-2.5 text-right">Latency</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-coastal-border/60">
                {result.results_by_class.map((row) => {
                  const isSelected = row.traffic_class === result.selected_class;
                  return (
                    <tr
                      key={row.traffic_class}
                      className={`transition-colors ${
                        isSelected ? 'bg-coastal-powder/40 font-semibold' : 'hover:bg-coastal-powder/20'
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              row.traffic_class === 'CRITICAL'
                                ? 'bg-coastal-dusty-rose'
                                : row.traffic_class === 'HIGH'
                                ? 'bg-coastal-warning'
                                : row.traffic_class === 'NORMAL'
                                ? 'bg-coastal-cerulean'
                                : 'bg-coastal-text-muted'
                            }`}
                          />
                          <div>
                            <span className="font-bold text-coastal-text block">{row.traffic_class}</span>
                            <span className="text-[10px] text-coastal-text-muted block truncate max-w-[200px]">
                              {row.class_name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 font-mono font-bold text-coastal-text">P{row.priority}</td>

                      <td className="py-3 font-mono text-right text-coastal-text">{row.offered_mbps} Mbps</td>

                      <td className="py-3 font-mono font-bold text-right text-coastal-cerulean">
                        {row.allocated_mbps} Mbps
                      </td>

                      <td className="py-3 font-mono text-right text-coastal-text">
                        {row.packets_sent} / <span className="text-coastal-safe-text">{row.packets_delivered}</span>
                      </td>

                      <td
                        className={`py-3 font-mono text-right font-bold ${
                          row.packets_lost > 0 ? 'text-coastal-critical-text' : 'text-coastal-text-muted'
                        }`}
                      >
                        {row.packets_lost}
                      </td>

                      <td className="py-3 font-mono text-right font-bold text-coastal-text">
                        {row.delivery_ratio_pct}%
                      </td>

                      <td className="py-3 font-mono text-right text-coastal-text">{row.queue_delay_ms} ms</td>

                      <td className="py-3 font-mono text-right text-coastal-cerulean font-bold">
                        {row.estimated_latency_ms} ms
                      </td>

                      <td className="py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase inline-block border ${
                            row.delivery_ratio_pct >= 99.5
                              ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                              : row.delivery_ratio_pct >= 75
                              ? 'bg-coastal-warning/25 text-coastal-warning-text border-coastal-warning/40'
                              : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- Architecture Callout: Routing vs QoS Scheduling ---------------- */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
        <div className="flex items-center gap-2 border-b border-coastal-border pb-2.5 mb-3">
          <ShieldCheck className="w-4 h-4 text-coastal-cerulean" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-coastal-text">
            Network Architecture: Path Selection (OSPF) vs. Traffic Scheduling (QoS)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-coastal-text-muted leading-relaxed">
          <div className="p-3.5 bg-coastal-cream-dark/40 border border-coastal-border rounded-xl space-y-1">
            <span className="font-bold text-coastal-text block text-[11px] uppercase tracking-wide">
              1. Routing Plane (OSPF-Inspired SPF)
            </span>
            <p>
              Routing operates at Layer 3 to select topological paths between network nodes. Using Dijkstra’s Shortest
              Path First (SPF) algorithm and link cost metrics, OSPF determines next hops, reachability, and
              fault-tolerant ring failover. Routing alone does not prioritize packets or schedule transmission queues.
            </p>
          </div>

          <div className="p-3.5 bg-coastal-cream-dark/40 border border-coastal-border rounded-xl space-y-1">
            <span className="font-bold text-coastal-text block text-[11px] uppercase tracking-wide">
              2. Quality of Service (QoS Scheduler Plane)
            </span>
            <p>
              Once routing selects the path, the QoS model governs packet scheduling across the bottleneck links.
              Strict Priority with Starvation Safeguards (SP-SS) guarantees that critical life-safety ambulance dispatch
              and hospital telemetry preempt non-emergency logistics traffic during catastrophic surges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

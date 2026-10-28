import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Play,
  TrendingUp,
  Layers,
  Info,
  CheckCircle2,
  Radio,
  Server,
  Zap,
  Download,
} from 'lucide-react';
import { TelemetryResponse } from '../types';
import { fetchTelemetry, triggerTelemetryDrill } from '../api/telemetry';
import { downloadTelemetryCsv, downloadTelemetryJson } from '../api/reports';
import { useNetworkEvents } from '../context/NetworkEventContext';

// Established Muted Pastel Palette Constants
const PALETTE = {
  cerulean: '#6D9EBA', // Ordinary network activity
  dustyRose: '#C98F9B', // Critical traffic
  mauve: '#AA96B5', // Alternate paths or secondary series
  pastelGreen: '#B8D6BE', // Healthy performance
  pastelGreenDark: '#2D5936', // Text/Line dark
  mutedGold: '#E6CD8C', // Warnings
  mutedGoldDark: '#684F17',
  warmOrange: '#DCA77C', // Suspicious events / route changes
  border: '#E2D9D5',
  cardBg: '#FBF8F2',
  textDark: '#393640',
  textMuted: '#746E79',
};

// Custom Tooltip component for readable, styled Recharts tooltips
const TelemetryTooltip: React.FC<any> = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-coastal-cream border border-coastal-border rounded-xl p-3 shadow-coastal-md text-xs space-y-1 z-50">
        <p className="font-mono font-bold text-coastal-text border-b border-coastal-border pb-1 mb-1">
          Time: {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.stroke || entry.fill }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
              <span className="font-medium text-coastal-text-muted">{entry.name}:</span>
            </span>
            <span className="font-mono font-bold text-coastal-text">
              {entry.value !== undefined ? (typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value) : '--'}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TelemetryPage: React.FC = () => {
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [drillLoading, setDrillLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const { subscribe, isLive } = useNetworkEvents();
  const wsConnected = isLive;
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Load telemetry data from backend
  const loadData = useCallback(async (range: string = timeRange) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTelemetry(range);
      setData(res);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load telemetry data from backend API');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Initial load and range switch
  useEffect(() => {
    loadData(timeRange);
  }, [timeRange, loadData]);

  // Unified Event Subscription for Real-time Telemetry Updates
  useEffect(() => {
    const unsub = subscribe('*', (msg) => {
      const et = msg.event_type || msg.event;
      if (
        et === 'SIMULATION_COMPLETED' ||
        et === 'SIMULATION_FAILED' ||
        et === 'TRAFFIC_UPDATE' ||
        et === 'LINK_FAILURE' ||
        et === 'LINK_RESTORED' ||
        et === 'NODE_FAILURE' ||
        et === 'NODE_RESTORED' ||
        et === 'RESOURCE_RESTORED' ||
        et === 'BASELINE_RESET' ||
        et === 'POLLING_SYNC_TICK'
      ) {
        loadData(timeRange);
      }
    });

    return unsub;
  }, [subscribe, timeRange, loadData]);

  // Trigger on-demand simulation drill
  const handleRunDrill = async () => {
    try {
      setDrillLoading(true);
      await triggerTelemetryDrill('TELEMETRY-VERIFICATION-DRILL');
      await loadData(timeRange);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute telemetry drill');
    } finally {
      setDrillLoading(false);
    }
  };

  const timeRanges = [
    { id: '15m', label: '15 Min' },
    { id: '1h', label: '1 Hour' },
    { id: '6h', label: '6 Hours' },
    { id: '24h', label: '24 Hours' },
    { id: 'all', label: 'All Drills' },
  ];

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportCsv = async () => {
    try {
      setExporting('csv');
      await downloadTelemetryCsv(timeRange);
    } catch (err: any) {
      alert(err?.message || 'Failed to export telemetry CSV');
    } finally {
      setExporting(null);
    }
  };

  const handleExportJson = async () => {
    try {
      setExporting('json');
      await downloadTelemetryJson(timeRange);
    } catch (err: any) {
      alert(err?.message || 'Failed to export telemetry JSON');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-coastal-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border shadow-coastal-sm">
              <Activity className="w-5 h-5" />
            </div>
            Network Telemetry & Historical Trends
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Algorithmic performance metrics, routing convergence latency, queue loads, and link utilization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* WebSocket Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono font-medium ${
              wsConnected
                ? 'bg-coastal-safe/20 border-coastal-safe text-coastal-safe-text'
                : 'bg-coastal-sand/20 border-coastal-border text-coastal-text-muted'
            }`}
            title={wsConnected ? 'Connected to live event broadcast' : 'Polling mode active'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-coastal-safe-text' : 'bg-coastal-warning-text'
              }`}
            />
            {wsConnected ? 'Live Feed Connected' : 'Polling Feed'}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-coastal-cream border border-coastal-border rounded-md p-0.5 shadow-coastal-sm">
            {timeRanges.map((r) => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  timeRange === r.id
                    ? 'bg-coastal-cerulean text-white shadow-sm font-semibold'
                    : 'text-coastal-text-muted hover:text-coastal-text hover:bg-coastal-powder/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportCsv}
              disabled={exporting !== null}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
              title="Export Telemetry CSV"
            >
              <Download className="w-3.5 h-3.5 text-coastal-cerulean" />
              <span>{exporting === 'csv' ? 'Exporting...' : 'CSV'}</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={exporting !== null}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
              title="Export Telemetry JSON"
            >
              <Download className="w-3.5 h-3.5 text-coastal-cerulean" />
              <span>{exporting === 'json' ? 'Exporting...' : 'JSON'}</span>
            </button>
          </div>

          {/* Action: Run Drill */}
          <button
            onClick={handleRunDrill}
            disabled={drillLoading || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark active:scale-[0.99] text-white border border-coastal-dusty-rose rounded-md text-xs font-semibold shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-dusty-rose focus:ring-offset-1 focus:ring-offset-coastal-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Execute on-demand convergence drill to record a new data point"
          >
            <Play className={`w-3.5 h-3.5 text-white ${drillLoading ? 'animate-spin' : ''}`} />
            {drillLoading ? 'Simulating...' : 'Run Simulation Drill'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(timeRange)}
            disabled={loading}
            className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
            title="Refresh Telemetry Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-coastal-cerulean' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Educational & Simulation Mode Disclaimer Banner */}
      <div className="bg-coastal-powder/40 border border-coastal-cerulean/30 rounded-2xl p-4 text-xs text-coastal-text flex items-start gap-3 shadow-coastal-sm">
        <Info className="w-5 h-5 text-coastal-cerulean shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-coastal-text flex items-center gap-2">
            Modeled Telemetry Notice
            <span className="px-2 py-0.5 rounded text-[10px] bg-coastal-cerulean/15 text-coastal-cerulean font-bold">
              Simulated Estimates
            </span>
          </p>
          <p className="text-coastal-text-muted leading-relaxed">
            All telemetry metrics (shortest-path latency, packet delivery ratio, queue utilization, and route flap counts)
            are calculated deterministically by the backend simulation engine based on Dijkstra graph evaluations, link cost models,
            and strict priority queueing. They represent simulated estimates and are distinguishable from physical kernel socket counters or NIC hardware telemetry.
          </p>
        </div>
      </div>

      {/* 3. API Error Banner */}
      {error && (
        <div className="bg-coastal-critical/15 border border-coastal-critical rounded-2xl p-4 text-xs text-coastal-critical-text flex items-center justify-between shadow-coastal-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-coastal-critical" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData(timeRange)}
            className="px-3 py-1 bg-coastal-cream border border-coastal-critical rounded-lg text-xs font-semibold hover:bg-coastal-critical/20"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Real-time Snapshot Summary Cards */}
      {data?.snapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Availability */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
            <span className="text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider block">
              Network Availability
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-coastal-safe-text">
                {data.snapshot.current_availability_pct}%
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-safe/30 text-coastal-safe-text border border-coastal-safe rounded font-bold">
                {data.snapshot.modeled_status}
              </span>
            </div>
            <span className="text-[11px] text-coastal-text-muted mt-1 block">
              {data.snapshot.active_nodes}/{data.snapshot.total_nodes} nodes operational
            </span>
          </div>

          {/* Card 2: Estimated Latency */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
            <span className="text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider block">
              Estimated Latency
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-coastal-cerulean">
                {data.snapshot.current_avg_latency_ms} <span className="text-xs font-normal">ms</span>
              </span>
              <span className="text-[10px] text-coastal-text-muted font-medium">Target &le; 15ms</span>
            </div>
            <span className="text-[11px] text-coastal-text-muted mt-1 block">
              OSPF SPF Dijkstra metric
            </span>
          </div>

          {/* Card 3: Active Links */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
            <span className="text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider block">
              Active Mesh Links
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-coastal-text">
                {data.snapshot.active_links} <span className="text-xs text-coastal-text-muted">/ {data.snapshot.total_links}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded font-bold">
                Ring Mesh
              </span>
            </div>
            <span className="text-[11px] text-coastal-text-muted mt-1 block">
              Redundant path topology
            </span>
          </div>

          {/* Card 4: Health Score */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
            <span className="text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider block">
              Network Health Score
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-coastal-text">
                {data.snapshot.current_health_score} <span className="text-xs text-coastal-text-muted">/ 100</span>
              </span>
              <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" />
            </div>
            <span className="text-[11px] text-coastal-text-muted mt-1 block">
              Weighted node & link state
            </span>
          </div>

          {/* Card 5: Recorded Drills */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm">
            <span className="text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider block">
              Recorded Drills
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-coastal-mauve">
                {data.snapshot.total_simulation_runs}
              </span>
              <Clock className="w-4 h-4 text-coastal-mauve" />
            </div>
            <span className="text-[11px] text-coastal-text-muted mt-1 block">
              Refreshed: {lastRefreshed || '--'}
            </span>
          </div>
        </div>
      )}

      {/* 5. Insufficient Data Notice / Empty State */}
      {data && !data.has_sufficient_data && (
        <div className="bg-coastal-cream border-2 border-dashed border-coastal-border rounded-2xl p-8 text-center space-y-4 shadow-coastal-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-coastal-powder text-coastal-cerulean flex items-center justify-center border border-coastal-border">
            <Clock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-coastal-text">
              Insufficient Historical Data for Selected Window
            </h3>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              {data.explanation ||
                `Only ${data.data_points_count} simulation run is recorded within the '${timeRange}' filter. Historical telemetry progression requires at least 2 simulation drill runs.`}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setTimeRange('all')}
              className="px-4 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all"
            >
              View All Recorded Drills
            </button>
            <button
              onClick={handleRunDrill}
              disabled={drillLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              {drillLoading ? 'Running Drill...' : 'Run Simulation Drill'}
            </button>
          </div>
        </div>
      )}

      {/* 6. Main Visualizations Grid */}
      {data && data.has_sufficient_data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Network Availability Over Time */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-coastal-cerulean" />
                  Network Availability Over Time
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Overall availability % and departmental endpoint reachability across simulation runs.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-safe/30 text-coastal-safe-text border border-coastal-safe rounded font-bold">
                Target: &ge; 99%
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.availability_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="%" />
                  <Tooltip content={<TelemetryTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={99} stroke={PALETTE.pastelGreenDark} strokeDasharray="4 4" label={{ value: '99% SLA', fill: PALETTE.pastelGreenDark, fontSize: 10, position: 'insideTopLeft' }} />
                  <Area
                    type="monotone"
                    dataKey="availability_pct"
                    name="Overall Availability"
                    stroke={PALETTE.cerulean}
                    fill={PALETTE.cerulean}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="reachability_pct"
                    name="Departmental Reachability"
                    stroke={PALETTE.mauve}
                    fill={PALETTE.mauve}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Estimated Latency */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <Clock className="w-4 h-4 text-coastal-cerulean" />
                  Estimated Latency (Dijkstra Shortest Path)
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Cumulative hop propagation and transmission delay in milliseconds.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded font-bold">
                Baseline: 15 ms
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.latency_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 'auto']} stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="ms" />
                  <Tooltip content={<TelemetryTooltip unit="ms" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={15} stroke={PALETTE.pastelGreenDark} strokeDasharray="4 4" label={{ value: 'Target 15ms', fill: PALETTE.pastelGreenDark, fontSize: 10, position: 'insideTopLeft' }} />
                  <ReferenceLine y={45} stroke={PALETTE.mutedGoldDark} strokeDasharray="4 4" label={{ value: 'Warning 45ms', fill: PALETTE.mutedGoldDark, fontSize: 10, position: 'insideTopLeft' }} />
                  <Line
                    type="monotone"
                    dataKey="estimated_latency_ms"
                    name="Modeled Latency (ms)"
                    stroke={PALETTE.cerulean}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: PALETTE.cerulean }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3 & 4: Packet Delivery Ratio & Packet Loss */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" />
                  Packet Delivery Ratio & Packet Loss
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Proportion of successfully routed packets vs dropped frames during outages.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-dusty-rose/20 text-coastal-dusty-rose border border-coastal-dusty-rose/40 rounded font-bold">
                Loss &le; 1% SLA
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.packet_delivery_and_loss} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="%" />
                  <Tooltip content={<TelemetryTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={99} stroke={PALETTE.pastelGreenDark} strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="delivery_ratio_pct"
                    name="Delivery Ratio (%)"
                    stroke={PALETTE.pastelGreenDark}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: PALETTE.pastelGreenDark }}
                  />
                  <Line
                    type="monotone"
                    dataKey="packet_loss_pct"
                    name="Packet Loss (%)"
                    stroke={PALETTE.dustyRose}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: PALETTE.dustyRose }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Traffic Volume by Priority Class */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <Layers className="w-4 h-4 text-coastal-mauve" />
                  Traffic Volume by Priority Class
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Bandwidth demand across Critical, High, Normal, and Low emergency traffic classes.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded font-bold">
                Mbps Offered
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.traffic_volume_by_class} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="M" />
                  <Tooltip content={<TelemetryTooltip unit="Mbps" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {/* Critical: Dusty Rose */}
                  <Area
                    type="monotone"
                    dataKey="critical_mbps"
                    name="Critical (Ambulance/Hospital)"
                    stackId="1"
                    stroke={PALETTE.dustyRose}
                    fill={PALETTE.dustyRose}
                    fillOpacity={0.8}
                  />
                  {/* High: Warm Orange */}
                  <Area
                    type="monotone"
                    dataKey="high_mbps"
                    name="High (Police/Fire)"
                    stackId="1"
                    stroke={PALETTE.warmOrange}
                    fill={PALETTE.warmOrange}
                    fillOpacity={0.7}
                  />
                  {/* Normal: Cerulean */}
                  <Area
                    type="monotone"
                    dataKey="normal_mbps"
                    name="Normal (Departmental)"
                    stackId="1"
                    stroke={PALETTE.cerulean}
                    fill={PALETTE.cerulean}
                    fillOpacity={0.6}
                  />
                  {/* Low: Muted Gold */}
                  <Area
                    type="monotone"
                    dataKey="low_mbps"
                    name="Low (Routine/Admin)"
                    stackId="1"
                    stroke={PALETTE.mutedGold}
                    fill={PALETTE.mutedGold}
                    fillOpacity={0.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 6: Recovery Duration */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <Zap className="w-4 h-4 text-coastal-mauve" />
                  Recovery Duration (SPF Convergence)
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Time elapsed from outage detection to complete routing convergence.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-safe/30 text-coastal-safe-text border border-coastal-safe rounded font-bold">
                SLA &le; 1.50s
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.recovery_duration} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="s" />
                  <Tooltip content={<TelemetryTooltip unit="sec" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={1.50} stroke={PALETTE.pastelGreenDark} strokeDasharray="4 4" label={{ value: 'Target SLA 1.50s', fill: PALETTE.pastelGreenDark, fontSize: 10, position: 'insideTopLeft' }} />
                  <Bar
                    dataKey="recovery_duration_sec"
                    name="Convergence Duration (sec)"
                    fill={PALETTE.mauve}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 7: Route Changes Over Time */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex items-center justify-between border-b border-coastal-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                  <Radio className="w-4 h-4 text-coastal-warm-orange" />
                  Route Changes & Alternate Paths Over Time
                </h2>
                <p className="text-[11px] text-coastal-text-muted">
                  Topology recalculations and alternate paths activated during drills.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded font-bold">
                Flap Counter
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.route_changes_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                  <XAxis dataKey="time_label" stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <YAxis stroke={PALETTE.textMuted} fontSize={10} tickLine={false} />
                  <Tooltip content={<TelemetryTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="route_changes_count"
                    name="Route Flaps / Recalculations"
                    fill={PALETTE.warmOrange}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="alternate_paths_activated"
                    name="Alternate Paths Activated"
                    fill={PALETTE.mauve}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 7. Chart 8: Link Utilization Breakdown (Full Width) */}
      {data && data.link_utilization && data.link_utilization.length > 0 && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-coastal-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                <Server className="w-4 h-4 text-coastal-cerulean" />
                Physical & Logical Link Utilization
              </h2>
              <p className="text-[11px] text-coastal-text-muted">
                Bandwidth utilization across core backbone rings, switch uplinks, and departmental interfaces.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-coastal-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PALETTE.cerulean }} /> &lt; 60% Optimal
              </span>
              <span className="flex items-center gap-1.5 text-coastal-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PALETTE.mutedGold }} /> 60-80% Busy
              </span>
              <span className="flex items-center gap-1.5 text-coastal-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PALETTE.dustyRose }} /> &gt; 80% Congested
              </span>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.link_utilization}
                layout="horizontal"
                margin={{ top: 10, right: 10, left: -20, bottom: 45 }}
              >
                <CartesianGrid stroke={PALETTE.border} strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="link_id"
                  stroke={PALETTE.textMuted}
                  fontSize={9}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis domain={[0, 100]} stroke={PALETTE.textMuted} fontSize={10} tickLine={false} unit="%" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-coastal-cream border border-coastal-border rounded-xl p-3 shadow-coastal-md text-xs space-y-1">
                          <p className="font-mono font-bold text-coastal-text">{item.link_id}</p>
                          <p className="text-[11px] text-coastal-text-muted">{item.link_name}</p>
                          <div className="pt-1.5 border-t border-coastal-border space-y-0.5">
                            <div className="flex justify-between gap-4">
                              <span className="text-coastal-text-muted">State:</span>
                              <span className={`font-bold ${item.operational_state === 'UP' ? 'text-coastal-safe-text' : 'text-coastal-critical'}`}>
                                {item.operational_state}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-coastal-text-muted">Utilization:</span>
                              <span className="font-mono font-bold text-coastal-text">{item.utilization_pct}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-coastal-text-muted">Current Load:</span>
                              <span className="font-mono text-coastal-text">{item.current_load_mbps} / {item.bandwidth_mbps} Mbps</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-coastal-text-muted">Link Cost:</span>
                              <span className="font-mono text-coastal-text">{item.link_cost}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={80} stroke={PALETTE.dustyRose} strokeDasharray="3 3" label={{ value: '80% Congestion Threshold', fill: PALETTE.dustyRose, fontSize: 10, position: 'insideTopLeft' }} />
                <Bar dataKey="utilization_pct" name="Link Utilization (%)" radius={[4, 4, 0, 0]}>
                  {data.link_utilization.map((entry, index) => {
                    let color = PALETTE.cerulean;
                    if (entry.operational_state === 'DOWN') {
                      color = PALETTE.dustyRose;
                    } else if (entry.utilization_pct >= 80) {
                      color = PALETTE.dustyRose;
                    } else if (entry.utilization_pct >= 60) {
                      color = PALETTE.mutedGold;
                    }
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

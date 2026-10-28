import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitFork,
  ArrowRight,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock,
  Activity,
  Cpu,
} from 'lucide-react';
import {
  AlgorithmComparisonResponse,
  NetworkTopology,
  NetworkNode,
  NetworkLink,
} from '../types';
import {
  fetchTopology,
  compareRoutingAlgorithms,
  failLink,
  restoreLink,
  failNode,
  restoreNode,
} from '../api/network';
import { coastalColors } from '../theme/tokens';

export const RoutingLabPage: React.FC = () => {
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [sourceNode, setSourceNode] = useState<string>('HQ-COMMAND-01');
  const [destinationNode, setDestinationNode] = useState<string>('HOSPITAL-TRIAGE-03');
  const [kPaths, setKPaths] = useState<number>(3);
  const [comparisonResult, setComparisonResult] = useState<AlgorithmComparisonResponse | null>(null);
  const [selectedAlgoKey, setSelectedAlgoKey] = useState<string>('dijkstra');
  const [selectedYenRank, setSelectedYenRank] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load topology data
  const loadTopology = useCallback(async () => {
    try {
      setPageLoading(true);
      const data = await fetchTopology();
      setTopology(data);

      // Default source/dest if available
      if (data.nodes.length >= 2) {
        if (!data.nodes.some((n) => n.node_id === sourceNode)) {
          setSourceNode(data.nodes[0].node_id);
        }
        if (!data.nodes.some((n) => n.node_id === destinationNode)) {
          setDestinationNode(data.nodes[data.nodes.length - 1].node_id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load network topology');
    } finally {
      setPageLoading(false);
    }
  }, [sourceNode, destinationNode]);

  useEffect(() => {
    loadTopology();
  }, [loadTopology]);

  // Execute benchmark
  const runBenchmark = useCallback(
    async (src?: string, dst?: string, k?: number) => {
      try {
        setLoading(true);
        setError(null);
        const s = src || sourceNode;
        const d = dst || destinationNode;
        const kp = k !== undefined ? k : kPaths;

        const res = await compareRoutingAlgorithms(s, d, kp);
        setComparisonResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algorithm benchmark failed');
      } finally {
        setLoading(false);
      }
    },
    [sourceNode, destinationNode, kPaths],
  );

  // Auto-run benchmark after initial topology loads
  useEffect(() => {
    if (!pageLoading && topology && !comparisonResult) {
      runBenchmark();
    }
  }, [pageLoading, topology, comparisonResult, runBenchmark]);

  // Determine active highlighted path on canvas
  const activeHighlightedPath = useMemo<string[]>(() => {
    if (!comparisonResult) return [];

    if (selectedAlgoKey === 'yen_k_shortest' && selectedYenRank !== null) {
      const yen = comparisonResult.algorithms.find((a) => a.algorithm_key === 'yen_k_shortest');
      if (yen?.ranked_alternatives && yen.ranked_alternatives[selectedYenRank - 1]) {
        return yen.ranked_alternatives[selectedYenRank - 1].path;
      }
    }

    const algo = comparisonResult.algorithms.find((a) => a.algorithm_key === selectedAlgoKey);
    return algo?.path || [];
  }, [comparisonResult, selectedAlgoKey, selectedYenRank]);

  // Quick failure simulation handlers
  const handleToggleLink = async (link: NetworkLink) => {
    try {
      setActionLoading(true);
      if (link.operational_state === 'UP') {
        await failLink(link.link_id, 'Routing Lab Failover Drill');
      } else {
        await restoreLink(link.link_id);
      }
      const data = await fetchTopology();
      setTopology(data);
      await runBenchmark();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle link');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleNode = async (node: NetworkNode) => {
    try {
      setActionLoading(true);
      if (node.status === 'active') {
        await failNode(node.node_id, 'Routing Lab Node Failure Drill');
      } else {
        await restoreNode(node.node_id);
      }
      const data = await fetchTopology();
      setTopology(data);
      await runBenchmark();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle node');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!comparisonResult) return;
    const blob = new Blob([JSON.stringify(comparisonResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routing_algorithm_comparison_${sourceNode}_to_${destinationNode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG dimensions for Topology Canvas
  const svgWidth = 840;
  const svgHeight = 360;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-coastal-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border shadow-coastal-sm">
              <GitFork className="w-5 h-5" />
            </div>
            Multi-Algorithm Routing Lab & Disaster Recovery Analysis
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Empirical benchmark comparing Dijkstra SPF, Bellman-Ford, Floyd-Warshall, and Yen's K-Shortest loopless paths.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {comparisonResult && (
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all"
              title="Export Benchmark JSON"
            >
              <Download className="w-3.5 h-3.5 text-coastal-cerulean" />
              <span>Export JSON</span>
            </button>
          )}

          <button
            onClick={() => runBenchmark()}
            disabled={loading || actionLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean-dark text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Calculating...' : 'Run Benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-coastal-critical/15 border border-coastal-critical/40 text-coastal-critical-text rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-coastal-critical" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Control Strip */}
      <div className="p-4 bg-coastal-cream border border-coastal-border rounded-2xl shadow-coastal-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-coastal-text">
            <span className="text-coastal-text-muted">Source Node:</span>
            <select
              value={sourceNode}
              onChange={(e) => {
                setSourceNode(e.target.value);
                runBenchmark(e.target.value, destinationNode, kPaths);
              }}
              className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-xs font-mono text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
            >
              {topology?.nodes.map((n: NetworkNode) => (
                <option key={n.node_id} value={n.node_id}>
                  {n.node_id} ({n.name})
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="w-4 h-4 text-coastal-text-muted hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-semibold text-coastal-text">
            <span className="text-coastal-text-muted">Destination Node:</span>
            <select
              value={destinationNode}
              onChange={(e) => {
                setDestinationNode(e.target.value);
                runBenchmark(sourceNode, e.target.value, kPaths);
              }}
              className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-xs font-mono text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
            >
              {topology?.nodes.map((n: NetworkNode) => (
                <option key={n.node_id} value={n.node_id}>
                  {n.node_id} ({n.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-coastal-text">
            <span className="text-coastal-text-muted">Yen's K-Paths:</span>
            <select
              value={kPaths}
              onChange={(e) => {
                const k = Number(e.target.value);
                setKPaths(k);
                runBenchmark(sourceNode, destinationNode, k);
              }}
              className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-xs font-mono text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
            >
              <option value={2}>Top 2 Loopless Paths</option>
              <option value={3}>Top 3 Loopless Paths</option>
              <option value={4}>Top 4 Loopless Paths</option>
              <option value={5}>Top 5 Loopless Paths</option>
            </select>
          </div>
        </div>

        {/* Selected Algorithm Path Selector */}
        <div className="flex items-center gap-1.5 bg-coastal-powder/60 p-1 rounded-xl border border-coastal-border text-xs flex-wrap">
          <span className="text-[11px] font-semibold text-coastal-text-muted px-2">Highlight:</span>
          {[
            { key: 'dijkstra', label: 'Dijkstra' },
            { key: 'bellman_ford', label: 'Bellman-Ford' },
            { key: 'floyd_warshall', label: 'Floyd-Warshall' },
            { key: 'yen_k_shortest', label: "Yen's K-Paths" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSelectedAlgoKey(item.key);
                setSelectedYenRank(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-xs ${
                selectedAlgoKey === item.key && selectedYenRank === null
                  ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
                  : 'text-coastal-text hover:bg-white/80'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Interactive Topology Visual Canvas */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-coastal-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-coastal-cerulean" />
            <h3 className="text-sm font-bold text-coastal-text">
              Network Topology Path Highlighting Canvas
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-coastal-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-coastal-dusty-rose rounded-full inline-block" />
              Active Route ({activeHighlightedPath.length} hops)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-coastal-safe inline-block" />
              Active Node
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-coastal-critical inline-block" />
              Offline Node / Severed Link
            </span>
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="relative w-full overflow-x-auto bg-white/70 rounded-xl border border-coastal-border p-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[700px] select-none"
          >
            {/* Render Links */}
            {topology?.links.map((link: NetworkLink) => {
              const srcNode = topology.nodes.find((n: NetworkNode) => n.node_id === link.source_node_id);
              const dstNode = topology.nodes.find((n: NetworkNode) => n.node_id === link.destination_node_id);
              if (!srcNode || !dstNode) return null;

              // Scale coordinates to SVG canvas
              const x1 = Math.max(40, Math.min(svgWidth - 40, (srcNode.pos_x / 750) * (svgWidth - 100) + 50));
              const y1 = Math.max(30, Math.min(svgHeight - 30, (srcNode.pos_y / 350) * (svgHeight - 80) + 40));
              const x2 = Math.max(40, Math.min(svgWidth - 40, (dstNode.pos_x / 750) * (svgWidth - 100) + 50));
              const y2 = Math.max(30, Math.min(svgHeight - 30, (dstNode.pos_y / 350) * (svgHeight - 80) + 40));

              // Check if part of highlighted path
              let isHighlighted = false;
              if (activeHighlightedPath.length >= 2) {
                for (let i = 0; i < activeHighlightedPath.length - 1; i++) {
                  const a = activeHighlightedPath[i];
                  const b = activeHighlightedPath[i + 1];
                  if (
                    (link.source_node_id === a && link.destination_node_id === b) ||
                    (link.source_node_id === b && link.destination_node_id === a)
                  ) {
                    isHighlighted = true;
                    break;
                  }
                }
              }

              const isDown = link.operational_state === 'DOWN';
              let strokeColor = '#B0C4DE'; // Cerulean muted
              let strokeWidth = 2;
              let strokeDash: string | undefined = undefined;

              if (isDown) {
                strokeColor = coastalColors.critical;
                strokeDash = '5 5';
              } else if (isHighlighted) {
                strokeColor = coastalColors.dustyRose;
                strokeWidth = 4.5;
              }

              return (
                <g key={link.link_id} className="cursor-pointer" onClick={() => handleToggleLink(link)}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                    className="transition-all duration-200 hover:opacity-80"
                  />
                  {/* Link cost label */}
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 5}
                    textAnchor="middle"
                    className="text-[9px] fill-coastal-text-muted font-mono font-bold select-none"
                  >
                    {isDown ? 'DOWN' : `${link.link_cost}m`}
                  </text>
                </g>
              );
            })}

            {/* Render Nodes */}
            {topology?.nodes.map((node: NetworkNode) => {
              const cx = Math.max(40, Math.min(svgWidth - 40, (node.pos_x / 750) * (svgWidth - 100) + 50));
              const cy = Math.max(30, Math.min(svgHeight - 30, (node.pos_y / 350) * (svgHeight - 80) + 40));
              const isOffline = node.status === 'offline';
              const isInPath = activeHighlightedPath.includes(node.node_id);
              const isSource = node.node_id === sourceNode;
              const isDest = node.node_id === destinationNode;

              let fill = '#FFFFFF';
              let stroke: string = coastalColors.border;
              let strokeWidth = 2;

              if (isOffline) {
                fill = '#FFEBEE';
                stroke = coastalColors.critical;
                strokeWidth = 2.5;
              } else if (isSource || isDest) {
                fill = '#E8F5E9';
                stroke = coastalColors.cerulean;
                strokeWidth = 3;
              } else if (isInPath) {
                fill = '#FDF2E9';
                stroke = coastalColors.dustyRose;
                strokeWidth = 2.5;
              }

              return (
                <g
                  key={node.node_id}
                  className="cursor-pointer group"
                  onClick={() => handleToggleNode(node)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSource || isDest ? 14 : 11}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    className="transition-all duration-200"
                  />
                  <text
                    x={cx}
                    y={cy + (isSource || isDest ? 24 : 20)}
                    textAnchor="middle"
                    className="text-[10px] font-mono font-bold fill-coastal-text pointer-events-none"
                  >
                    {node.node_id}
                  </text>
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    className={`text-[9px] font-bold pointer-events-none ${
                      isOffline ? 'fill-coastal-critical' : 'fill-coastal-text'
                    }`}
                  >
                    {isSource ? 'SRC' : isDest ? 'DST' : isOffline ? 'X' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs text-coastal-text-muted px-1">
          <span>Tip: Click any link or node on the canvas to toggle failure states and see live failover recalculation.</span>
          <span className="font-mono text-[11px] font-semibold text-coastal-text">
            Active Route: {activeHighlightedPath.join(' ➔ ') || 'No route available'}
          </span>
        </div>
      </div>

      {/* 4. The 4 Algorithms Comparative Metric Cards */}
      {comparisonResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparisonResult.algorithms.map((algo) => {
            const isSelected = selectedAlgoKey === algo.algorithm_key;
            return (
              <div
                key={algo.algorithm_key}
                onClick={() => {
                  setSelectedAlgoKey(algo.algorithm_key);
                  setSelectedYenRank(null);
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-coastal-sm flex flex-col justify-between ${
                  isSelected
                    ? 'bg-coastal-powder/60 border-coastal-cerulean ring-2 ring-coastal-cerulean/30'
                    : 'bg-coastal-cream border-coastal-border hover:border-coastal-cerulean/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className="font-bold text-sm text-coastal-text">{algo.algorithm_name}</h4>
                      <p className="text-[11px] text-coastal-text-muted">{algo.purpose}</p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        algo.reachable
                          ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                          : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                      }`}
                    >
                      {algo.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-coastal-border/60 text-center">
                    <div>
                      <span className="text-[10px] text-coastal-text-muted block font-semibold">METRIC</span>
                      <span className="font-mono text-sm font-bold text-coastal-text">
                        {algo.total_cost !== null ? algo.total_cost : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-coastal-text-muted block font-semibold">HOPS</span>
                      <span className="font-mono text-sm font-bold text-coastal-text">{algo.hop_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-coastal-text-muted block font-semibold">COMPUTE</span>
                      <span className="font-mono text-sm font-bold text-coastal-cerulean">
                        {algo.execution_time_ms < 0.1
                          ? `${(algo.execution_time_ms * 1000).toFixed(0)}µs`
                          : `${algo.execution_time_ms.toFixed(2)}ms`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-coastal-text-muted block mb-1">
                      Computed Path Sequence:
                    </span>
                    {algo.path && algo.path.length > 0 ? (
                      <div className="font-mono text-xs text-coastal-text bg-white/80 p-2 rounded-xl border border-coastal-border flex items-center gap-1 flex-wrap">
                        {algo.path.map((hop, i) => (
                          <React.Fragment key={hop}>
                            <span className="font-bold">{hop}</span>
                            {i < algo.path.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-coastal-cerulean flex-shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-coastal-critical italic">No topological path exists</div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-coastal-border/60 mt-3 flex items-center justify-between text-[11px] text-coastal-text-muted font-mono">
                  <span>{algo.time_complexity}</span>
                  <span className="text-coastal-cerulean font-semibold">
                    {isSelected ? 'Canvas Highlight Active' : 'Click to View'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Timing Separation: Compute Time vs Network Convergence vs Recovery Time */}
      <div className="p-5 bg-coastal-cream border border-coastal-border rounded-2xl shadow-coastal-sm space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-coastal-cerulean" />
          <h3 className="text-base font-bold text-coastal-text">
            Architectural Separation: Algorithmic Compute vs Network Convergence vs Recovery Duration
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/90 border border-coastal-border rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-coastal-cerulean uppercase">
              <Cpu className="w-4 h-4" /> 1. Algorithmic Compute Time
            </div>
            <div className="font-mono text-lg font-bold text-coastal-text">
              ~25µs – 350µs
            </div>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              In-memory execution of the shortest path graph traversal on a single node CPU. Scales strictly with computational complexity: Dijkstra O((|V|+|E|) log |V|) vs Floyd-Warshall O(|V|^3).
            </p>
          </div>

          <div className="p-4 bg-white/90 border border-coastal-border rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-coastal-dusty-rose uppercase">
              <Activity className="w-4 h-4" /> 2. Modeled Network Convergence
            </div>
            <div className="font-mono text-lg font-bold text-coastal-text">
              ~15ms – 45ms
            </div>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              Physical protocol convergence: Bidirectional Forwarding Detection (BFD) hardware alert (10ms) + Link-State Advertisement (LSA) flooding over neighbors + FIB hardware table reprogramming.
            </p>
          </div>

          <div className="p-4 bg-white/90 border border-coastal-border rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-coastal-safe-text uppercase">
              <CheckCircle2 className="w-4 h-4" /> 3. End-to-End Recovery Duration
            </div>
            <div className="font-mono text-lg font-bold text-coastal-text">
              ~0.045s – 0.120s
            </div>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              Total operational time from link break to first verified packet arrival over the new alternate route, including transport buffer drain and queue retransmissions.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Yen's K-Shortest Paths Backup Route Analysis */}
      {comparisonResult && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
          <div className="flex items-center justify-between border-b border-coastal-border/60 pb-3">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-coastal-cerulean" />
              <h3 className="text-sm font-bold text-coastal-text">
                Yen's K-Shortest Loopless Paths: Pre-Computed Disaster Backup Routes
              </h3>
            </div>
            <span className="text-xs text-coastal-text-muted">
              Guarantees loop-free failover without recalculation delay
            </span>
          </div>

          {(() => {
            const yen = comparisonResult.algorithms.find((a) => a.algorithm_key === 'yen_k_shortest');
            if (!yen?.ranked_alternatives || yen.ranked_alternatives.length === 0) {
              return (
                <div className="p-4 text-center text-xs text-coastal-text-muted">
                  No alternate loopless paths exist between {sourceNode} and {destinationNode}.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {yen.ranked_alternatives.map((alt) => {
                  const isSelected = selectedAlgoKey === 'yen_k_shortest' && selectedYenRank === alt.rank;
                  return (
                    <div
                      key={alt.rank}
                      onClick={() => {
                        setSelectedAlgoKey('yen_k_shortest');
                        setSelectedYenRank(alt.rank);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'bg-coastal-powder border-coastal-dusty-rose ring-1 ring-coastal-dusty-rose shadow-coastal-sm'
                          : 'bg-white border-coastal-border hover:bg-coastal-powder/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            alt.rank === 1
                              ? 'bg-coastal-safe/25 text-coastal-safe-text border border-coastal-safe-border'
                              : 'bg-coastal-powder text-coastal-cerulean border border-coastal-border'
                          }`}
                        >
                          #{alt.rank}
                        </span>
                        <div>
                          <div className="font-bold text-coastal-text flex items-center gap-1.5">
                            <span>{alt.role || `Alternative Route #${alt.rank}`}</span>
                            {alt.rank === 1 && (
                              <span className="text-[10px] bg-coastal-safe/25 text-coastal-safe-text px-1.5 py-0.5 rounded font-bold uppercase">
                                PRIMARY PATH
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-coastal-text mt-1 flex items-center gap-1 flex-wrap">
                            {alt.path.map((h, idx) => (
                              <React.Fragment key={h}>
                                <span>{h}</span>
                                {idx < alt.path.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-coastal-cerulean flex-shrink-0" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right flex-shrink-0">
                        <div>
                          <span className="text-[10px] text-coastal-text-muted block font-semibold">METRIC COST</span>
                          <span className="font-mono font-bold text-coastal-text">{alt.total_cost}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-coastal-text-muted block font-semibold">HOP COUNT</span>
                          <span className="font-mono font-bold text-coastal-text">{alt.hop_count} hops</span>
                        </div>
                        <button
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            isSelected
                              ? 'bg-coastal-dusty-rose text-white'
                              : 'bg-coastal-cream border border-coastal-border text-coastal-text'
                          }`}
                        >
                          {isSelected ? 'Highlighted' : 'Highlight Path'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 7. Algorithmic Constraints & Comparison Matrix */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
        <h3 className="text-base font-bold text-coastal-text">
          Comprehensive Routing Algorithm Constraints & Specifications
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-coastal-text">
            <thead className="bg-coastal-powder/60 text-coastal-text uppercase font-semibold border-b border-coastal-border">
              <tr>
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Time Complexity</th>
                <th className="py-2.5 px-3">Negative Costs</th>
                <th className="py-2.5 px-3">Loop-Free Guarantee</th>
                <th className="py-2.5 px-3">Disaster Resilience Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coastal-border/60 bg-white/80">
              <tr>
                <td className="py-3 px-3 font-bold text-coastal-cerulean">Dijkstra SPF</td>
                <td className="py-3 px-3">Link-State (Global)</td>
                <td className="py-3 px-3 font-mono">O((|V| + |E|) log |V|)</td>
                <td className="py-3 px-3 text-coastal-critical font-semibold">No (Cycles Break)</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (Strictly Optimal)</td>
                <td className="py-3 px-3">Baseline real-time link-state SPF recalculated on BFD link-down alert.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-coastal-cerulean">Bellman-Ford</td>
                <td className="py-3 px-3">Distance-Vector</td>
                <td className="py-3 px-3 font-mono">O(|V| * |E|)</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (Cycle Detected)</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (Converged)</td>
                <td className="py-3 px-3">Distributed RIP/BGP failover; detects corrupted metrics and loops.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-coastal-cerulean">Floyd-Warshall</td>
                <td className="py-3 px-3">Dynamic Programming</td>
                <td className="py-3 px-3 font-mono">O(|V|^3)</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (Cycle Detected)</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (All-Pairs Matrix)</td>
                <td className="py-3 px-3">Pre-computed global matrix. Cubic scaling limits large mesh graphs.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-coastal-cerulean">Yen's K-Shortest</td>
                <td className="py-3 px-3">Deviations Algorithm</td>
                <td className="py-3 px-3 font-mono">O(K * |V| (|E| + |V| log |V|))</td>
                <td className="py-3 px-3 text-coastal-text-muted">No</td>
                <td className="py-3 px-3 text-coastal-safe-text font-semibold">Yes (Guaranteed Loopless)</td>
                <td className="py-3 px-3">Pre-computes top $K$ alternative backup routes for instantaneous zero-delay failover.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

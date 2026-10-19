import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  applyNodeChanges,
  NodeChange,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Activity,
  AlertTriangle,
  Battery,
  Radio,
  Send,
  Zap,
  CheckCircle2,
  Clock,
  RefreshCw,
  Router,
  Server,
  Layers,
  Monitor,
  Maximize2,
  ShieldAlert,
  RotateCcw,
  ArrowRight,
  ListChecks,
  XCircle,
  ExternalLink,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  NetworkNode,
  NetworkLink,
  NetworkTopology,
  NetworkMetrics,
  RoutePath,
  ReachabilityMatrixResponse,
  NetworkEventItem,
} from '../types';
import {
  fetchTopology,
  fetchMetrics,
  fetchRoutes,
  fetchReachability,
  fetchEvents,
  failLink,
  restoreLink,
  failNode,
  restoreNode,
  resetBaseline,
} from '../api/network';
import { fetchAlerts, AlertRecord } from '../api/alerts';
import { fetchSimulationRuns, SimulationRunRecord } from '../api/simulation';
import { coastalColors } from '../theme/tokens';
import { useNetworkEvents } from '../context/NetworkEventContext';

const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { fitView } = useReactFlow();

  // Core API States
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [reachability, setReachability] = useState<ReachabilityMatrixResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [simulations, setSimulations] = useState<SimulationRunRecord[]>([]);
  const [events, setEvents] = useState<NetworkEventItem[]>([]);

  // Route Selection & Highlighting States
  const [sourceNode, setSourceNode] = useState<string>('HQ-COMMAND-01');
  const [destinationNode, setDestinationNode] = useState<string>('HOSPITAL-TRIAGE-03');
  const [currentRoute, setCurrentRoute] = useState<RoutePath | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);

  // Inspector Selection States
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<NetworkLink | null>(null);

  // Page Status
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Master data loader
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, topologyData, reachData, alertsData, simData, eventsData] =
        await Promise.all([
          fetchMetrics().catch(() => null),
          fetchTopology().catch(() => null),
          fetchReachability('HQ-COMMAND-01').catch(() => null),
          fetchAlerts('ACTIVE').catch(() => []),
          fetchSimulationRuns(5).catch(() => []),
          fetchEvents(8).catch(() => []),
        ]);

      if (!topologyData || !Array.isArray(topologyData.nodes)) {
        throw new Error('Failed to load topology from backend server');
      }

      setMetrics(metricsData);
      setTopology(topologyData);
      setReachability(reachData);
      setAlerts(alertsData);
      setSimulations(simData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading emergency network dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Route calculation effect
  const loadRoute = useCallback(async (src: string, dest: string) => {
    if (!src || !dest) return;
    try {
      setRouteLoading(true);
      const res = await fetchRoutes(src, dest, 'CRITICAL_SOS');
      setCurrentRoute(res);
    } catch (err) {
      console.warn('Route calculation error:', err);
      setCurrentRoute(null);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sourceNode && destinationNode) {
      loadRoute(sourceNode, destinationNode);
    }
  }, [sourceNode, destinationNode, loadRoute]);

  // Real-time Event Synchronization via WebSocket and Polling Fallback
  const { subscribe } = useNetworkEvents();

  useEffect(() => {
    const unsub = subscribe('*', (event) => {
      const et = event.event_type || event.event;
      if (
        et === 'NODE_FAILURE' ||
        et === 'NODE_RESTORED' ||
        et === 'LINK_FAILURE' ||
        et === 'LINK_RESTORED' ||
        et === 'RESOURCE_RESTORED' ||
        et === 'BASELINE_RESET'
      ) {
        Promise.all([
          fetchTopology().catch(() => null),
          fetchReachability('HQ-COMMAND-01').catch(() => null),
          fetchMetrics().catch(() => null),
          fetchAlerts('ACTIVE').catch(() => []),
          fetchEvents(8).catch(() => []),
        ]).then(([newTopo, newReach, newMetrics, newAlerts, newEvents]) => {
          if (newTopo) setTopology(newTopo);
          if (newReach) setReachability(newReach);
          if (newMetrics) setMetrics(newMetrics);
          if (newAlerts) setAlerts(newAlerts);
          if (newEvents) setEvents(newEvents);
          if (sourceNode && destinationNode) {
            loadRoute(sourceNode, destinationNode);
          }
        });
      } else if (et === 'ROUTE_RECALCULATION') {
        if (sourceNode && destinationNode) {
          loadRoute(sourceNode, destinationNode);
        }
      } else if (et === 'CONNECTIVITY_CHANGE') {
        fetchReachability('HQ-COMMAND-01').then((r) => r && setReachability(r)).catch(() => {});
        fetchMetrics().then((m) => m && setMetrics(m)).catch(() => {});
      } else if (et === 'ALERT_CREATED' || et === 'ALERT_UPDATED' || et === 'ALERT_RESOLVED') {
        fetchAlerts('ACTIVE').then((a) => a && setAlerts(a)).catch(() => {});
      } else if (
        et === 'SIMULATION_STARTED' ||
        et === 'SIMULATION_COMPLETED' ||
        et === 'SIMULATION_FAILED' ||
        et === 'SIMULATION_STOPPED'
      ) {
        Promise.all([
          fetchSimulationRuns(5).catch(() => []),
          fetchEvents(8).catch(() => []),
          fetchMetrics().catch(() => null),
        ]).then(([runs, evts, m]) => {
          if (runs) setSimulations(runs);
          if (evts) setEvents(evts);
          if (m) setMetrics(m);
        });
      } else if (et === 'POLLING_SYNC_TICK') {
        loadDashboardData();
      }
    });

    return unsub;
  }, [subscribe, loadRoute, sourceNode, destinationNode, loadDashboardData]);

  // Helper: check if a node or edge is on currentRoute
  const routeNodeSet = useMemo(() => {
    return new Set(currentRoute?.path || []);
  }, [currentRoute]);

  const routeHopEdgeIds = useMemo(() => {
    if (!currentRoute || !currentRoute.hop_list) return new Set<string>();
    const ids = new Set<string>();
    currentRoute.hop_list.forEach((hop) => {
      if (hop.link_id) ids.add(hop.link_id);
    });
    return ids;
  }, [currentRoute]);

  // Node icon helper
  const getNodeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'router') return <Router className="w-4 h-4 text-coastal-cerulean" />;
    if (t === 'switch') return <Layers className="w-4 h-4 text-coastal-mauve" />;
    if (t === 'server' || t === 'command_center' || t === 'hospital') {
      return <Server className="w-4 h-4 text-coastal-mountain" />;
    }
    if (t === 'relay') return <Radio className="w-4 h-4 text-coastal-cerulean" />;
    return <Monitor className="w-4 h-4 text-coastal-text-muted" />;
  };

  // Convert API nodes to ReactFlow nodes with route highlighting
  const flowNodes: Node[] = useMemo(() => {
    if (!topology || !Array.isArray(topology.nodes)) return [];
    return topology.nodes.map((node) => {
      const isOffline = node.status === 'offline';
      const isDegraded = node.status === 'degraded';
      const isSelected = selectedNode?.node_id === node.node_id;
      const isOnRoute = routeNodeSet.has(node.node_id);

      let borderClass = 'border-coastal-border';
      let statusColor: string = coastalColors.safe;
      let statusLabel = 'ACTIVE';

      if (isOffline) {
        borderClass = 'border-coastal-critical';
        statusColor = coastalColors.critical;
        statusLabel = 'OFFLINE';
      } else if (isDegraded) {
        borderClass = 'border-coastal-warning';
        statusColor = coastalColors.warning;
        statusLabel = 'DEGRADED';
      }

      if (isSelected) {
        borderClass = 'border-coastal-cerulean ring-2 ring-coastal-cerulean/40';
      } else if (isOnRoute) {
        borderClass = 'border-coastal-cerulean shadow-coastal-md ring-1 ring-coastal-cerulean/30';
      }

      return {
        id: node.node_id,
        position: { x: node.pos_x, y: node.pos_y },
        data: {
          label: (
            <div
              className={`p-2.5 rounded-2xl bg-coastal-cream/95 border ${borderClass} transition-all duration-200 min-w-[145px] max-w-[175px] ${
                isOnRoute ? 'bg-coastal-powder/30' : ''
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1 gap-1">
                <div className="flex items-center gap-1 font-mono font-bold text-coastal-text truncate">
                  {getNodeIcon(node.node_type)}
                  <span className="truncate">{node.node_id}</span>
                </div>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{
                    backgroundColor: `${statusColor}25`,
                    color: statusColor === coastalColors.safe ? '#2d5a37' : statusColor,
                    borderColor: statusColor,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="text-xs font-bold text-coastal-text truncate mb-0.5" title={node.name}>
                {node.name}
              </div>

              {node.ip_address && (
                <div className="text-[10px] font-mono text-coastal-text-muted mb-0.5 truncate">
                  {node.ip_address}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-coastal-text-muted pt-1 border-t border-coastal-border/60">
                <span className="capitalize text-[9px] font-medium truncate max-w-[75px]">
                  {node.node_type}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Battery className="w-3 h-3 text-coastal-brown" />
                  {Math.round(node.battery_level)}%
                </span>
              </div>
            </div>
          ),
          raw: node,
        },
      };
    });
  }, [topology, selectedNode, routeNodeSet]);

  // Convert API links to ReactFlow edges with route highlighting
  const flowEdges: Edge[] = useMemo(() => {
    if (!topology || !Array.isArray(topology.links)) return [];
    return topology.links.map((link) => {
      const isDown = link.operational_state === 'DOWN';
      const isSecondary =
        link.link_type === 'secondary' || Boolean(link.extra_metadata?.is_secondary);
      const isSelected = selectedLink?.link_id === link.link_id;
      const isOnRoute = routeHopEdgeIds.has(link.link_id);

      let strokeColor: string = coastalColors.mutedCerulean;
      if (isDown) {
        strokeColor = coastalColors.critical;
      } else if (isOnRoute) {
        strokeColor = coastalColors.mutedCerulean; // active highlighted path
      } else if (isSecondary) {
        strokeColor = coastalColors.mutedMauve;
      } else if (link.operational_state === 'UP' && link.link_type === 'backbone') {
        strokeColor = coastalColors.safe;
      }

      const strokeWidth = isOnRoute ? 3.5 : isSelected ? 3 : isSecondary ? 1.5 : 2;

      return {
        id: link.link_id,
        source: link.source_node_id,
        target: link.destination_node_id,
        animated: isOnRoute && !isDown,
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isDown ? '6 6' : isSecondary && !isOnRoute ? '4 4' : undefined,
          cursor: 'pointer',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
        data: { raw: link },
      };
    });
  }, [topology, selectedLink, routeHopEdgeIds]);

  const [activeFlowNodes, setActiveFlowNodes] = useState<Node[]>(flowNodes);
  useEffect(() => {
    setActiveFlowNodes(flowNodes);
  }, [flowNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setActiveFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const raw = (node.data as { raw: NetworkNode }).raw;
    setSelectedNode(raw);
    setSelectedLink(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    const raw = (edge.data as { raw: NetworkLink }).raw;
    setSelectedLink(raw);
    setSelectedNode(null);
  };

  // ---------------- Core Action Handlers ----------------

  // 1. Run Connectivity Test
  const handleRunConnectivityTest = async () => {
    try {
      setActionLoading(true);
      const reachData = await fetchReachability('HQ-COMMAND-01');
      setReachability(reachData);
      if (sourceNode && destinationNode) {
        await loadRoute(sourceNode, destinationNode);
      }
      setToastMessage({
        text: `Connectivity test complete. ${reachData.reachable_destinations}/${reachData.total_destinations} stations reachable (${reachData.reachability_percentage}%).`,
        type: 'success',
      });
    } catch (err) {
      setToastMessage({
        text: `Connectivity test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Simulate Primary Link Failure (LINK-R1-R2)
  const handleSimulatePrimaryLinkFailure = async () => {
    try {
      setActionLoading(true);
      const res = await failLink('LINK-R1-R2', 'Dashboard simulated core primary ring failure');
      await loadDashboardData();
      if (sourceNode && destinationNode) {
        await loadRoute(sourceNode, destinationNode);
      }
      setToastMessage({
        text: `Primary link LINK-R1-R2 severed. Recovery time: ${res.recovery_metrics?.total_recovery_duration_sec ?? '0.045'}s. Alternate path established.`,
        type: 'info',
      });
    } catch (err) {
      setToastMessage({
        text: `Failed to inject link outage: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Restore Network (Controlled Baseline Reset)
  const handleRestoreNetwork = async () => {
    try {
      setActionLoading(true);
      const res = await resetBaseline();
      await loadDashboardData();
      if (sourceNode && destinationNode) {
        await loadRoute(sourceNode, destinationNode);
      }
      setSelectedNode(null);
      setSelectedLink(null);
      setToastMessage({
        text: `Network baseline restored. ${res.restored_nodes_count} nodes & ${res.restored_links_count} links active. Historical telemetry preserved.`,
        type: 'success',
      });
    } catch (err) {
      setToastMessage({
        text: `Failed to restore network: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Inspector node failure toggle
  const handleToggleNodeFailure = async (node: NetworkNode) => {
    try {
      setActionLoading(true);
      if (node.status === 'offline') {
        await restoreNode(node.node_id);
        setToastMessage({ text: `Node ${node.node_id} restored to active status.`, type: 'success' });
      } else {
        await failNode(node.node_id, 'Simulated operator drill');
        setToastMessage({ text: `Node ${node.node_id} marked as offline.`, type: 'info' });
      }
      await loadDashboardData();
      if (sourceNode && destinationNode) {
        await loadRoute(sourceNode, destinationNode);
      }
    } catch (err) {
      setToastMessage({
        text: `Node state update failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Inspector link failure toggle
  const handleToggleLinkFailure = async (link: NetworkLink) => {
    try {
      setActionLoading(true);
      if (link.operational_state === 'DOWN') {
        await restoreLink(link.link_id);
        setToastMessage({ text: `Link ${link.link_id} restored to UP state.`, type: 'success' });
      } else {
        await failLink(link.link_id, 'Simulated operator drill');
        setToastMessage({ text: `Link ${link.link_id} marked as DOWN.`, type: 'info' });
      }
      await loadDashboardData();
      if (sourceNode && destinationNode) {
        await loadRoute(sourceNode, destinationNode);
      }
    } catch (err) {
      setToastMessage({
        text: `Link state update failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Connected links for selected node
  const nodeConnectedLinks = useMemo(() => {
    if (!selectedNode || !topology || !Array.isArray(topology.links)) return [];
    return topology.links.filter(
      (l) => l.source_node_id === selectedNode.node_id || l.destination_node_id === selectedNode.node_id,
    );
  }, [selectedNode, topology]);

  // Node specific events
  const nodeEvents = useMemo(() => {
    if (!selectedNode) return [];
    return events.filter((e) => e.affected_resource === selectedNode.node_id);
  }, [selectedNode, events]);

  // Most recent recovery time from simulations
  const mostRecentRecoveryTime = useMemo(() => {
    if (!simulations || simulations.length === 0) return null;
    const sorted = [...simulations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return sorted[0];
  }, [simulations]);

  // Loading skeleton
  if (loading && !topology) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-coastal-cream rounded-2xl w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-coastal-cream border border-coastal-border rounded-2xl" />
          ))}
        </div>
        <div className="h-[480px] bg-coastal-cream border border-coastal-border rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-coastal-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-coastal-safe/30 border-coastal-safe text-coastal-text'
              : toastMessage.type === 'error'
              ? 'bg-coastal-critical/20 border-coastal-critical/50 text-coastal-critical-text'
              : 'bg-coastal-powder border-coastal-border text-coastal-cerulean'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" />
            ) : toastMessage.type === 'error' ? (
              <XCircle className="w-4 h-4 text-coastal-critical-text" />
            ) : (
              <Info className="w-4 h-4 text-coastal-cerulean" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[11px] underline ml-3 text-coastal-text-muted hover:text-coastal-text"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical/40 rounded-2xl text-coastal-critical-text text-xs flex items-center justify-between shadow-coastal-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-coastal-critical shrink-0" />
            <span>{error}. Ensure the FastAPI backend server is accessible.</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-3 py-1 bg-coastal-cream border border-coastal-border rounded-xl text-coastal-text font-semibold hover:bg-coastal-powder transition-all"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Header & Functional Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <Radio className="w-5 h-5" />
            </div>
            Emergency Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-coastal-text-muted mt-1">
            Real-time topology, priority routing convergence, and dynamic disaster recovery telemetry.
          </p>
        </div>

        {/* 4 Functional Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunConnectivityTest}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border hover:border-coastal-border-dark rounded-md text-coastal-text text-xs font-semibold shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-cerulean focus:ring-offset-1 focus:ring-offset-coastal-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            title="Evaluate network reachability matrix across all departments"
          >
            <ListChecks className="w-3.5 h-3.5 text-coastal-cerulean" />
            <span>Run Connectivity Test</span>
          </button>

          <button
            onClick={handleSimulatePrimaryLinkFailure}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark text-white border border-coastal-dusty-rose rounded-md text-xs font-semibold shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-dusty-rose focus:ring-offset-1 focus:ring-offset-coastal-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            title="Sever primary backbone link LINK-R1-R2 to test OSPF alternate path recovery"
          >
            <Zap className="w-3.5 h-3.5 text-white" />
            <span>Simulate Primary Link Failure</span>
          </button>

          <button
            onClick={handleRestoreNetwork}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border hover:border-coastal-border-dark rounded-md text-coastal-text text-xs font-semibold shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-cerulean focus:ring-offset-1 focus:ring-offset-coastal-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            title="Controlled baseline reset: restores all nodes and links to healthy operational state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-coastal-safe-text" />
            <span>Restore Network</span>
          </button>

          <button
            onClick={() => navigate('/scenarios')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean-dark text-white border border-coastal-cerulean rounded-md text-xs font-semibold shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-cerulean focus:ring-offset-1 focus:ring-offset-coastal-cream cursor-pointer active:scale-[0.99]"
            title="Open automated scenario drills and stress runner"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Open Scenario Runner</span>
          </button>

          <button
            onClick={loadDashboardData}
            disabled={actionLoading}
            className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border hover:border-coastal-border-dark rounded-md text-coastal-text shadow-coastal-sm transition-all focus:outline-none focus:ring-2 focus:ring-coastal-cerulean focus:ring-offset-1 focus:ring-offset-coastal-cream disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-coastal-brown ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------- Refined 5-Metric Operations Row ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Network Availability */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Network Availability
            </span>
            <div className="p-1.5 bg-coastal-powder text-coastal-cerulean rounded-lg border border-coastal-border">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-coastal-text">
              {metrics ? `${metrics.network_health_score}%` : '—'}
            </div>
            <div className="text-[11px] text-coastal-text-muted mt-0.5">
              {metrics ? `${metrics.active_nodes} of ${metrics.total_nodes} nodes active` : 'Loading...'}
            </div>
          </div>
        </div>

        {/* Metric 2: Reachable Departments */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Reachable Departments
            </span>
            <div className="p-1.5 bg-coastal-safe/30 text-coastal-safe-text rounded-lg border border-coastal-safe/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-coastal-text">
              {reachability ? `${reachability.reachable_destinations} / ${reachability.total_destinations}` : '—'}
            </div>
            <div className="text-[11px] text-coastal-text-muted mt-0.5">
              {reachability ? `${reachability.reachability_percentage}% connected` : 'Loading...'}
            </div>
          </div>
        </div>

        {/* Metric 3: Active Links */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Active Links
            </span>
            <div className="p-1.5 bg-coastal-powder text-coastal-cerulean rounded-lg border border-coastal-border">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-coastal-text">
              {metrics ? `${metrics.up_links} / ${metrics.total_links}` : '—'}
            </div>
            <div className="text-[11px] text-coastal-text-muted mt-0.5">
              {metrics ? `${metrics.down_links} severed (DOWN)` : 'Loading...'}
            </div>
          </div>
        </div>

        {/* Metric 4: Open Critical Alerts */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Open Critical Alerts
            </span>
            <div
              className={`p-1.5 rounded-lg border ${
                alerts.length > 0
                  ? 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical/50'
                  : 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div
              className={`text-2xl font-black ${
                alerts.length > 0 ? 'text-coastal-critical-text' : 'text-coastal-text'
              }`}
            >
              {alerts.length}
            </div>
            <div className="text-[11px] text-coastal-text-muted mt-0.5">
              {alerts.length > 0 ? 'Requires attention' : 'All systems clear'}
            </div>
          </div>
        </div>

        {/* Metric 5: Most Recent Recovery Time */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Last Recovery Time
            </span>
            <div className="p-1.5 bg-coastal-peach text-coastal-brown rounded-lg border border-coastal-border">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-coastal-text font-mono">
              {mostRecentRecoveryTime ? `${mostRecentRecoveryTime.recovery_duration}s` : '—'}
            </div>
            <div className="text-[11px] text-coastal-text-muted mt-0.5 truncate" title={mostRecentRecoveryTime?.scenario_id || ''}>
              {mostRecentRecoveryTime?.scenario_id ? `Drill: ${mostRecentRecoveryTime.scenario_id}` : 'No drills run yet'}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Main Content: Topology + Route Inspector ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Large Interactive Topology Canvas */}
        <div className="lg:col-span-3 bg-coastal-cream border border-coastal-border rounded-2xl overflow-hidden relative shadow-coastal-sm flex flex-col min-h-[460px] h-[500px]">
          {/* Top Canvas Bar: Route Selector */}
          <div className="p-3 bg-coastal-cream/90 backdrop-blur-sm border-b border-coastal-border flex flex-wrap items-center justify-between gap-2.5 z-10 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-coastal-text-muted font-bold text-[10px] uppercase tracking-wider">
                Select Path:
              </span>

              {/* Source Dropdown */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-coastal-text-muted">From:</span>
                <select
                  value={sourceNode}
                  onChange={(e) => setSourceNode(e.target.value)}
                  className="px-2.5 py-1 bg-coastal-cream-dark/60 border border-coastal-border rounded-lg text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
                >
                  {topology?.nodes?.map((n) => (
                    <option key={n.node_id} value={n.node_id}>
                      {n.node_id} ({n.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Dropdown */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-coastal-text-muted">To:</span>
                <select
                  value={destinationNode}
                  onChange={(e) => setDestinationNode(e.target.value)}
                  className="px-2.5 py-1 bg-coastal-cream-dark/60 border border-coastal-border rounded-lg text-xs font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
                >
                  {topology?.nodes?.map((n) => (
                    <option key={n.node_id} value={n.node_id}>
                      {n.node_id} ({n.name})
                    </option>
                  ))}
                </select>
              </div>

              {routeLoading && (
                <RefreshCw className="w-3.5 h-3.5 text-coastal-cerulean animate-spin ml-1" />
              )}
            </div>

            <button
              onClick={() => fitView({ padding: 0.2, duration: 600 })}
              className="flex items-center gap-1 px-2.5 py-1 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-lg text-coastal-text text-[11px] font-semibold transition-all"
            >
              <Maximize2 className="w-3 h-3 text-coastal-cerulean" /> Fit View
            </button>
          </div>

          {/* React Flow Component */}
          <div className="flex-1 w-full relative">
            <ReactFlow
              nodes={activeFlowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              fitView
              minZoom={0.2}
              maxZoom={2.0}
            >
              <Background color={coastalColors.borderDark} gap={20} size={1} />
              <Controls />
            </ReactFlow>

            {/* Canvas Legend */}
            <div className="absolute bottom-3 left-3 bg-coastal-cream/95 border border-coastal-border rounded-xl p-2.5 text-xs text-coastal-text shadow-coastal-sm backdrop-blur-sm pointer-events-none max-w-[340px]">
              <span className="font-bold block mb-1 text-[9px] text-coastal-text-muted uppercase tracking-wider">
                Topology Key
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: coastalColors.safe }} />
                  <span>Healthy Ring</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: coastalColors.mutedCerulean }} />
                  <span>Ordinary Link</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: coastalColors.mutedMauve }} />
                  <span>Mauve Alternate</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: coastalColors.critical }} />
                  <span>Failed (DOWN)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Inspector Panel */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 flex flex-col justify-between shadow-coastal-sm overflow-y-auto min-h-[460px] h-[500px]">
          <div>
            <div className="flex items-center justify-between border-b border-coastal-border pb-2.5 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-coastal-cerulean" />
                {selectedNode
                  ? 'Device Telemetry'
                  : selectedLink
                  ? 'Link Telemetry'
                  : 'Element Inspector'}
              </h2>
              {(selectedNode || selectedLink) && (
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    setSelectedLink(null);
                  }}
                  className="text-[10px] text-coastal-text-muted hover:text-coastal-text underline"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Case 1: Node Inspector */}
            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Device ID</span>
                  <span className="font-mono font-bold text-sm text-coastal-text">{selectedNode.node_id}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Facility Name</span>
                  <span className="font-semibold text-coastal-text">{selectedNode.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Type</span>
                    <span className="capitalize font-medium text-coastal-text">{selectedNode.node_type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Status</span>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5"
                      style={{
                        backgroundColor:
                          selectedNode.status === 'offline'
                            ? `${coastalColors.critical}25`
                            : `${coastalColors.safe}25`,
                        color:
                          selectedNode.status === 'offline'
                            ? coastalColors.critical
                            : '#2d5a37',
                      }}
                    >
                      {selectedNode.status}
                    </span>
                  </div>
                </div>

                {selectedNode.ip_address && (
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">IPv4 Address</span>
                    <span className="font-mono text-coastal-text font-semibold">{selectedNode.ip_address}</span>
                  </div>
                )}

                {/* Battery reserve */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase">Battery Reserve</span>
                    <span className="font-mono text-[11px] font-semibold">{selectedNode.battery_level}%</span>
                  </div>
                  <div className="w-full bg-coastal-cream-dark rounded h-1.5 border border-coastal-border overflow-hidden">
                    <div
                      className="h-1.5 rounded"
                      style={{
                        width: `${selectedNode.battery_level}%`,
                        backgroundColor:
                          selectedNode.battery_level > 50 ? coastalColors.safe : coastalColors.critical,
                      }}
                    />
                  </div>
                </div>

                {/* Connected Links */}
                <div>
                  <span className="text-[10px] font-bold text-coastal-text-muted uppercase block mb-1">
                    Connected Links ({nodeConnectedLinks.length})
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {nodeConnectedLinks.map((l) => (
                      <div
                        key={l.link_id}
                        className="p-1.5 bg-coastal-cream-dark/50 border border-coastal-border rounded-lg text-[10px] flex items-center justify-between"
                      >
                        <span className="font-mono text-coastal-text truncate max-w-[95px]">
                          {l.source_node_id === selectedNode.node_id ? l.destination_node_id : l.source_node_id}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            l.operational_state === 'UP'
                              ? 'text-coastal-safe-text bg-coastal-safe/25 border border-coastal-safe-border'
                              : 'text-coastal-critical-text bg-coastal-critical/20 border border-coastal-critical-border'
                          }`}
                        >
                          {l.operational_state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Node Events */}
                {nodeEvents.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block mb-1">
                      Recent Events ({nodeEvents.length})
                    </span>
                    <div className="space-y-1 max-h-20 overflow-y-auto pr-1 text-[10px] text-coastal-text-muted">
                      {nodeEvents.slice(0, 3).map((e) => (
                        <div key={e.event_id} className="truncate">
                          • {e.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button */}
                <div className="pt-2">
                  <button
                    onClick={() => handleToggleNodeFailure(selectedNode)}
                    disabled={actionLoading}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-1.5 transition-all shadow-coastal-sm cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedNode.status === 'offline'
                        ? 'bg-coastal-safe/40 hover:bg-coastal-safe/60 border-coastal-safe-border text-coastal-safe-text'
                        : 'bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark border-coastal-dusty-rose text-white'
                    }`}
                  >
                    {selectedNode.status === 'offline' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-coastal-safe-text" /> Restore Node
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-white" /> Simulate Node Outage
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : selectedLink ? (
              /* Case 2: Link Inspector */
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Link ID</span>
                  <span className="font-mono font-bold text-sm text-coastal-text">{selectedLink.link_id}</span>
                </div>

                <div className="p-2.5 bg-coastal-powder/40 rounded-xl border border-coastal-border space-y-0.5">
                  <div className="text-[10px] text-coastal-text-muted uppercase font-semibold">Endpoints</div>
                  <div className="font-mono font-semibold text-coastal-text text-[11px]">
                    {selectedLink.source_node_id} ➔ {selectedLink.destination_node_id}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Class</span>
                    <span className="capitalize font-semibold text-coastal-text">{selectedLink.link_type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Status</span>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5"
                      style={{
                        backgroundColor:
                          selectedLink.operational_state === 'DOWN'
                            ? `${coastalColors.critical}25`
                            : `${coastalColors.safe}25`,
                        color:
                          selectedLink.operational_state === 'DOWN'
                            ? coastalColors.critical
                            : '#2d5a37',
                      }}
                    >
                      {selectedLink.operational_state}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Bandwidth</span>
                    <span className="font-mono text-coastal-text font-medium">{selectedLink.bandwidth} Mbps</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">Latency</span>
                    <span className="font-mono text-coastal-text font-medium">{selectedLink.latency} ms</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-coastal-text-muted uppercase block">OSPF Cost Metric</span>
                  <span className="font-mono text-coastal-text font-medium">{selectedLink.link_cost}</span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleToggleLinkFailure(selectedLink)}
                    disabled={actionLoading}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-1.5 transition-all shadow-coastal-sm cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedLink.operational_state === 'DOWN'
                        ? 'bg-coastal-safe/40 hover:bg-coastal-safe/60 border-coastal-safe-border text-coastal-safe-text'
                        : 'bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark border-coastal-dusty-rose text-white'
                    }`}
                  >
                    {selectedLink.operational_state === 'DOWN' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-coastal-safe-text" /> Restore Link (UP)
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-white" /> Sever Link (DOWN)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: Empty State / Guidance */
              <div className="text-center py-12 px-2 text-coastal-text-muted">
                <AlertTriangle className="w-7 h-7 text-coastal-mauve/70 mx-auto mb-2" />
                <p className="text-xs font-medium leading-relaxed">
                  Click any router, switch, or link on the canvas to inspect real-time properties and trigger actions.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Subnet Summary in Inspector */}
          {topology?.subnets && topology.subnets.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-coastal-border text-[11px]">
              <span className="font-bold text-coastal-text-muted block mb-1 text-[10px] uppercase">
                Emergency Subnets ({topology.subnets.length})
              </span>
              <div className="space-y-1 max-h-20 overflow-y-auto pr-1 text-[10px]">
                {topology.subnets.slice(0, 4).map((s) => (
                  <div key={s.code} className="flex items-center justify-between text-coastal-text">
                    <span className="truncate max-w-[100px]">{s.department}:</span>
                    <span className="font-mono text-coastal-cerulean font-semibold">{s.subnet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Current Route Information Banner ---------------- */}
      {currentRoute && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-coastal-text flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-coastal-cerulean" /> Active Route Path
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  currentRoute.reachability
                    ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                    : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                }`}
              >
                {currentRoute.status}
              </span>
              {currentRoute.alternate_path_selected && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-coastal-mauve/20 text-coastal-mauve border border-coastal-mauve/30">
                  Alternate Route Rerouted
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-coastal-text flex-wrap">
              <span>Hops: <span className="font-mono font-bold text-coastal-cerulean">{currentRoute.hops}</span></span>
              <span>Latency: <span className="font-mono font-bold">{currentRoute.estimated_latency_ms} ms</span></span>
              <span>Metric Cost: <span className="font-mono font-bold">{currentRoute.cost !== null ? currentRoute.cost : '∞'}</span></span>
            </div>
          </div>

          {/* Visual Route Hop Sequence */}
          <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-coastal-cream-dark/50 border border-coastal-border rounded-xl">
            {currentRoute.path && currentRoute.path.length > 0 ? (
              currentRoute.path.map((nodeId, idx) => (
                <React.Fragment key={nodeId}>
                  <span className="px-2.5 py-1 bg-coastal-cream border border-coastal-border rounded-lg font-mono text-xs font-bold text-coastal-text shadow-coastal-sm">
                    {nodeId}
                  </span>
                  {idx < currentRoute.path.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-coastal-cerulean shrink-0" />
                  )}
                </React.Fragment>
              ))
            ) : (
              <span className="text-xs text-coastal-critical font-medium">
                No active route available. Target station is disconnected.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Lower Section: Recent Events & Compact Simulation History ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Recent Network Events */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-coastal-border pb-2.5 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-coastal-cerulean" /> Recent Network Events
              </h2>
              <span className="text-[10px] text-coastal-text-muted">Live audit telemetry</span>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-10 text-xs text-coastal-text-muted">
                No recent network events logged. Trigger a failure or baseline reset above to view events.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {events.map((evt) => (
                  <div
                    key={evt.event_id}
                    className="p-2.5 bg-coastal-cream-dark/40 border border-coastal-border rounded-xl text-xs flex items-center justify-between gap-3 shadow-coastal-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-coastal-critical/20 text-coastal-critical-text'
                            : 'bg-coastal-powder text-coastal-cerulean'
                        }`}
                      >
                        {evt.event_type}
                      </span>
                      <span className="font-mono font-semibold text-coastal-text">
                        {evt.affected_resource}:
                      </span>
                      <span className="text-coastal-text-muted truncate">{evt.message}</span>
                    </div>
                    <span className="font-mono text-[10px] text-coastal-text-muted shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Compact Simulation History */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-coastal-border pb-2.5 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-coastal-brown" /> Compact Simulation History
              </h2>
              <button
                onClick={() => navigate('/reports')}
                className="text-[11px] font-semibold text-coastal-cerulean hover:text-coastal-brown transition-colors flex items-center gap-1"
              >
                View Full Reports <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {simulations.length === 0 ? (
              <div className="text-center py-10 text-xs text-coastal-text-muted">
                No simulation drill runs recorded yet. Run a failure drill or connectivity test to populate history.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-coastal-border text-[10px] font-bold text-coastal-text-muted uppercase">
                      <th className="pb-2">Run ID</th>
                      <th className="pb-2">Scenario</th>
                      <th className="pb-2">Outcome</th>
                      <th className="pb-2">Recovery Time</th>
                      <th className="pb-2 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coastal-border/60">
                    {simulations.map((sim) => (
                      <tr key={sim.run_id} className="hover:bg-coastal-powder/30 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-coastal-text text-[11px]">{sim.run_id}</td>
                        <td className="py-2.5 text-coastal-text-muted truncate max-w-[120px]" title={sim.scenario_id || ''}>
                          {sim.scenario_id || 'Ad-hoc Drill'}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                              sim.result === 'SUCCESS'
                                ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                                : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                            }`}
                          >
                            {sim.result}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono font-semibold text-coastal-cerulean text-[11px]">
                          {sim.recovery_duration > 0 ? `${sim.recovery_duration}s` : '0.00s'}
                        </td>
                        <td className="py-2.5 font-mono text-[10px] text-coastal-text-muted text-right">
                          {new Date(sim.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DashboardContent />
    </ReactFlowProvider>
  );
};

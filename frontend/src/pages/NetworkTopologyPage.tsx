import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  RefreshCw,
  Battery,
  AlertCircle,
  Router,
  Server,
  Layers,
  Monitor,
  Radio,
  Maximize2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Info,
  RotateCcw,
  ArrowRight,
  Clock,
  ShieldAlert,
  ListChecks,
  History,
  Check,
} from 'lucide-react';
import {
  NetworkNode,
  NetworkLink,
  NetworkTopology,
  FailureInjectionResponse,
  BaselineResetResponse,
  ReachabilityMatrixResponse,
  NetworkEventItem,
} from '../types';
import {
  fetchTopology,
  failLink,
  restoreLink,
  failNode,
  restoreNode,
  resetBaseline,
  fetchReachability,
  fetchEvents,
} from '../api/network';
import { coastalColors } from '../theme/tokens';
import { useNetworkEvents } from '../context/NetworkEventContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive: boolean;
  reasonValue: string;
  onReasonChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  isDestructive,
  reasonValue,
  onReasonChange,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coastal-text/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-coastal-cream border border-coastal-border rounded-2xl p-6 shadow-coastal-lg space-y-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border flex-shrink-0 ${
              isDestructive
                ? 'bg-coastal-critical/20 border-coastal-critical/40 text-coastal-critical-text'
                : 'bg-coastal-powder border-coastal-border text-coastal-cerulean'
            }`}
          >
            {isDestructive ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <RotateCcw className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-coastal-text">{title}</h3>
            <p className="text-xs text-coastal-text-muted mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {isDestructive && (
          <div>
            <label className="block text-[11px] font-bold text-coastal-text uppercase tracking-wider mb-1.5">
              Simulation Drill Reason
            </label>
            <input
              type="text"
              value={reasonValue}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Seismic disruption / Physical cable severance"
              className="w-full px-3 py-2 text-xs bg-coastal-cream-dark/60 border border-coastal-border rounded-xl text-coastal-text placeholder:text-coastal-text-muted/60 focus:outline-none focus:ring-2 focus:ring-coastal-cerulean/30"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-coastal-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-coastal-text bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl transition-all shadow-coastal-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold rounded-xl border shadow-coastal-sm transition-all flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-coastal-critical hover:bg-coastal-critical/90 text-coastal-cream border-coastal-critical/80'
                : 'bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-coastal-cream border-coastal-cerulean'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isDestructive ? (
              <Zap className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const TopologyFlowContent: React.FC = () => {
  const { fitView } = useReactFlow();
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector selection states
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<NetworkLink | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Prompt 8 Workflow States
  const [lastActionResult, setLastActionResult] = useState<FailureInjectionResponse | null>(null);
  const [baselineResetResult, setBaselineResetResult] = useState<BaselineResetResponse | null>(null);
  const [reachabilityData, setReachabilityData] = useState<ReachabilityMatrixResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<NetworkEventItem[]>([]);
  const [activeBottomTab, setActiveBottomTab] = useState<'recovery' | 'reachability' | 'outages' | 'events'>('recovery');

  // Confirmation Modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    isDestructive: boolean;
    actionType: 'fail_link' | 'restore_link' | 'fail_node' | 'restore_node' | 'reset_baseline';
    targetId?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    isDestructive: false,
    actionType: 'reset_baseline',
  });
  const [drillReason, setDrillReason] = useState<string>('');

  const loadTopologyData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTopology();
      setTopology(data);
      setError(null);

      // Concurrently refresh reachability matrix and telemetry events
      try {
        const reachRes = await fetchReachability('HQ-COMMAND-01');
        setReachabilityData(reachRes);
      } catch (err) {
        console.warn('Reachability fetch deferred:', err);
      }

      try {
        const evtRes = await fetchEvents(10);
        setRecentEvents(evtRes || []);
      } catch (err) {
        console.warn('Events fetch deferred:', err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching network topology');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopologyData();
  }, [loadTopologyData]);

  // Real-time Event Synchronization via WebSocket and Polling Fallback
  const { subscribe } = useNetworkEvents();

  useEffect(() => {
    const unsub = subscribe('*', (msg) => {
      const et = msg.event_type || msg.event;
      if (
        et === 'LINK_FAILURE' ||
        et === 'LINK_RESTORED' ||
        et === 'NODE_FAILURE' ||
        et === 'NODE_RESTORED' ||
        et === 'RESOURCE_RESTORED' ||
        et === 'BASELINE_RESET' ||
        et === 'CONNECTIVITY_CHANGE' ||
        et === 'POLLING_SYNC_TICK'
      ) {
        loadTopologyData();
      }
    });

    return unsub;
  }, [subscribe, loadTopologyData]);

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

  // Convert API nodes to ReactFlow nodes
  const flowNodes: Node[] = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.map((node) => {
      const isOffline = node.status === 'offline';
      const isDegraded = node.status === 'degraded';
      const isSelected = selectedNode?.node_id === node.node_id;

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
        borderClass = 'border-coastal-cerulean ring-2 ring-coastal-cerulean/30';
      }

      return {
        id: node.node_id,
        position: { x: node.pos_x, y: node.pos_y },
        data: {
          label: (
            <div
              className={`p-3 rounded-2xl bg-coastal-cream/95 border ${borderClass} shadow-coastal-sm transition-all duration-200 min-w-[155px] max-w-[185px]`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1.5 gap-1">
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

              <div className="text-xs font-bold text-coastal-text truncate mb-1" title={node.name}>
                {node.name}
              </div>

              {node.ip_address && (
                <div className="text-[10px] font-mono text-coastal-text-muted mb-1 truncate">
                  IP: {node.ip_address}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-coastal-text-muted pt-1 border-t border-coastal-border/60">
                <span className="capitalize text-[9px] font-medium truncate max-w-[80px]">
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
  }, [topology, selectedNode]);

  // Convert API links to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    if (!topology) return [];
    return topology.links.map((link) => {
      const isDown = link.operational_state === 'DOWN';
      const isSecondary =
        link.link_type === 'secondary' || Boolean(link.extra_metadata?.is_secondary);
      const isSelected = selectedLink?.link_id === link.link_id;

      let strokeColor: string = coastalColors.mutedCerulean;
      if (isDown) {
        strokeColor = coastalColors.critical;
      } else if (isSecondary) {
        strokeColor = coastalColors.mutedMauve;
      } else if (link.operational_state === 'UP' && link.link_type === 'backbone') {
        strokeColor = coastalColors.safe;
      }

      return {
        id: link.link_id,
        source: link.source_node_id,
        target: link.destination_node_id,
        animated: !isDown,
        label: isSelected ? `${link.link_id} (${link.latency}ms)` : undefined,
        labelStyle: { fill: coastalColors.mainText, fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: coastalColors.cream, stroke: strokeColor, strokeWidth: 1 },

        style: {
          stroke: strokeColor,
          strokeWidth: isSelected ? 3.5 : isSecondary ? 2 : 2.5,
          strokeDasharray: isDown ? '6 6' : isSecondary ? '4 4' : undefined,
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
  }, [topology, selectedLink]);

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

  // ---------------- Prompt 8 Action Confirmation Triggers ----------------
  const promptFailLink = (link: NetworkLink) => {
    setDrillReason('Simulated seismic rupture / physical fiber severance');
    setModalConfig({
      isOpen: true,
      title: `Sever Network Link: ${link.link_id}`,
      message: `Are you sure you want to mark link ${link.link_id} (${link.source_node_id} ➔ ${link.destination_node_id}) as DOWN? The OSPF routing engine will compute alternate paths and log recovery metrics.`,
      confirmLabel: 'Sever Link (DOWN)',
      isDestructive: true,
      actionType: 'fail_link',
      targetId: link.link_id,
    });
  };

  const promptRestoreLink = (link: NetworkLink) => {
    setModalConfig({
      isOpen: true,
      title: `Restore Network Link: ${link.link_id}`,
      message: `Restore link ${link.link_id} to UP operational state? The routing engine will recalculate optimal primary paths and resolve associated alerts.`,
      confirmLabel: 'Restore Link (UP)',
      isDestructive: false,
      actionType: 'restore_link',
      targetId: link.link_id,
    });
  };

  const promptFailNode = (node: NetworkNode) => {
    setDrillReason('Simulated hardware power loss / disaster zone outage');
    setModalConfig({
      isOpen: true,
      title: `Take Node Offline: ${node.name} (${node.node_id})`,
      message: `Simulate an outage on ${node.node_id}? Connected links and transit traffic will dynamically reroute or flag destination reachability errors.`,
      confirmLabel: 'Simulate Outage',
      isDestructive: true,
      actionType: 'fail_node',
      targetId: node.node_id,
    });
  };

  const promptRestoreNode = (node: NetworkNode) => {
    setModalConfig({
      isOpen: true,
      title: `Restore Node: ${node.name} (${node.node_id})`,
      message: `Return ${node.node_id} to active operational status? Dynamic convergence will restore default shortest paths.`,
      confirmLabel: 'Restore to Active',
      isDestructive: false,
      actionType: 'restore_node',
      targetId: node.node_id,
    });
  };

  const promptResetBaseline = () => {
    setModalConfig({
      isOpen: true,
      title: 'Execute Controlled Baseline Network Reset',
      message: 'Restore all routers, switches, endpoints to ACTIVE and links to UP? Historical simulation runs and audit telemetry are strictly preserved.',
      confirmLabel: 'Reset Baseline',
      isDestructive: false,
      actionType: 'reset_baseline',
    });
  };

  // Modal Confirm Execution Handler
  const handleModalConfirm = async () => {
    try {
      setActionLoading(true);
      const { actionType, targetId } = modalConfig;

      if (actionType === 'fail_link' && targetId) {
        const res = await failLink(targetId, drillReason);
        setLastActionResult(res);
        setBaselineResetResult(null);
        setActiveBottomTab('recovery');
      } else if (actionType === 'restore_link' && targetId) {
        const res = await restoreLink(targetId);
        setLastActionResult(res);
        setBaselineResetResult(null);
        setActiveBottomTab('recovery');
      } else if (actionType === 'fail_node' && targetId) {
        const res = await failNode(targetId, drillReason);
        setLastActionResult(res);
        setBaselineResetResult(null);
        setActiveBottomTab('recovery');
      } else if (actionType === 'restore_node' && targetId) {
        const res = await restoreNode(targetId);
        setLastActionResult(res);
        setBaselineResetResult(null);
        setActiveBottomTab('recovery');
      } else if (actionType === 'reset_baseline') {
        const res = await resetBaseline();
        setBaselineResetResult(res);
        setLastActionResult(null);
        setActiveBottomTab('recovery');
      }

      await loadTopologyData();
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      alert(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Currently failed resources
  const failedLinks = useMemo(() => {
    return topology?.links.filter((l) => l.operational_state === 'DOWN') || [];
  }, [topology]);

  const offlineNodes = useMemo(() => {
    return topology?.nodes.filter((n) => n.status === 'offline') || [];
  }, [topology]);

  return (
    <div className="space-y-4">
      {/* Confirmation Dialog Modal */}
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        isDestructive={modalConfig.isDestructive}
        reasonValue={drillReason}
        onReasonChange={setDrillReason}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        loading={actionLoading}
      />

      {/* Top Header & Refresh Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <Activity className="w-5 h-5" />
            </div>
            Redundant Ring Network Topology
          </h1>
          <p className="text-xs sm:text-sm text-coastal-text-muted mt-1">
            OSPF-ready 4-router ring with cross alternate paths, 7 departmental subnets, switches and endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={promptResetBaseline}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text text-xs font-semibold shadow-coastal-sm transition-all"
            title="Controlled baseline network reset"
          >
            <RotateCcw className="w-4 h-4 text-coastal-cerulean" /> Baseline Reset
          </button>
          <button
            onClick={() => fitView({ padding: 0.2, duration: 600 })}
            className="flex items-center gap-1.5 px-3 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text text-xs font-semibold shadow-coastal-sm transition-all"
            title="Fit graph to canvas"
          >
            <Maximize2 className="w-4 h-4 text-coastal-cerulean" /> Fit View
          </button>
          <button
            onClick={loadTopologyData}
            className="flex items-center gap-1.5 p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text shadow-coastal-sm transition-all text-xs font-semibold"
            title="Reload from backend"
          >
            <RefreshCw className={`w-4 h-4 text-coastal-brown ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-coastal-critical/15 border border-coastal-critical/40 rounded-xl text-coastal-critical-text text-xs flex items-center gap-2 shadow-coastal-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Graph Canvas and Inspector Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[500px] lg:h-[540px]">
        {/* React Flow Canvas */}
        <div className="lg:col-span-3 bg-coastal-cream border border-coastal-border rounded-2xl overflow-hidden relative shadow-coastal-sm flex flex-col min-h-[420px] lg:min-h-0">
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

          {/* Color & Link Legend */}
          <div className="absolute bottom-4 left-4 bg-coastal-cream/95 border border-coastal-border rounded-xl p-2.5 text-xs text-coastal-text shadow-coastal-sm backdrop-blur-sm pointer-events-none max-w-[340px]">
            <span className="font-bold block mb-1.5 text-[10px] text-coastal-text-muted uppercase tracking-wider">
              Network Topology Legend
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
                <span>Mauve Secondary</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: coastalColors.critical }} />
                <span>Failed Link</span>
              </span>
            </div>
          </div>
        </div>

        {/* Node & Link Telemetry Inspector */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 flex flex-col justify-between shadow-coastal-sm overflow-y-auto">
          <div>
            <div className="flex items-center justify-between border-b border-coastal-border pb-2.5 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-coastal-cerulean" />
                {selectedNode
                  ? 'Node Inspector'
                  : selectedLink
                  ? 'Link Inspector'
                  : 'Element Details'}
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

            {/* Case 1: Node Selected */}
            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Device ID</span>
                  <span className="font-mono font-bold text-sm text-coastal-text">{selectedNode.node_id}</span>
                </div>

                <div>
                  <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Name / Facility</span>
                  <span className="font-semibold text-coastal-text">{selectedNode.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Category</span>
                    <span className="capitalize text-coastal-text font-medium">{selectedNode.node_type}</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Status</span>
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
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">IPv4 Address</span>
                    <span className="font-mono text-coastal-text font-semibold">{selectedNode.ip_address}</span>
                  </div>
                )}

                {selectedNode.department && (
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Department</span>
                    <span className="text-coastal-text font-medium">{selectedNode.department}</span>
                  </div>
                )}

                {/* Battery reserve */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-coastal-text-muted text-[10px] font-semibold uppercase">Battery Reserve</span>
                    <span className="font-mono text-[11px] font-semibold">{selectedNode.battery_level}%</span>
                  </div>
                  <div className="w-full bg-coastal-cream-dark rounded h-2 border border-coastal-border overflow-hidden">
                    <div
                      className="h-2 rounded transition-all duration-300"
                      style={{
                        width: `${selectedNode.battery_level}%`,
                        backgroundColor:
                          selectedNode.battery_level > 50
                            ? coastalColors.safe
                            : coastalColors.critical,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() =>
                      selectedNode.status === 'offline'
                        ? promptRestoreNode(selectedNode)
                        : promptFailNode(selectedNode)
                    }
                    disabled={actionLoading}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-1.5 transition-all shadow-coastal-sm cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedNode.status === 'offline'
                        ? 'bg-coastal-safe/40 hover:bg-coastal-safe/60 border-coastal-safe-border text-coastal-safe-text'
                        : 'bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark border-coastal-dusty-rose text-white'
                    }`}
                  >
                    {selectedNode.status === 'offline' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" /> Restore Node
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-white" /> Simulate Node Failure
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : selectedLink ? (
              /* Case 2: Link Selected */
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Link ID</span>
                  <span className="font-mono font-bold text-sm text-coastal-text">{selectedLink.link_id}</span>
                </div>

                <div className="p-2.5 bg-coastal-powder/40 rounded-xl border border-coastal-border space-y-1">
                  <div className="text-[10px] text-coastal-text-muted uppercase font-semibold">Connection Endpoints</div>
                  <div className="font-mono font-semibold text-coastal-text">
                    {selectedLink.source_node_id} ➔ {selectedLink.destination_node_id}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Link Class</span>
                    <span className="capitalize font-semibold text-coastal-text">{selectedLink.link_type}</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Operational State</span>
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
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Bandwidth</span>
                    <span className="font-mono text-coastal-text font-medium">{selectedLink.bandwidth} Mbps</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] font-semibold uppercase">Latency</span>
                    <span className="font-mono text-coastal-text font-medium">{selectedLink.latency} ms</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() =>
                      selectedLink.operational_state === 'DOWN'
                        ? promptRestoreLink(selectedLink)
                        : promptFailLink(selectedLink)
                    }
                    disabled={actionLoading}
                    className={`w-full py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-1.5 transition-all shadow-coastal-sm cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedLink.operational_state === 'DOWN'
                        ? 'bg-coastal-safe/40 hover:bg-coastal-safe/60 border-coastal-safe-border text-coastal-safe-text'
                        : 'bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark border-coastal-dusty-rose text-white'
                    }`}
                  >
                    {selectedLink.operational_state === 'DOWN' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" /> Restore Link (UP)
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-white" /> Sever Link (DOWN)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: Nothing Selected */
              <div className="text-center py-10 px-2 text-coastal-text-muted">
                <AlertTriangle className="w-8 h-8 text-coastal-mauve/70 mx-auto mb-2" />
                <p className="text-xs font-medium">
                  Select any node or link on the canvas to inspect telemetry, IP addresses, or simulate outages with confirmation.
                </p>
              </div>
            )}
          </div>

          {/* Departmental Subnets Summary Box */}
          {topology?.subnets && topology.subnets.length > 0 && (
            <div className="mt-4 pt-3 border-t border-coastal-border text-[11px]">
              <span className="font-bold text-coastal-text-muted block mb-1.5 uppercase text-[10px]">
                Departmental Subnets ({topology.subnets.length})
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {topology.subnets.slice(0, 5).map((s) => (
                  <div key={s.code} className="flex items-center justify-between text-coastal-text">
                    <span className="truncate max-w-[110px]">{s.department}:</span>
                    <span className="font-mono text-[10px] text-coastal-cerulean font-semibold">{s.subnet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Prompt 8 Workflow Widgets ---------------- */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl shadow-coastal-sm p-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-coastal-border pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveBottomTab('recovery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeBottomTab === 'recovery'
                  ? 'bg-coastal-powder text-coastal-cerulean border border-coastal-border shadow-coastal-sm'
                  : 'text-coastal-text-muted hover:text-coastal-text'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Failover & Recovery Metrics
            </button>
            <button
              onClick={() => setActiveBottomTab('reachability')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeBottomTab === 'reachability'
                  ? 'bg-coastal-powder text-coastal-cerulean border border-coastal-border shadow-coastal-sm'
                  : 'text-coastal-text-muted hover:text-coastal-text'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Department Reachability Matrix
            </button>
            <button
              onClick={() => setActiveBottomTab('outages')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeBottomTab === 'outages'
                  ? 'bg-coastal-powder text-coastal-cerulean border border-coastal-border shadow-coastal-sm'
                  : 'text-coastal-text-muted hover:text-coastal-text'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Failed Resources ({failedLinks.length + offlineNodes.length})
            </button>
            <button
              onClick={() => setActiveBottomTab('events')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeBottomTab === 'events'
                  ? 'bg-coastal-powder text-coastal-cerulean border border-coastal-border shadow-coastal-sm'
                  : 'text-coastal-text-muted hover:text-coastal-text'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Telemetry Event History
            </button>
          </div>

          {reachabilityData && (
            <div className="flex items-center gap-2 text-xs font-semibold text-coastal-text">
              <span className="text-coastal-text-muted">Network Reachability:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                  reachabilityData.reachability_percentage >= 100
                    ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                    : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                }`}
              >
                {reachabilityData.reachability_percentage}%
              </span>
            </div>
          )}
        </div>

        {/* Tab 1: Failover & Recovery Metrics */}
        {activeBottomTab === 'recovery' && (
          <div className="space-y-4">
            {baselineResetResult && (
              <div className="p-3 bg-coastal-safe/25 border border-coastal-safe/60 rounded-xl text-xs text-coastal-text flex items-start gap-2.5 shadow-coastal-sm">
                <CheckCircle2 className="w-4 h-4 text-coastal-safe-text flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{baselineResetResult.message}</div>
                  <div className="text-[11px] text-coastal-text-muted mt-1">
                    Restored {baselineResetResult.restored_nodes_count} nodes, {baselineResetResult.restored_links_count} links. Resolved {baselineResetResult.resolved_alerts_count} alerts. Preserved {baselineResetResult.historical_runs_preserved} historical simulation runs and {baselineResetResult.historical_events_preserved} telemetry events.
                  </div>
                </div>
              </div>
            )}

            {lastActionResult ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Before vs After Paths */}
                <div className="p-3.5 bg-coastal-cream-dark/40 border border-coastal-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-coastal-text flex items-center gap-1.5">
                      <RouteCcwIcon className="w-3.5 h-3.5 text-coastal-cerulean" /> Route Path Adaptation
                    </span>
                    {lastActionResult.alternate_path_selected && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-coastal-mauve/20 text-coastal-mauve border border-coastal-mauve/30">
                        Alternate Path Active
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block mb-1">
                      Path Before Event
                    </span>
                    <div className="flex items-center gap-1 flex-wrap font-mono text-[11px] text-coastal-text p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                      {lastActionResult.before_path && lastActionResult.before_path.length > 0 ? (
                        lastActionResult.before_path.map((node, i) => (
                          <React.Fragment key={node}>
                            <span className="font-bold">{node}</span>
                            {i < (lastActionResult.before_path?.length || 0) - 1 && (
                              <ArrowRight className="w-3 h-3 text-coastal-text-muted" />
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="text-coastal-text-muted italic">None recorded</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-coastal-text-muted uppercase block mb-1">
                      Path After Event
                    </span>
                    <div className="flex items-center gap-1 flex-wrap font-mono text-[11px] text-coastal-text p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                      {lastActionResult.after_path && lastActionResult.after_path.length > 0 ? (
                        lastActionResult.after_path.map((node, i) => (
                          <React.Fragment key={node}>
                            <span className="font-bold text-coastal-cerulean">{node}</span>
                            {i < (lastActionResult.after_path?.length || 0) - 1 && (
                              <ArrowRight className="w-3 h-3 text-coastal-text-muted" />
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="text-coastal-critical font-bold">Destination Unreachable (No Route)</span>
                      )}
                    </div>
                  </div>

                  {lastActionResult.route_changes.length > 0 && (
                    <div className="pt-1 text-[11px] text-coastal-text-muted space-y-0.5">
                      <span className="font-semibold block text-coastal-text text-[10px] uppercase">
                        Route Change Log:
                      </span>
                      {lastActionResult.route_changes.map((ch, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-coastal-cerulean">•</span>
                          <span>{ch}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Card: Modeled Timing System Breakdown */}
                {lastActionResult.recovery_metrics && (
                  <div className="p-3.5 bg-coastal-cream-dark/40 border border-coastal-border rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-coastal-text flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-coastal-brown" /> Modeled Recovery Timing System
                      </span>
                      <span className="font-mono text-xs font-bold text-coastal-cerulean">
                        {lastActionResult.recovery_metrics.total_recovery_duration_sec}s
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                        <span className="text-[10px] text-coastal-text-muted font-semibold block">BFD Failure Detect</span>
                        <span className="font-mono font-bold text-coastal-text">
                          {lastActionResult.recovery_metrics.detection_delay_ms} ms
                        </span>
                        <span className="text-[9px] text-coastal-text-muted block mt-0.5">(3x 15ms keepalive)</span>
                      </div>

                      <div className="p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                        <span className="text-[10px] text-coastal-text-muted font-semibold block">Dijkstra SPF Timer</span>
                        <span className="font-mono font-bold text-coastal-text">
                          {lastActionResult.recovery_metrics.spf_calculation_ms} ms
                        </span>
                        <span className="text-[9px] text-coastal-text-muted block mt-0.5">(Measured execution)</span>
                      </div>

                      <div className="p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                        <span className="text-[10px] text-coastal-text-muted font-semibold block">Hardware FIB Update</span>
                        <span className="font-mono font-bold text-coastal-text">
                          {lastActionResult.recovery_metrics.fib_update_ms} ms
                        </span>
                        <span className="text-[9px] text-coastal-text-muted block mt-0.5">(Hardware distribution)</span>
                      </div>

                      <div className="p-2 bg-coastal-cream rounded-lg border border-coastal-border">
                        <span className="text-[10px] text-coastal-text-muted font-semibold block">Path Propagation</span>
                        <span className="font-mono font-bold text-coastal-text">
                          {lastActionResult.recovery_metrics.propagation_delay_ms} ms
                        </span>
                        <span className="text-[9px] text-coastal-text-muted block mt-0.5">(Hop latencies)</span>
                      </div>
                    </div>

                    <div className="pt-1 text-[10px] text-coastal-text-muted flex items-center justify-between border-t border-coastal-border">
                      <span>Model Specification:</span>
                      <span className="font-mono text-coastal-text font-semibold">
                        {lastActionResult.recovery_metrics.timing_model}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-coastal-text-muted">
                <Info className="w-5 h-5 text-coastal-cerulean mx-auto mb-1.5" />
                Select any link or router above and trigger a failure simulation to view before-and-after path adaptations and modeled recovery timing.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Department Reachability Matrix */}
        {activeBottomTab === 'reachability' && (
          <div className="space-y-3">
            {reachabilityData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                {Object.entries(reachabilityData.destinations).map(([destId, dest]) => (
                  <div
                    key={destId}
                    className={`p-3 rounded-xl border transition-all ${
                      dest.reachable
                        ? 'bg-coastal-cream border-coastal-border'
                        : 'bg-coastal-critical/15 border-coastal-critical/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-coastal-text truncate max-w-[120px]" title={destId}>
                        {destId}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          dest.reachable
                            ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                            : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
                        }`}
                      >
                        {dest.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-coastal-text truncate mb-1" title={dest.name}>
                      {dest.name}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-coastal-text-muted border-t border-coastal-border/60 pt-1">
                      <span>{dest.hops} hops</span>
                      <span className="font-mono font-semibold">
                        Cost: {dest.cost !== null ? dest.cost : '∞'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-coastal-text-muted">
                Loading reachability matrix...
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Failed Resources List */}
        {activeBottomTab === 'outages' && (
          <div className="space-y-3">
            {failedLinks.length === 0 && offlineNodes.length === 0 ? (
              <div className="text-center py-6 text-xs text-coastal-text flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" />
                <span>All network links and routers are fully operational. Zero active outages.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {offlineNodes.map((n) => (
                  <div
                    key={n.node_id}
                    className="p-3 bg-coastal-critical/15 border border-coastal-critical/40 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <XCircle className="w-4 h-4 text-coastal-critical flex-shrink-0" />
                      <div>
                        <span className="font-mono font-bold text-coastal-text">{n.node_id}</span>
                        <span className="text-coastal-text-muted ml-2">({n.name}) — OFFLINE</span>
                      </div>
                    </div>
                    <button
                      onClick={() => promptRestoreNode(n)}
                      disabled={actionLoading}
                      className="px-3 py-1 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-lg text-xs font-semibold text-coastal-text shadow-coastal-sm"
                    >
                      Restore Node
                    </button>
                  </div>
                ))}

                {failedLinks.map((l) => (
                  <div
                    key={l.link_id}
                    className="p-3 bg-coastal-critical/15 border border-coastal-critical/40 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-coastal-critical flex-shrink-0" />
                      <div>
                        <span className="font-mono font-bold text-coastal-text">{l.link_id}</span>
                        <span className="text-coastal-text-muted ml-2">
                          ({l.source_node_id} ➔ {l.destination_node_id}) — SEVERED (DOWN)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => promptRestoreLink(l)}
                      disabled={actionLoading}
                      className="px-3 py-1 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-lg text-xs font-semibold text-coastal-text shadow-coastal-sm"
                    >
                      Restore Link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Event Telemetry History */}
        {activeBottomTab === 'events' && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {recentEvents.length > 0 ? (
              recentEvents.map((evt) => (
                <div
                  key={evt.event_id}
                  className="p-2.5 bg-coastal-cream rounded-xl border border-coastal-border text-xs flex items-center justify-between gap-3 shadow-coastal-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-coastal-critical/20 text-coastal-critical-text border border-coastal-critical-border'
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
                  <span className="font-mono text-[10px] text-coastal-text-muted flex-shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-coastal-text-muted">
                No recent telemetry events logged yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RouteCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a4.5 4.5 0 0 0 0-9H5" />
    <polyline points="8 6 4 10 8 14" />
  </svg>
);

export const NetworkTopologyPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <TopologyFlowContent />
    </ReactFlowProvider>
  );
};

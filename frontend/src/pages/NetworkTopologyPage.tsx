import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  applyNodeChanges,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Activity,
  Plus,
  RefreshCw,
  Battery,
  AlertCircle,
} from 'lucide-react';
import { NetworkNode } from '../types';
import { fetchNodes, updateNode, createNode } from '../api/nodes';
import { coastalColors } from '../theme/tokens';

export const NetworkTopologyPage: React.FC = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  // New Node Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<string>('relay');
  const [newBattery, setNewBattery] = useState<number>(100);

  const loadNodes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNodes();
      setNodes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching topology nodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // Convert NetworkNode array to ReactFlow Nodes using Coastal Pastel design
  const flowNodes: Node[] = useMemo(() => {
    return nodes.map((node) => {
      const isOffline = node.status === 'offline';
      const isDegraded = node.status === 'degraded';

      let bgClass = 'bg-coastal-cream border-coastal-border text-coastal-text';
      let badgeClass = 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe';

      if (isOffline) {
        bgClass = 'bg-coastal-critical/15 border-coastal-critical/50 text-coastal-critical-text';
        badgeClass = 'bg-coastal-critical/25 text-coastal-critical-text border-coastal-critical';
      } else if (isDegraded) {
        bgClass = 'bg-coastal-warning/15 border-coastal-warning/50 text-coastal-warning-text';
        badgeClass = 'bg-coastal-warning/25 text-coastal-warning-text border-coastal-warning';
      }

      return {
        id: node.node_id,
        position: { x: node.pos_x, y: node.pos_y },
        data: {
          label: (
            <div className={`p-3.5 rounded-2xl border shadow-coastal-md min-w-[160px] ${bgClass}`}>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="font-mono text-coastal-text">{node.node_id}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${badgeClass}`}
                >
                  {node.status}
                </span>
              </div>
              <div className="text-xs font-bold truncate mb-2 text-coastal-text">{node.name}</div>
              <div className="flex items-center justify-between text-[11px] text-coastal-text-muted">
                <span className="capitalize font-medium">{node.node_type}</span>
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Battery className="w-3.5 h-3.5 text-coastal-brown" />
                  {node.battery_level}%
                </span>
              </div>
            </div>
          ),
          raw: node,
        },
      };
    });
  }, [nodes]);

  // Generate communication edges based on Euclidean distance (< 350 units)
  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const MAX_RANGE = 350;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i];
        const v = nodes[j];
        const dist = Math.hypot(u.pos_x - v.pos_x, u.pos_y - v.pos_y);

        if (dist <= MAX_RANGE) {
          const bothActive = u.status === 'active' && v.status === 'active';
          const anyOffline = u.status === 'offline' || v.status === 'offline';

          const strokeColor = anyOffline
            ? coastalColors.critical
            : bothActive
            ? coastalColors.mutedCerulean
            : coastalColors.warning;

          edges.push({
            id: `edge-${u.node_id}-${v.node_id}`,
            source: u.node_id,
            target: v.node_id,
            animated: bothActive,
            style: {
              stroke: strokeColor,
              strokeWidth: 2,
              strokeDasharray: anyOffline ? '5 5' : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: strokeColor,
            },
          });
        }
      }
    }
    return edges;
  }, [nodes]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const raw = (node.data as { raw: NetworkNode }).raw;
    setSelectedNode(raw);
  };

  const handleStatusChange = async (newStatus: 'active' | 'degraded' | 'offline') => {
    if (!selectedNode) return;
    try {
      const updated = await updateNode(selectedNode.node_id, { status: newStatus });
      setSelectedNode(updated);
      setNodes((prev) =>
        prev.map((n) => (n.node_id === updated.node_id ? updated : n)),
      );
    } catch (err) {
      alert(`Failed to update status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;

    try {
      const randomX = Math.floor(Math.random() * 400) + 100;
      const randomY = Math.floor(Math.random() * 300) + 80;

      const created = await createNode({
        node_id: newId.trim().toUpperCase(),
        name: newName.trim(),
        node_type: newType,
        status: 'active',
        battery_level: Number(newBattery),
        pos_x: randomX,
        pos_y: randomY,
      });

      setNodes((prev) => [...prev, created]);
      setShowAddModal(false);
      setNewId('');
      setNewName('');
    } catch (err) {
      alert(`Error creating node: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const [activeFlowNodes, setActiveFlowNodes] = useState<Node[]>(flowNodes);
  useEffect(() => {
    setActiveFlowNodes(flowNodes);
  }, [flowNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setActiveFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <Activity className="w-5 h-5" />
            </div>
            Ad-Hoc Disaster Mesh Topology
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Interactive network graph showing decentralized nodes, status conditions, and direct peer links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white text-xs font-semibold rounded-xl shadow-coastal-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add Node
          </button>
          <button
            onClick={loadNodes}
            className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text shadow-coastal-sm transition-all"
            title="Refresh Nodes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-coastal-critical/15 border border-coastal-critical/40 rounded-xl text-coastal-critical-text text-xs flex items-center gap-2 shadow-coastal-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Main Flow Canvas and Node Details Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
        <div className="lg:col-span-3 bg-coastal-cream border border-coastal-border rounded-2xl overflow-hidden relative shadow-coastal-sm">
          <ReactFlow
            nodes={activeFlowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color={coastalColors.borderDark} gap={24} size={1} />
            <Controls />
          </ReactFlow>

          <div className="absolute top-4 left-4 bg-coastal-cream/95 border border-coastal-border rounded-xl p-3 text-xs text-coastal-text shadow-coastal-sm backdrop-blur-sm pointer-events-none">
            <span className="font-bold block mb-1 text-[11px] text-coastal-text-muted uppercase tracking-wider">
              Link Status Legend:
            </span>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coastalColors.mutedCerulean }} />
                <span>Active Link</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coastalColors.warning }} />
                <span>Degraded</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coastalColors.critical }} />
                <span>Severed</span>
              </span>
            </div>
          </div>
        </div>

        {/* Node Inspector Sidebar */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 flex flex-col justify-between shadow-coastal-sm">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted mb-4 border-b border-coastal-border pb-2.5">
              Node Telemetry
            </h2>
            {selectedNode ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-coastal-text-muted block mb-0.5 font-medium">Node ID</span>
                  <span className="font-mono font-bold text-sm text-coastal-text">
                    {selectedNode.node_id}
                  </span>
                </div>
                <div>
                  <span className="text-coastal-text-muted block mb-0.5 font-medium">Designation</span>
                  <span className="font-semibold text-coastal-text">{selectedNode.name}</span>
                </div>
                <div>
                  <span className="text-coastal-text-muted block mb-0.5 font-medium">Facility Type</span>
                  <span className="capitalize text-coastal-text font-medium">{selectedNode.node_type}</span>
                </div>
                <div>
                  <span className="text-coastal-text-muted block mb-1 font-medium">Battery Reserve</span>
                  <div className="w-full bg-coastal-cream-dark rounded-full h-2.5 border border-coastal-border overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${selectedNode.battery_level}%`,
                        backgroundColor:
                          selectedNode.battery_level > 50
                            ? coastalColors.safe
                            : selectedNode.battery_level > 20
                            ? coastalColors.warning
                            : coastalColors.critical,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-coastal-text-muted mt-1 inline-block font-mono">
                    {selectedNode.battery_level}% Available
                  </span>
                </div>

                <div className="pt-3 border-t border-coastal-border">
                  <span className="text-coastal-text-muted block mb-2 font-bold text-[11px] uppercase tracking-wider">
                    Simulate Outage / Condition:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleStatusChange('active')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                        selectedNode.status === 'active'
                          ? 'bg-coastal-safe/40 text-coastal-safe-text border-coastal-safe shadow-coastal-sm'
                          : 'bg-coastal-cream border-coastal-border text-coastal-text-muted hover:bg-coastal-powder'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => handleStatusChange('degraded')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                        selectedNode.status === 'degraded'
                          ? 'bg-coastal-warning/40 text-coastal-warning-text border-coastal-warning shadow-coastal-sm'
                          : 'bg-coastal-cream border-coastal-border text-coastal-text-muted hover:bg-coastal-powder'
                      }`}
                    >
                      Degraded
                    </button>
                    <button
                      onClick={() => handleStatusChange('offline')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                        selectedNode.status === 'offline'
                          ? 'bg-coastal-critical/30 text-coastal-critical-text border-coastal-critical shadow-coastal-sm'
                          : 'bg-coastal-cream border-coastal-border text-coastal-text-muted hover:bg-coastal-powder'
                      }`}
                    >
                      Offline
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-coastal-text-muted text-xs">
                Click any node on the graph canvas to inspect parameters and simulate outages.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-coastal-border text-[11px] text-coastal-text-muted font-medium">
            Total active links: {flowEdges.length} peer channels
          </div>
        </div>
      </div>

      {/* Add Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-coastal-text/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl max-w-md w-full p-6 shadow-coastal-lg">
            <h3 className="text-lg font-bold text-coastal-text mb-4">Register New Mesh Node</h3>
            <form onSubmit={handleCreateNode} className="space-y-4 text-xs">
              <div>
                <label className="block text-coastal-text mb-1 font-semibold">Node ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHELTER-WEST-06"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text placeholder:text-coastal-text-muted focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
                />
              </div>
              <div>
                <label className="block text-coastal-text mb-1 font-semibold">Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Coast Outpost"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text placeholder:text-coastal-text-muted focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
                />
              </div>
              <div>
                <label className="block text-coastal-text mb-1 font-semibold">Role / Facility</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
                >
                  <option value="relay">Relay Station</option>
                  <option value="hospital">Hospital Triage</option>
                  <option value="shelter">Evacuation Shelter</option>
                  <option value="command_center">Command Center</option>
                  <option value="field_unit">Mobile Field Unit</option>
                </select>
              </div>
              <div>
                <label className="block text-coastal-text mb-1 font-semibold">
                  Initial Battery Level ({newBattery}%)
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={newBattery}
                  onChange={(e) => setNewBattery(Number(e.target.value))}
                  className="w-full accent-coastal-cerulean"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-coastal-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-coastal-cream hover:bg-coastal-powder text-coastal-text rounded-xl border border-coastal-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white font-medium rounded-xl shadow-coastal-sm"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

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

  // Convert NetworkNode array to ReactFlow Nodes
  const flowNodes: Node[] = useMemo(() => {
    return nodes.map((node) => {
      const isOffline = node.status === 'offline';
      const isDegraded = node.status === 'degraded';

      let bgClass = 'bg-slate-900 border-slate-700';
      if (isOffline) bgClass = 'bg-rose-950/80 border-rose-600 text-rose-200';
      else if (isDegraded) bgClass = 'bg-amber-950/80 border-amber-600 text-amber-200';
      else bgClass = 'bg-slate-900 border-blue-500/60 text-slate-100';

      return {
        id: node.node_id,
        position: { x: node.pos_x, y: node.pos_y },
        data: {
          label: (
            <div className={`p-3 rounded-lg border shadow-lg min-w-[150px] ${bgClass}`}>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="font-mono">{node.node_id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    isOffline
                      ? 'bg-rose-500/20 text-rose-400'
                      : isDegraded
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {node.status}
                </span>
              </div>
              <div className="text-xs font-bold truncate mb-2">{node.name}</div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="capitalize">{node.node_type}</span>
                <span className="flex items-center gap-1 font-mono">
                  <Battery className="w-3 h-3 text-amber-400" />
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

          edges.push({
            id: `edge-${u.node_id}-${v.node_id}`,
            source: u.node_id,
            target: v.node_id,
            animated: bothActive,
            style: {
              stroke: anyOffline ? '#ef4444' : bothActive ? '#3b82f6' : '#f59e0b',
              strokeWidth: 2,
              strokeDasharray: anyOffline ? '4 4' : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: anyOffline ? '#ef4444' : bothActive ? '#3b82f6' : '#f59e0b',
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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Ad-Hoc Disaster Mesh Topology
          </h1>
          <p className="text-sm text-slate-400">
            Interactive network graph showing decentralized nodes, status conditions, and direct peer links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Node
          </button>
          <button
            onClick={loadNodes}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
            title="Refresh Nodes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Main Flow Canvas and Node Details Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
          <ReactFlow
            nodes={activeFlowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls className="bg-slate-800 border-slate-700 text-slate-200 fill-slate-200" />
          </ReactFlow>

          <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 backdrop-blur-sm pointer-events-none">
            <span className="font-semibold block mb-1">Legend:</span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full" />
              <span>Active Link</span>
              <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full ml-2" />
              <span>Degraded</span>
              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full ml-2" />
              <span>Severed</span>
            </div>
          </div>
        </div>

        {/* Node Inspector Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 border-b border-slate-800 pb-2">
              Node Telemetry
            </h2>
            {selectedNode ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Node ID</span>
                  <span className="font-mono font-bold text-sm text-white">
                    {selectedNode.node_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Designation</span>
                  <span className="font-semibold text-slate-200">{selectedNode.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Facility Type</span>
                  <span className="capitalize text-slate-300">{selectedNode.node_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Battery Reserve</span>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        selectedNode.battery_level > 50
                          ? 'bg-emerald-500'
                          : selectedNode.battery_level > 20
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${selectedNode.battery_level}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 inline-block">
                    {selectedNode.battery_level}% Available
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <span className="text-slate-400 block mb-2 font-medium">
                    Simulate Field State:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleStatusChange('active')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-colors ${
                        selectedNode.status === 'active'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => handleStatusChange('degraded')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-colors ${
                        selectedNode.status === 'degraded'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Degraded
                    </button>
                    <button
                      onClick={() => handleStatusChange('offline')}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-colors ${
                        selectedNode.status === 'offline'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Offline
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                Click any node on the graph canvas to inspect parameters and simulate outages.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            Total active links: {flowEdges.length} peer channels
          </div>
        </div>
      </div>

      {/* Add Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Register New Mesh Node</h3>
            <form onSubmit={handleCreateNode} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Node ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHELTER-WEST-06"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Coast Outpost"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Role / Facility</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="relay">Relay Station</option>
                  <option value="hospital">Hospital Triage</option>
                  <option value="shelter">Evacuation Shelter</option>
                  <option value="command_center">Command Center</option>
                  <option value="field_unit">Mobile Field Unit</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Initial Battery Level ({newBattery}%)
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={newBattery}
                  onChange={(e) => setNewBattery(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
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

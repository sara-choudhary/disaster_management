import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import {
  NetworkNode,
  MessagePriority,
  SimulationRunResponse,
  EmergencyMessage,
} from '../types';
import { fetchNodes } from '../api/nodes';
import { runRoutingSimulation, fetchDispatchedMessages } from '../api/simulation';

export const SimulationPage: React.FC = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [sourceId, setSourceId] = useState<string>('HQ-COMMAND-01');
  const [targetId, setTargetId] = useState<string>('HOSPITAL-TRIAGE-03');
  const [priority, setPriority] = useState<MessagePriority>('CRITICAL_SOS');
  const [content, setContent] = useState<string>(
    'Urgent medical resupply requested. High casualties reported at sector B.',
  );
  const [failedNodes, setFailedNodes] = useState<string[]>([]);
  const [simResult, setSimResult] = useState<SimulationRunResponse | null>(null);
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [nodeList, msgList] = await Promise.all([
          fetchNodes(),
          fetchDispatchedMessages(10),
        ]);
        setNodes(nodeList);
        setMessages(msgList);
        if (nodeList.length >= 2) {
          setSourceId(nodeList[0].node_id);
          setTargetId(nodeList[nodeList.length - 1].node_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading simulation data');
      }
    }
    init();
  }, []);

  const handleToggleFailure = (nodeId: string) => {
    setFailedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    );
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId) return;

    try {
      setLoading(true);
      setError(null);
      const res = await runRoutingSimulation({
        source_node_id: sourceId,
        target_node_id: targetId,
        priority,
        message_content: content,
        simulate_node_failures: failedNodes,
      });
      setSimResult(res);
      // Refresh message history
      const updatedMessages = await fetchDispatchedMessages(10);
      setMessages(updatedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Send className="w-6 h-6 text-red-500" />
          Deterministic Priority Packet Router
        </h1>
        <p className="text-sm text-slate-400">
          Simulate fault-tolerant packet dispatch with priority queue preemption across degraded ad-hoc nodes.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation Controls Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-1 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            Dispatch Configuration
          </h2>

          <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Source Node</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {nodes.map((n) => (
                  <option key={n.node_id} value={n.node_id}>
                    {n.node_id} - {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Target Node</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {nodes.map((n) => (
                  <option key={n.node_id} value={n.node_id}>
                    {n.node_id} - {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Priority Class</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CRITICAL_SOS', label: 'Critical SOS', color: 'border-red-600' },
                  { id: 'HIGH_MEDICAL', label: 'High Medical', color: 'border-orange-500' },
                  { id: 'NORMAL_LOGISTICS', label: 'Logistics', color: 'border-blue-500' },
                  { id: 'LOW_ROUTINE', label: 'Routine Ping', color: 'border-emerald-500' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriority(item.id as MessagePriority)}
                    className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-colors ${
                      priority === item.id
                        ? `bg-slate-800 text-white ${item.color} border-2`
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Message Payload</label>
              <textarea
                rows={3}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">
                Simulate Damaged / Severed Nodes:
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {nodes.map((n) => (
                  <label
                    key={n.node_id}
                    className="flex items-center gap-2 text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={failedNodes.includes(n.node_id)}
                      onChange={() => handleToggleFailure(n.node_id)}
                      className="rounded accent-red-500"
                    />
                    <span className="truncate">{n.node_id}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Routing Packet...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Run Deterministic Routing
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output & Path Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4">
              Routing Simulation Outcome
            </h2>

            {simResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    simResult.success
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {simResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {simResult.success ? 'Message Delivered' : 'Delivery Dropped / No Route'}
                      </div>
                      <div className="text-xs opacity-80">
                        Simulation ID: {simResult.simulation_id} • Packet:{' '}
                        {simResult.message_id}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="block font-mono font-bold text-white">
                      {simResult.total_hops} Hops
                    </span>
                    <span className="opacity-80 font-mono">
                      {simResult.total_latency_ms} ms latency
                    </span>
                  </div>
                </div>

                {/* Path Visualizer */}
                {simResult.path.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Computed Dijkstra Trajectory:
                    </span>
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
                      {simResult.path.map((nodeId, idx) => (
                        <React.Fragment key={nodeId}>
                          <span className="px-2.5 py-1 bg-blue-950 text-blue-300 border border-blue-800 rounded font-bold">
                            {nodeId}
                          </span>
                          {idx < simResult.path.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hop Breakdown Table */}
                {simResult.details.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Hop-by-Hop Link Diagnostics
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="pb-2">Step</th>
                            <th className="pb-2">From Node</th>
                            <th className="pb-2">To Node</th>
                            <th className="pb-2">Hop Latency</th>
                            <th className="pb-2">Target Battery</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {simResult.details.map((hop) => (
                            <tr key={hop.step}>
                              <td className="py-2 text-slate-400">#{hop.step}</td>
                              <td className="py-2 text-slate-200">{hop.from_node}</td>
                              <td className="py-2 text-slate-200">{hop.to_node}</td>
                              <td className="py-2 text-emerald-400">{hop.latency_ms} ms</td>
                              <td className="py-2 text-amber-400">{hop.remaining_battery}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                Configure source, target, and priority class on the left, then click "Run Deterministic Routing" to observe the calculated route.
              </div>
            )}
          </div>

          {/* Historical Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Transmission Log History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Payload Preview</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 text-slate-400 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2">
                        <span className="font-semibold text-[11px] text-blue-400 font-mono">
                          {m.priority}
                        </span>
                      </td>
                      <td className="py-2 text-slate-300 truncate max-w-xs">{m.content}</td>
                      <td className="py-2">
                        <span
                          className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                            m.status === 'DELIVERED'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

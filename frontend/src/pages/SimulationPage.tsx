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
        <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
          <div className="p-2 bg-coastal-rose/20 text-coastal-rose rounded-xl border border-coastal-rose/30">
            <Send className="w-5 h-5" />
          </div>
          Deterministic Priority Packet Router
        </h1>
        <p className="text-sm text-coastal-text-muted mt-1">
          Simulate fault-tolerant packet dispatch with priority queue preemption across degraded ad-hoc nodes.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical/40 rounded-2xl text-coastal-critical-text text-xs flex items-center gap-2 shadow-coastal-sm">
          <ShieldAlert className="w-4 h-4 text-coastal-critical shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation Controls Form */}
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 lg:col-span-1 space-y-4 shadow-coastal-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted border-b border-coastal-border pb-2.5">
            Dispatch Configuration
          </h2>

          <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
            <div>
              <label className="block text-coastal-text mb-1 font-semibold">Source Node</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
              >
                {nodes.map((n) => (
                  <option key={n.node_id} value={n.node_id}>
                    {n.node_id} - {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-coastal-text mb-1 font-semibold">Target Node</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
              >
                {nodes.map((n) => (
                  <option key={n.node_id} value={n.node_id}>
                    {n.node_id} - {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-coastal-text mb-1 font-semibold">Priority Class</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'CRITICAL_SOS',
                    label: 'Critical SOS',
                    activeStyle: 'border-coastal-critical bg-coastal-critical/15 text-coastal-critical-text',
                  },
                  {
                    id: 'HIGH_MEDICAL',
                    label: 'High Medical',
                    activeStyle: 'border-coastal-suspicious bg-coastal-suspicious/15 text-coastal-suspicious-text',
                  },
                  {
                    id: 'NORMAL_LOGISTICS',
                    label: 'Logistics',
                    activeStyle: 'border-coastal-cerulean bg-coastal-powder text-coastal-text',
                  },
                  {
                    id: 'LOW_ROUTINE',
                    label: 'Routine Ping',
                    activeStyle: 'border-coastal-safe bg-coastal-safe/25 text-coastal-safe-text',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriority(item.id as MessagePriority)}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      priority === item.id
                        ? `${item.activeStyle} border-2 shadow-coastal-sm`
                        : 'border-coastal-border bg-coastal-cream-dark/50 text-coastal-text-muted hover:bg-coastal-powder'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-coastal-text mb-1 font-semibold">Message Payload</label>
              <textarea
                rows={3}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-coastal-cream-dark border border-coastal-border rounded-xl px-3 py-2 text-coastal-text placeholder:text-coastal-text-muted focus:outline-none focus:border-coastal-cerulean shadow-coastal-sm"
              />
            </div>

            <div>
              <label className="block text-coastal-text mb-1 font-semibold">
                Simulate Damaged / Severed Nodes:
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 bg-coastal-cream-dark/40 p-2 rounded-xl border border-coastal-border">
                {nodes.map((n) => (
                  <label
                    key={n.node_id}
                    className="flex items-center gap-2 text-coastal-text cursor-pointer p-1.5 rounded-lg hover:bg-coastal-powder/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={failedNodes.includes(n.node_id)}
                      onChange={() => handleToggleFailure(n.node_id)}
                      className="rounded accent-coastal-rose"
                    />
                    <span className="truncate font-mono text-[11px] font-medium">{n.node_id}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-coastal-rose hover:bg-coastal-rose/90 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-coastal-sm flex items-center justify-center gap-2"
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
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted mb-4">
              Routing Simulation Outcome
            </h2>

            {simResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between shadow-coastal-sm ${
                    simResult.success
                      ? 'bg-coastal-safe/25 border-coastal-safe text-coastal-safe-text'
                      : 'bg-coastal-critical/20 border-coastal-critical text-coastal-critical-text'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {simResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-coastal-safe-text shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-coastal-critical shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {simResult.success ? 'Message Delivered' : 'Delivery Dropped / No Route'}
                      </div>
                      <div className="text-xs opacity-90 font-mono">
                        Simulation ID: {simResult.simulation_id} • Packet: {simResult.message_id}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="block font-mono font-bold text-coastal-text">
                      {simResult.total_hops} Hops
                    </span>
                    <span className="opacity-90 font-mono font-semibold">
                      {simResult.total_latency_ms} ms latency
                    </span>
                  </div>
                </div>

                {/* Path Visualizer */}
                {simResult.path.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider block mb-2">
                      Computed Dijkstra Trajectory:
                    </span>
                    <div className="flex flex-wrap items-center gap-2 p-3.5 bg-coastal-cream-dark/60 rounded-xl border border-coastal-border text-xs font-mono">
                      {simResult.path.map((nodeId, idx) => (
                        <React.Fragment key={nodeId}>
                          <span className="px-3 py-1 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded-lg font-bold shadow-coastal-sm">
                            {nodeId}
                          </span>
                          {idx < simResult.path.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-coastal-text-muted" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hop Breakdown Table */}
                {simResult.details.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider mb-2">
                      Hop-by-Hop Link Diagnostics
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-coastal-border text-coastal-text-muted font-semibold">
                            <th className="pb-2">Step</th>
                            <th className="pb-2">From Node</th>
                            <th className="pb-2">To Node</th>
                            <th className="pb-2">Hop Latency</th>
                            <th className="pb-2">Target Battery</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-coastal-border font-mono">
                          {simResult.details.map((hop) => (
                            <tr key={hop.step} className="hover:bg-coastal-powder/30">
                              <td className="py-2.5 text-coastal-text-muted">#{hop.step}</td>
                              <td className="py-2.5 text-coastal-text font-semibold">{hop.from_node}</td>
                              <td className="py-2.5 text-coastal-text font-semibold">{hop.to_node}</td>
                              <td className="py-2.5 text-coastal-safe-text font-bold">{hop.latency_ms} ms</td>
                              <td className="py-2.5 text-coastal-brown font-semibold">{hop.remaining_battery}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-coastal-text-muted text-xs">
                Configure source, target, and priority class on the left, then click "Run Deterministic Routing" to observe the calculated route.
              </div>
            )}
          </div>

          {/* Historical Log */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted mb-3">
              Transmission Log History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-coastal-border text-coastal-text-muted font-semibold">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Payload Preview</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coastal-border">
                  {messages.map((m) => (
                    <tr key={m.id} className="hover:bg-coastal-powder/30">
                      <td className="py-2.5 text-coastal-text-muted font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5">
                        <span className="font-semibold text-[11px] text-coastal-cerulean font-mono">
                          {m.priority}
                        </span>
                      </td>
                      <td className="py-2.5 text-coastal-text truncate max-w-xs">{m.content}</td>
                      <td className="py-2.5">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded border ${
                            m.status === 'DELIVERED'
                              ? 'bg-coastal-safe/25 text-coastal-safe-text border-coastal-safe-border'
                              : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical-border'
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

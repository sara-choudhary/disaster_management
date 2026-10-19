import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Battery,
  Radio,
  Send,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { NetworkNode, EmergencyMessage } from '../types';
import { fetchNodes } from '../api/nodes';
import { fetchDispatchedMessages } from '../api/simulation';

export const DashboardPage: React.FC = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [messages, setMessages] = useState<EmergencyMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [nodeData, msgData] = await Promise.all([
          fetchNodes(),
          fetchDispatchedMessages(10),
        ]);
        setNodes(nodeData);
        setMessages(msgData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend server');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalNodes = nodes.length;
  const activeNodes = nodes.filter((n) => n.status === 'active').length;
  const degradedNodes = nodes.filter((n) => n.status === 'degraded').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
  const avgBattery =
    totalNodes > 0
      ? Math.round(nodes.reduce((acc, n) => acc + n.battery_level, 0) / totalNodes)
      : 0;

  // Chart data: message priorities
  const priorityCounts = {
    CRITICAL_SOS: messages.filter((m) => m.priority === 'CRITICAL_SOS').length,
    HIGH_MEDICAL: messages.filter((m) => m.priority === 'HIGH_MEDICAL').length,
    NORMAL_LOGISTICS: messages.filter((m) => m.priority === 'NORMAL_LOGISTICS').length,
    LOW_ROUTINE: messages.filter((m) => m.priority === 'LOW_ROUTINE').length,
  };

  const chartData = [
    { name: 'SOS Critical', count: priorityCounts.CRITICAL_SOS, color: '#ef4444' },
    { name: 'High Medical', count: priorityCounts.HIGH_MEDICAL, color: '#f97316' },
    { name: 'Logistics', count: priorityCounts.NORMAL_LOGISTICS, color: '#3b82f6' },
    { name: 'Routine', count: priorityCounts.LOW_ROUTINE, color: '#10b981' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500" />
            Emergency Operations Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Real-time status of disconnected mesh nodes and priority-routed communications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/simulation"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-red-950/50"
          >
            <Send className="w-4 h-4" />
            Route Emergency Packet
          </Link>
          <Link
            to="/topology"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors border border-slate-700"
          >
            <Activity className="w-4 h-4 text-blue-400" />
            View Topology
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>
            {error}. Ensure the Python FastAPI server is running on port 8000.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Mesh Nodes
            </span>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '...' : totalNodes}
            </span>
            <span className="text-xs text-slate-400">Registered</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">{activeNodes} active</span>
            <span>•</span>
            <span className="text-amber-400 font-medium">{degradedNodes} degraded</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Network Health
            </span>
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '...' : `${offlineNodes === 0 ? '100' : Math.round((activeNodes / (totalNodes || 1)) * 100)}%`}
            </span>
            <span className="text-xs text-emerald-400 font-medium">Availability</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {offlineNodes} node(s) severed / unreachable
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Average Battery
            </span>
            <Battery className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '...' : `${avgBattery}%`}
            </span>
            <span className="text-xs text-slate-400">Fleet telemetry</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Solar & generator backup active
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Dispatched Packets
            </span>
            <Send className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '...' : messages.length}
            </span>
            <span className="text-xs text-indigo-300 font-medium">Priority routed</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Deterministic Dijkstra graph
          </div>
        </div>
      </div>

      {/* Grid: Priority breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-1 flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4">
            Priority Queue Distribution
          </h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> SOS Critical
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> High Medical
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Logistics
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Routine
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Recent Network Communications
            </h2>
            <Link
              to="/simulation"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Simulate New Packet &rarr;
            </Link>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No emergency messages routed yet. Run a priority route simulation to view packet hops.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Message ID</th>
                    <th className="pb-2 font-medium">Priority</th>
                    <th className="pb-2 font-medium">Route Path</th>
                    <th className="pb-2 font-medium">Hops</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {messages.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-mono text-slate-300">{m.message_id}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.priority === 'CRITICAL_SOS'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : m.priority === 'HIGH_MEDICAL'
                              ? 'bg-orange-950 text-orange-400 border border-orange-800'
                              : m.priority === 'NORMAL_LOGISTICS'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {m.priority}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300 truncate max-w-xs" title={m.route_taken}>
                        {m.route_taken || 'No path available'}
                      </td>
                      <td className="py-2.5 text-slate-400">{m.hop_count}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          {m.status === 'DELIVERED' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-rose-400" />
                              <span className="text-rose-400">{m.status}</span>
                            </>
                          )}
                        </span>
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
  );
};

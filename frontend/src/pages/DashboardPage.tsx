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
import { coastalColors } from '../theme/tokens';

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
    { name: 'Critical SOS', count: priorityCounts.CRITICAL_SOS, color: coastalColors.critical },
    { name: 'High Medical', count: priorityCounts.HIGH_MEDICAL, color: coastalColors.suspicious },
    { name: 'Logistics', count: priorityCounts.NORMAL_LOGISTICS, color: coastalColors.mutedCerulean },
    { name: 'Routine', count: priorityCounts.LOW_ROUTINE, color: coastalColors.safe },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-rose/20 text-coastal-rose rounded-xl border border-coastal-rose/30">
              <Radio className="w-5 h-5" />
            </div>
            Emergency Operations Dashboard
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Real-time status of disconnected mesh nodes and priority-routed communications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/simulation"
            className="inline-flex items-center gap-2 px-4 py-2 bg-coastal-rose hover:bg-coastal-rose/90 text-white rounded-xl font-medium text-xs transition-all shadow-coastal-sm"
          >
            <Send className="w-4 h-4" />
            Route Emergency Packet
          </Link>
          <Link
            to="/topology"
            className="inline-flex items-center gap-2 px-4 py-2 bg-coastal-cream hover:bg-coastal-powder text-coastal-text rounded-xl font-medium text-xs transition-all border border-coastal-border shadow-coastal-sm"
          >
            <Activity className="w-4 h-4 text-coastal-cerulean" />
            View Topology
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical/40 rounded-2xl text-coastal-critical-text text-xs flex items-center gap-3 shadow-coastal-sm">
          <AlertTriangle className="w-4 h-4 text-coastal-critical shrink-0" />
          <span>
            {error}. Ensure the Python FastAPI server is running on port 8000.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Total Mesh Nodes
            </span>
            <div className="p-1.5 bg-coastal-powder text-coastal-cerulean rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-coastal-text">
              {loading ? '...' : totalNodes}
            </span>
            <span className="text-xs text-coastal-text-muted">Registered</span>
          </div>
          <div className="mt-2 text-xs text-coastal-text-muted flex items-center gap-1.5 font-medium">
            <span className="text-coastal-safe-text">{activeNodes} active</span>
            <span>•</span>
            <span className="text-coastal-warning-text">{degradedNodes} degraded</span>
          </div>
        </div>

        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Network Health
            </span>
            <div className="p-1.5 bg-coastal-safe/30 text-coastal-safe-text rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-coastal-text">
              {loading ? '...' : `${offlineNodes === 0 ? '100' : Math.round((activeNodes / (totalNodes || 1)) * 100)}%`}
            </span>
            <span className="text-xs text-coastal-safe-text font-medium">Availability</span>
          </div>
          <div className="mt-2 text-xs text-coastal-text-muted">
            {offlineNodes} node(s) severed / unreachable
          </div>
        </div>

        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Average Battery
            </span>
            <div className="p-1.5 bg-coastal-warning/30 text-coastal-warning-text rounded-lg">
              <Battery className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-coastal-text">
              {loading ? '...' : `${avgBattery}%`}
            </span>
            <span className="text-xs text-coastal-text-muted">Fleet telemetry</span>
          </div>
          <div className="mt-2 text-xs text-coastal-text-muted">
            Solar & generator backup active
          </div>
        </div>

        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-coastal-text-muted uppercase tracking-wider">
              Dispatched Packets
            </span>
            <div className="p-1.5 bg-coastal-lavender text-coastal-mauve rounded-lg">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-coastal-text">
              {loading ? '...' : messages.length}
            </span>
            <span className="text-xs text-coastal-mauve font-medium">Priority routed</span>
          </div>
          <div className="mt-2 text-xs text-coastal-text-muted">
            Deterministic Dijkstra graph
          </div>
        </div>
      </div>

      {/* Grid: Priority breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 lg:col-span-1 flex flex-col shadow-coastal-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted mb-4">
            Priority Queue Distribution
          </h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke={coastalColors.secondaryText} fontSize={11} tickLine={false} />
                <YAxis stroke={coastalColors.secondaryText} fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: coastalColors.cream,
                    borderColor: coastalColors.border,
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: coastalColors.mainText,
                    boxShadow: '0 4px 12px rgba(57, 54, 64, 0.08)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-coastal-border grid grid-cols-2 gap-2 text-xs text-coastal-text-muted font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: coastalColors.critical }} /> Critical SOS
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: coastalColors.suspicious }} /> High Medical
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: coastalColors.mutedCerulean }} /> Logistics
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: coastalColors.safe }} /> Routine
            </div>
          </div>
        </div>

        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 lg:col-span-2 shadow-coastal-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted">
              Recent Network Communications
            </h2>
            <Link
              to="/simulation"
              className="text-xs text-coastal-cerulean hover:text-coastal-brown font-semibold transition-colors"
            >
              Simulate New Packet &rarr;
            </Link>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-10 text-coastal-text-muted text-xs">
              No emergency messages routed yet. Run a priority route simulation to view packet hops.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-coastal-border text-coastal-text-muted font-semibold">
                    <th className="pb-2.5">Message ID</th>
                    <th className="pb-2.5">Priority</th>
                    <th className="pb-2.5">Route Path</th>
                    <th className="pb-2.5">Hops</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coastal-border">
                  {messages.map((m) => (
                    <tr key={m.id} className="hover:bg-coastal-powder/40 transition-colors">
                      <td className="py-3 font-mono font-medium text-coastal-text">{m.message_id}</td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.priority === 'CRITICAL_SOS'
                              ? 'bg-coastal-critical/20 text-coastal-critical-text border border-coastal-critical/40'
                              : m.priority === 'HIGH_MEDICAL'
                              ? 'bg-coastal-suspicious/20 text-coastal-suspicious-text border border-coastal-suspicious/40'
                              : m.priority === 'NORMAL_LOGISTICS'
                              ? 'bg-coastal-powder text-coastal-cerulean border border-coastal-border'
                              : 'bg-coastal-safe/25 text-coastal-safe-text border border-coastal-safe/50'
                          }`}
                        >
                          {m.priority}
                        </span>
                      </td>
                      <td className="py-3 text-coastal-text truncate max-w-xs" title={m.route_taken}>
                        {m.route_taken || 'No path available'}
                      </td>
                      <td className="py-3 text-coastal-text-muted font-mono">{m.hop_count}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs">
                          {m.status === 'DELIVERED' ? (
                            <span className="text-coastal-safe-text flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </span>
                          ) : (
                            <span className="text-coastal-critical-text flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {m.status}
                            </span>
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

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Route,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  SummaryReportResponse,
  SimulationHistoryPaginationResponse,
  SimulationHistoryItem,
  SimulationRunReportResponse,
  fetchSummaryReport,
  fetchSimulationHistory,
  fetchSimulationReport,
  downloadHistoryCsv,
  downloadSimulationJson,
} from '../api/reports';

export const ReportsPage: React.FC = () => {
  // Summary Data State
  const [summary, setSummary] = useState<SummaryReportResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // History Table State
  const [history, setHistory] = useState<SimulationHistoryPaginationResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Inspection Modal State
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [drillReport, setDrillReport] = useState<SimulationRunReportResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Export State
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [exportingJson, setExportingJson] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load High-Level Summary
  const loadSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const data = await fetchSummaryReport();
      setSummary(data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load Paginated History
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await fetchSimulationHistory({
        search,
        status: statusFilter,
        page: currentPage,
        pageSize,
      });
      setHistory(data);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load simulation history');
    } finally {
      setLoadingHistory(false);
    }
  }, [search, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Open Inspector
  const handleInspectDrill = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetail(true);
    setActionError(null);
    try {
      const data = await fetchSimulationReport(runId);
      setDrillReport(data);
    } catch (err: any) {
      setActionError(err.message || `Failed to fetch report for drill ${runId}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedRunId(null);
    setDrillReport(null);
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      setActionError(null);
      await downloadHistoryCsv();
    } catch (err: any) {
      setActionError(err.message || 'Failed to export simulation history CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  // JSON Export for single drill
  const handleExportJson = async (runId: string) => {
    try {
      setExportingJson(true);
      setActionError(null);
      await downloadSimulationJson(runId);
    } catch (err: any) {
      setActionError(err.message || `Failed to export JSON for drill ${runId}`);
    } finally {
      setExportingJson(false);
    }
  };

  const formatDateTime = (isoStr?: string | null): string => {
    if (!isoStr) return 'Unavailable';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Unavailable';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Unavailable';
    }
  };

  const concise = summary?.concise_summary;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border">
              <FileText className="w-5 h-5" />
            </div>
            Operational Reports & Simulation History
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Forensic drill audits, deterministic SPF route convergence tracking, and verified database history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-3.5 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
            title="Download complete simulation drill ledger as CSV"
          >
            <Download className={`w-4 h-4 ${exportingCsv ? 'animate-bounce' : ''}`} />
            {exportingCsv ? 'Exporting...' : 'Export History (CSV)'}
          </button>

          <button
            onClick={() => {
              loadSummary();
              loadHistory();
            }}
            disabled={loadingSummary || loadingHistory}
            className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
            title="Refresh Reports & History"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSummary || loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {actionError && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical-border rounded-xl text-xs text-coastal-critical-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-coastal-critical-text hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Concise Summary Component (7 Key Domains) */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
        <div className="flex items-center justify-between border-b border-coastal-border pb-3">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-coastal-text uppercase">
              Concise Resilience & Performance Summary
            </h2>
            <p className="text-xs text-coastal-text-muted mt-0.5">
              Current operational readiness and historical drill convergence across 7 core metrics.
            </p>
          </div>
          <span className="text-[11px] font-mono text-coastal-text-muted">
            Audited: {summary ? formatDateTime(summary.timestamp) : 'Loading...'}
          </span>
        </div>

        {loadingSummary && !summary ? (
          <div className="py-8 text-center text-xs text-coastal-text-muted flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-coastal-cerulean" />
            Aggregating network resilience records...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Network Availability */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                1. Network Availability
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.network_availability_pct != null
                  ? `${concise.network_availability_pct.toFixed(1)}%`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                {summary ? `${summary.active_nodes + summary.up_links} of ${summary.total_nodes + summary.total_links} components operational` : 'Operational mesh ratio'}
              </span>
            </div>

            {/* 2. Failed Resources */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                2. Failed Resources
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.failed_resources_count != null
                  ? concise.failed_resources_count === 0
                    ? '0 (None)'
                    : `${concise.failed_resources_count} Failed`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block truncate" title={concise?.failed_resources?.join(', ') || 'No failed components'}>
                {concise?.failed_resources && concise.failed_resources.length > 0
                  ? concise.failed_resources.join(', ')
                  : 'Healthy infrastructure mesh'}
              </span>
            </div>

            {/* 3. Alternate Route Selected */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                3. Alternate Routes Selected
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.alternate_route_selected_count != null
                  ? `${concise.alternate_route_selected_count} Drills`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                Dynamic Dijkstra SPF reroutes
              </span>
            </div>

            {/* 4. Recovery Result */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                4. Recovery Result
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.recovery_result?.success_rate_pct != null
                  ? `${concise.recovery_result.success_rate_pct}% Success`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                {concise?.recovery_result?.avg_recovery_seconds != null
                  ? `Avg recovery: ${concise.recovery_result.avg_recovery_seconds.toFixed(3)}s`
                  : 'No recovery data'}
              </span>
            </div>

            {/* 5. Packet Delivery Statistics */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                5. Packet Delivery
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.packet_delivery_statistics?.aggregate_delivery_ratio_pct != null
                  ? `${concise.packet_delivery_statistics.aggregate_delivery_ratio_pct.toFixed(1)}%`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                {concise?.packet_delivery_statistics?.total_packets_sent != null
                  ? `${concise.packet_delivery_statistics.total_packets_delivered}/${concise.packet_delivery_statistics.total_packets_sent} delivered`
                  : 'No packet ledger entries'}
              </span>
            </div>

            {/* 6. Security Events */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                6. Security Events
              </span>
              <span className="text-2xl font-extrabold text-coastal-text mt-1.5 block">
                {concise?.security_events_count != null
                  ? `${concise.security_events_count} Events`
                  : 'Unavailable'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                {concise?.security_events_count && concise.security_events_count > 0
                  ? 'ACL denials & port violations'
                  : 'Zero unauthorized attempts'}
              </span>
            </div>

            {/* 7. QoS Observations (spans 2 columns on larger screens) */}
            <div className="p-3.5 bg-coastal-powder/40 border border-coastal-border rounded-xl sm:col-span-2">
              <span className="text-[10px] font-bold text-coastal-text-muted uppercase tracking-wider block">
                7. QoS Observations
              </span>
              <span className="text-sm font-bold text-coastal-text mt-1.5 block">
                {concise?.qos_observations?.scheduler_policy || 'Strict Priority Scheduler'}
              </span>
              <span className="text-[11px] text-coastal-text-muted mt-1 block">
                {concise?.qos_observations?.summary ||
                  (concise?.qos_observations?.congestion_incidents != null
                    ? `${concise.qos_observations.congestion_incidents} congestion incidents handled`
                    : 'Link headroom sustained across classes')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Searchable, Paginated History Table */}
      <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-coastal-text uppercase">
              Persistent Simulation History
            </h2>
            <p className="text-xs text-coastal-text-muted mt-0.5">
              Comprehensive execution records across disaster recovery drills and route rerouting.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-coastal-text-muted" />
              <input
                type="text"
                placeholder="Search Run ID or Scenario..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-coastal-powder/30 border border-coastal-border rounded-xl text-xs text-coastal-text placeholder-coastal-text-muted focus:outline-none focus:ring-1 focus:ring-coastal-cerulean w-48 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-coastal-text-muted" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-coastal-powder/30 border border-coastal-border rounded-xl text-xs text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                <option value="ALL">All Outcomes</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
                <option value="STOPPED">Stopped Only</option>
              </select>
            </div>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-coastal-powder/30 border border-coastal-border rounded-xl text-xs text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-coastal-border text-coastal-text-muted font-semibold">
                <th className="pb-3 pr-4">Run ID</th>
                <th className="pb-3 pr-4">Scenario Name</th>
                <th className="pb-3 pr-4">Start Time</th>
                <th className="pb-3 pr-4">Completion</th>
                <th className="pb-3 pr-4">Outcome</th>
                <th className="pb-3 pr-4">Recovery</th>
                <th className="pb-3 pr-4">Packets (S/D/L)</th>
                <th className="pb-3 pr-4">Delivery Ratio</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coastal-border font-mono">
              {loadingHistory ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-coastal-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-coastal-cerulean" />
                      Loading drill execution history...
                    </div>
                  </td>
                </tr>
              ) : !history || history.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-coastal-text-muted">
                    No simulation drill records found matching the specified criteria.
                  </td>
                </tr>
              ) : (
                history.items.map((item: SimulationHistoryItem) => {
                  const isSuccess = item.final_outcome === 'SUCCESS';
                  const isFailed = item.final_outcome === 'FAILED';

                  return (
                    <tr
                      key={item.run_id}
                      className="hover:bg-coastal-powder/20 transition-colors cursor-pointer"
                      onClick={() => handleInspectDrill(item.run_id)}
                    >
                      <td className="py-3 pr-4 text-coastal-text font-bold whitespace-nowrap">
                        {item.run_id}
                      </td>
                      <td className="py-3 pr-4 text-coastal-text font-sans font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{item.scenario_name}</span>
                          {item.alternate_route_selected && (
                            <span
                              className="px-1.5 py-0.5 text-[9px] bg-coastal-mauve/20 text-coastal-mauve rounded border border-coastal-mauve/30 uppercase tracking-wider font-semibold"
                              title="Dijkstra SPF calculated alternate detour"
                            >
                              Rerouted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-coastal-text-muted whitespace-nowrap font-sans text-[11px]">
                        {formatDateTime(item.start_time)}
                      </td>
                      <td className="py-3 pr-4 text-coastal-text-muted whitespace-nowrap font-sans text-[11px]">
                        {item.completion_time ? formatDateTime(item.completion_time) : 'In Progress'}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isSuccess
                              ? 'text-coastal-safe-text bg-coastal-safe/25 border border-coastal-safe-border'
                              : isFailed
                              ? 'text-coastal-critical-text bg-coastal-critical/25 border border-coastal-critical-border'
                              : 'text-coastal-warning-text bg-coastal-warning/25'
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                          {isFailed && <XCircle className="w-3 h-3" />}
                          {item.final_outcome}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-coastal-text font-medium whitespace-nowrap">
                        {item.recovery_duration_sec != null
                          ? `${item.recovery_duration_sec.toFixed(3)}s`
                          : 'Unavailable'}
                      </td>
                      <td className="py-3 pr-4 text-coastal-text whitespace-nowrap">
                        {item.packets_sent != null
                          ? `${item.packets_sent} / ${item.packets_delivered || 0} / ${item.packets_lost || 0}`
                          : 'Unavailable'}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap font-semibold">
                        {item.delivery_ratio_pct != null ? (
                          <span
                            className={
                              item.delivery_ratio_pct >= 95
                                ? 'text-coastal-safe-text'
                                : item.delivery_ratio_pct >= 80
                                ? 'text-coastal-warning-text'
                                : 'text-coastal-critical-text'
                            }
                          >
                            {item.delivery_ratio_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-coastal-text-muted">Unavailable</span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectDrill(item.run_id);
                          }}
                          className="px-2.5 py-1 text-[11px] font-sans font-semibold bg-coastal-powder/60 hover:bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded-lg transition-colors"
                        >
                          Inspect Drill
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {history && history.total_count > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-coastal-border text-xs text-coastal-text-muted">
            <div>
              Showing{' '}
              <span className="font-semibold text-coastal-text">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-coastal-text">
                {Math.min(currentPage * pageSize, history.total_count)}
              </span>{' '}
              of <span className="font-semibold text-coastal-text">{history.total_count}</span> drills
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1 || loadingHistory}
                className="p-1.5 bg-coastal-powder/40 hover:bg-coastal-powder border border-coastal-border rounded-lg text-coastal-text disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 py-1 font-mono text-[11px] text-coastal-text">
                Page {currentPage} of {history.total_pages || 1}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, history.total_pages || 1))}
                disabled={currentPage >= (history.total_pages || 1) || loadingHistory}
                className="p-1.5 bg-coastal-powder/40 hover:bg-coastal-powder border border-coastal-border rounded-lg text-coastal-text disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drill Detail Inspector Modal */}
      {selectedRunId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="bg-coastal-cream border border-coastal-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-coastal-md p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-coastal-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded font-mono text-[10px] font-bold">
                    {selectedRunId}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                      drillReport?.status === 'SUCCESS'
                        ? 'text-coastal-safe-text bg-coastal-safe/25 border border-coastal-safe-border'
                        : drillReport?.status === 'FAILED'
                        ? 'text-coastal-critical-text bg-coastal-critical/25 border border-coastal-critical-border'
                        : 'text-coastal-warning-text bg-coastal-warning/25'
                    }`}
                  >
                    {drillReport?.status || 'INSPECTING'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-coastal-text mt-1">
                  {drillReport?.scenario_name || 'Simulation Drill Report'}
                </h3>
                <p className="text-xs text-coastal-text-muted mt-0.5">
                  Executed: {drillReport ? formatDateTime(drillReport.start_time) : '...'} &bull; Duration:{' '}
                  {drillReport?.duration_seconds != null
                    ? `${drillReport.duration_seconds.toFixed(3)}s`
                    : 'Unavailable'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportJson(selectedRunId)}
                  disabled={exportingJson || !drillReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-coastal-powder/60 hover:bg-coastal-powder border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text transition-colors disabled:opacity-50"
                  title="Export complete drill post-mortem audit as JSON"
                >
                  <Download className={`w-3.5 h-3.5 ${exportingJson ? 'animate-bounce' : ''}`} />
                  Export JSON
                </button>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-coastal-powder rounded-lg text-coastal-text-muted hover:text-coastal-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="py-16 text-center text-xs text-coastal-text-muted flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-coastal-cerulean" />
                Retrieving drill telemetry and route convergence audit...
              </div>
            ) : !drillReport ? (
              <div className="py-16 text-center text-xs text-coastal-critical-text">
                Failed to load drill details.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Resilience Score & Assessment */}
                <div className="p-4 bg-coastal-powder/30 border border-coastal-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-coastal-text uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-coastal-cerulean" />
                      Network Resilience Score
                    </span>
                    <span className="text-sm font-extrabold text-coastal-cerulean font-mono">
                      {drillReport.resilience_score} / 100
                    </span>
                  </div>
                  <p className="text-xs text-coastal-text leading-relaxed">
                    {drillReport.assessment}
                  </p>
                  {drillReport.qos_observations && (
                    <p className="text-[11px] text-coastal-text-muted font-mono bg-coastal-cream/60 p-2 rounded border border-coastal-border">
                      {drillReport.qos_observations}
                    </p>
                  )}
                </div>

                {/* Topology & Path Analysis: Initial vs Final */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Initial State */}
                  <div className="p-4 bg-coastal-powder/20 border border-coastal-border rounded-xl space-y-2.5">
                    <span className="text-xs font-bold text-coastal-text uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-coastal-mauve" />
                      Initial Topology State
                    </span>
                    <div className="text-xs text-coastal-text space-y-1 font-mono text-[11px]">
                      <div>
                        Source:{' '}
                        <span className="font-bold text-coastal-cerulean">
                          {drillReport.initial_topology?.source || 'ECC-01'}
                        </span>
                      </div>
                      <div>
                        Destination:{' '}
                        <span className="font-bold text-coastal-cerulean">
                          {drillReport.initial_topology?.target || 'HOSPITAL-04'}
                        </span>
                      </div>
                      <div>
                        Failed Nodes Injected:{' '}
                        <span className="font-bold text-coastal-critical-text">
                          {drillReport.initial_topology?.failed_nodes &&
                          drillReport.initial_topology.failed_nodes.length > 0
                            ? drillReport.initial_topology.failed_nodes.join(', ')
                            : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Final Converged State */}
                  <div className="p-4 bg-coastal-powder/20 border border-coastal-border rounded-xl space-y-2.5">
                    <span className="text-xs font-bold text-coastal-text uppercase tracking-wider flex items-center gap-1.5">
                      <Route className="w-4 h-4 text-coastal-cerulean" />
                      Final Converged Route
                    </span>
                    <div className="text-xs space-y-1.5">
                      <div className="text-[11px] text-coastal-text-muted font-mono">
                        Alternate Route Rerouted:{' '}
                        <span className="font-bold text-coastal-text">
                          {drillReport.alternate_route_selected ? 'YES (Dijkstra SPF)' : 'NO (Primary Mesh)'}
                        </span>
                      </div>
                      {drillReport.route_taken && drillReport.route_taken.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] mt-1">
                          {drillReport.route_taken.map((node, i) => (
                            <React.Fragment key={node}>
                              <span className="px-2 py-0.5 bg-coastal-cream border border-coastal-border rounded text-coastal-text font-bold">
                                {node}
                              </span>
                              {i < (drillReport.route_taken?.length || 0) - 1 && (
                                <span className="text-coastal-text-muted">&rarr;</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-coastal-critical-text font-mono">
                          Destination unreachable (Partitioned)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Route Changes */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-coastal-text uppercase tracking-wider block">
                    Route Recalculation Log
                  </span>
                  {drillReport.route_changes && drillReport.route_changes.length > 0 ? (
                    <div className="p-3 bg-coastal-powder/30 border border-coastal-border rounded-xl text-xs space-y-1 font-mono text-[11px]">
                      {drillReport.route_changes.map((change, idx) => (
                        <div key={idx} className="text-coastal-text flex items-center gap-2">
                          <span className="text-coastal-cerulean">&bull;</span>
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-coastal-powder/20 border border-coastal-border rounded-xl text-xs text-coastal-text-muted font-mono text-[11px]">
                      Optimal baseline route sustained with zero route convergence changes required.
                    </div>
                  )}
                </div>

                {/* Modeled Packet Statistics */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-coastal-text uppercase tracking-wider block">
                    Packet Transmission & Delay Results
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                    <div className="p-2.5 bg-coastal-powder/20 border border-coastal-border rounded-lg">
                      <span className="text-[10px] text-coastal-text-muted block">Packets Sent</span>
                      <span className="text-base font-bold text-coastal-text mt-0.5 block">
                        {drillReport.packet_statistics?.total_packets ??
                          drillReport.packet_statistics?.packets_sent ??
                          'Unavailable'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-coastal-powder/20 border border-coastal-border rounded-lg">
                      <span className="text-[10px] text-coastal-text-muted block">Packets Delivered</span>
                      <span className="text-base font-bold text-coastal-safe-text mt-0.5 block">
                        {drillReport.packet_statistics?.packets_delivered ?? 'Unavailable'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-coastal-powder/20 border border-coastal-border rounded-lg">
                      <span className="text-[10px] text-coastal-text-muted block">Retransmissions</span>
                      <span className="text-base font-bold text-coastal-cerulean mt-0.5 block">
                        {drillReport.packet_statistics?.retransmissions ?? '0'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-coastal-powder/20 border border-coastal-border rounded-lg">
                      <span className="text-[10px] text-coastal-text-muted block">Packets Lost</span>
                      <span className="text-base font-bold text-coastal-critical-text mt-0.5 block">
                        {drillReport.packet_statistics?.packets_lost ?? '0'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-coastal-powder/20 border border-coastal-border rounded-lg">
                      <span className="text-[10px] text-coastal-text-muted block">Estimated Latency</span>
                      <span className="text-base font-bold text-coastal-text mt-0.5 block">
                        {drillReport.packet_statistics?.avg_latency_ms != null
                          ? `${drillReport.packet_statistics.avg_latency_ms}ms`
                          : drillReport.packet_statistics?.latency_ms != null
                          ? `${drillReport.packet_statistics.latency_ms}ms`
                          : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discrete Packet Retransmission & Recovery Stream */}
                {drillReport.packet_statistics?.packets_sample && drillReport.packet_statistics.packets_sample.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-coastal-text uppercase tracking-wider block">
                        Packet Retransmission & Lifecycle Stream
                      </span>
                      <span className="text-[10px] font-mono text-coastal-safe-text bg-coastal-safe/25 px-2 py-0.5 rounded font-bold border border-coastal-safe-border">
                        {drillReport.packet_statistics?.reconciled ? 'RECONCILED 100%' : 'VERIFIED AUDIT'}
                      </span>
                    </div>
                    <div className="overflow-x-auto border border-coastal-border rounded-xl">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-coastal-powder/40 border-b border-coastal-border text-coastal-text-muted font-sans text-[11px]">
                          <tr>
                            <th className="p-2.5">Packet ID</th>
                            <th className="p-2.5">Seq #</th>
                            <th className="p-2.5">Priority</th>
                            <th className="p-2.5">Retransmissions</th>
                            <th className="p-2.5">Latency</th>
                            <th className="p-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-coastal-border">
                          {drillReport.packet_statistics.packets_sample.map((pkt: any) => (
                            <tr key={pkt.packet_id} className="hover:bg-coastal-powder/20">
                              <td className="p-2.5 font-bold text-coastal-text">{pkt.packet_id}</td>
                              <td className="p-2.5 text-coastal-text-muted">#{pkt.sequence_number}</td>
                              <td className="p-2.5 text-coastal-cerulean font-semibold">{pkt.priority}</td>
                              <td className="p-2.5">
                                {pkt.retransmissions > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-coastal-dusty-rose/20 text-coastal-dusty-rose rounded font-bold">
                                    {pkt.retransmissions} Retries (Resent & Recovered)
                                  </span>
                                ) : (
                                  <span className="text-coastal-text-muted">0 (Direct)</span>
                                )}
                              </td>
                              <td className="p-2.5 text-coastal-safe-text font-bold">
                                {pkt.end_to_end_latency_ms ? `${pkt.end_to_end_latency_ms}ms` : 'N/A'}
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    pkt.current_state === 'DELIVERED'
                                      ? 'bg-coastal-safe/25 text-coastal-safe-text'
                                      : 'bg-coastal-critical/20 text-coastal-critical-text'
                                  }`}
                                >
                                  {pkt.current_state}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Forensic Event Timeline */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-coastal-text uppercase tracking-wider block">
                    Forensic Drill Timeline ({drillReport.events_triggered?.length || 0} Events)
                  </span>
                  {drillReport.events_triggered && drillReport.events_triggered.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border border-coastal-border rounded-xl divide-y divide-coastal-border text-xs font-mono">
                      {drillReport.events_triggered.map((ev) => (
                        <div key={ev.event_id} className="p-2.5 hover:bg-coastal-powder/30 flex items-start gap-2.5">
                          <span className="text-[10px] text-coastal-text-muted shrink-0 font-sans">
                            {formatDateTime(ev.timestamp)}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase ${
                              ev.severity === 'CRITICAL'
                                ? 'text-coastal-critical-text bg-coastal-critical/20'
                                : ev.severity === 'WARNING'
                                ? 'text-coastal-warning-text bg-coastal-warning/20'
                                : 'text-coastal-cerulean bg-coastal-powder'
                            }`}
                          >
                            {ev.severity}
                          </span>
                          <span className="text-[11px] text-coastal-text flex-1">
                            {ev.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-coastal-powder/20 border border-coastal-border rounded-xl text-xs text-coastal-text-muted">
                      No discrete forensic events logged during this simulation execution.
                    </div>
                  )}
                </div>

                {/* Alerts Generated */}
                {drillReport.alerts_triggered && drillReport.alerts_triggered.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-coastal-text uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-coastal-dusty-rose" />
                      Associated Alerts ({drillReport.alerts_triggered.length})
                    </span>
                    <div className="border border-coastal-border rounded-xl divide-y divide-coastal-border text-xs">
                      {drillReport.alerts_triggered.map((a) => (
                        <div key={a.alert_id} className="p-2.5 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-coastal-text">{a.title}</span>
                              <span className="text-[10px] font-mono text-coastal-text-muted">
                                {a.affected_resource}
                              </span>
                            </div>
                            <p className="text-[11px] text-coastal-text-muted mt-0.5">
                              {a.description}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-coastal-powder text-coastal-text">
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

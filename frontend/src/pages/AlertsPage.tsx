import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  Clock,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Info,
  FileSearch,
  Activity,
  Check,
  Download,
} from 'lucide-react';
import {
  AlertRecord,
  AlertFilters,
  fetchFilteredAlerts,
  acknowledgeAlert,
  resolveAlert,
} from '../api/alerts';
import {
  ForensicTimelineResponse,
  fetchForensicTimeline,
  fetchEventsWithFilters,
} from '../api/events';
import { fetchSimulationRuns, SimulationRunRecord } from '../api/simulation';
import { downloadAlertsCsv, downloadAlertsJson } from '../api/reports';
import { NetworkEventItem } from '../types';
import { useNetworkEvents } from '../context/NetworkEventContext';

type PageTab = 'ALERTS' | 'FORENSIC_TIMELINE' | 'EVENT_AUDIT';

export const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PageTab>('ALERTS');

  // Alerts State
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(true);
  const [alertActionId, setAlertActionId] = useState<string | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>('ALL');
  const [searchResource, setSearchResource] = useState<string>('');

  // Forensic Timeline State
  const [simRuns, setSimRuns] = useState<SimulationRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [timeline, setTimeline] = useState<ForensicTimelineResponse | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  // Event Audit Feed State
  const [auditEvents, setAuditEvents] = useState<NetworkEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

  // General Status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const { subscribe, isLive } = useNetworkEvents();
  const wsConnected = isLive;

  const handleExportCsv = async () => {
    try {
      setExporting('csv');
      await downloadAlertsCsv();
    } catch (err: any) {
      alert(err?.message || 'Failed to export alerts CSV');
    } finally {
      setExporting(null);
    }
  };

  const handleExportJson = async () => {
    try {
      setExporting('json');
      await downloadAlertsJson();
    } catch (err: any) {
      alert(err?.message || 'Failed to export alerts JSON');
    } finally {
      setExporting(null);
    }
  };

  // 1. Fetch Filtered Alerts
  const loadAlerts = useCallback(async () => {
    try {
      setLoadingAlerts(true);
      setErrorMsg(null);
      const filters: AlertFilters = {
        status: statusFilter,
        severity: severityFilter,
        category: categoryFilter,
        resource: searchResource,
        timeRange: timeRangeFilter,
        limit: 100,
      };
      const data = await fetchFilteredAlerts(filters);
      setAlerts(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch alerts from backend server');
    } finally {
      setLoadingAlerts(false);
    }
  }, [statusFilter, severityFilter, categoryFilter, searchResource, timeRangeFilter]);

  // 2. Fetch Simulation Runs for Forensic Timeline
  const loadSimulationRuns = useCallback(async () => {
    try {
      const runs = await fetchSimulationRuns(30);
      setSimRuns(runs);
      if (runs.length > 0 && !selectedRunId) {
        setSelectedRunId(runs[0].run_id);
      }
    } catch {
      // Graceful fallback
    }
  }, [selectedRunId]);

  // 3. Fetch Forensic Timeline for Selected Run
  const loadTimeline = useCallback(async (runId: string) => {
    if (!runId) return;
    try {
      setLoadingTimeline(true);
      const data = await fetchForensicTimeline(runId);
      setTimeline(data);
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to load forensic timeline for run ${runId}`);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  // 4. Fetch Event Audit Log
  const loadAuditEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const data = await fetchEventsWithFilters({
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        resource: searchResource ? searchResource : undefined,
        time_range: timeRangeFilter !== 'ALL' ? timeRangeFilter : undefined,
        limit: 100,
      });
      setAuditEvents(data);
    } catch {
      // Graceful fallback
    } finally {
      setLoadingEvents(false);
    }
  }, [severityFilter, searchResource, timeRangeFilter]);

  // Trigger loads on dependency changes
  useEffect(() => {
    if (activeTab === 'ALERTS') {
      loadAlerts();
    } else if (activeTab === 'FORENSIC_TIMELINE') {
      loadSimulationRuns();
    } else if (activeTab === 'EVENT_AUDIT') {
      loadAuditEvents();
    }
  }, [activeTab, loadAlerts, loadSimulationRuns, loadAuditEvents]);

  // Load timeline whenever selected run changes
  useEffect(() => {
    if (activeTab === 'FORENSIC_TIMELINE' && selectedRunId) {
      loadTimeline(selectedRunId);
    }
  }, [activeTab, selectedRunId, loadTimeline]);

  // Unified Event Subscription for Real-time Alert and Simulation Updates
  useEffect(() => {
    const unsub = subscribe('*', (msg) => {
      const et = msg.event_type || msg.event;
      if (
        et === 'ALERT_CREATED' ||
        et === 'ALERT_UPDATED' ||
        et === 'ALERT_RESOLVED' ||
        et === 'LINK_FAILURE' ||
        et === 'LINK_RESTORED' ||
        et === 'NODE_FAILURE' ||
        et === 'NODE_RESTORED' ||
        et === 'RESOURCE_RESTORED' ||
        et === 'BASELINE_RESET' ||
        et === 'SIMULATION_COMPLETED' ||
        et === 'SIMULATION_FAILED' ||
        et === 'SIMULATION_STARTED' ||
        et === 'POLLING_SYNC_TICK'
      ) {
        loadAlerts();
        loadSimulationRuns();
      }
    });

    return unsub;
  }, [subscribe, loadAlerts, loadSimulationRuns]);

  // Alert Action Handlers
  const handleAcknowledge = async (alertId: string) => {
    try {
      setAlertActionId(alertId);
      const updated = await acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? updated : a)));
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to acknowledge alert ${alertId}`);
    } finally {
      setAlertActionId(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      setAlertActionId(alertId);
      const updated = await resolveAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? updated : a)));
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to resolve alert ${alertId}`);
    } finally {
      setAlertActionId(null);
    }
  };

  const resetFilters = () => {
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
    setCategoryFilter('ALL');
    setTimeRangeFilter('ALL');
    setSearchResource('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-coastal-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border shadow-coastal-sm">
              <Bell className="w-5 h-5" />
            </div>
            Alerts & Network Events
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Real-time incident feed, alert management, and chronological forensic drill reconstruction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
            title="Export Alerts CSV"
          >
            <Download className="w-3.5 h-3.5 text-coastal-cerulean" />
            <span>{exporting === 'csv' ? 'Exporting...' : 'CSV'}</span>
          </button>
          <button
            onClick={handleExportJson}
            disabled={exporting !== null}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-xs font-semibold text-coastal-text shadow-coastal-sm transition-all disabled:opacity-50"
            title="Export Alerts JSON"
          >
            <Download className="w-3.5 h-3.5 text-coastal-cerulean" />
            <span>{exporting === 'json' ? 'Exporting...' : 'JSON'}</span>
          </button>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono font-medium ${
              wsConnected
                ? 'bg-coastal-safe/20 border-coastal-safe text-coastal-safe-text'
                : 'bg-coastal-sand/20 border-coastal-border text-coastal-text-muted'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-coastal-safe-text' : 'bg-coastal-warning-text'
              }`}
            />
            {wsConnected ? 'Live Feed Connected' : 'Polling Active'}
          </div>

          <button
            onClick={() => {
              if (activeTab === 'ALERTS') loadAlerts();
              if (activeTab === 'FORENSIC_TIMELINE' && selectedRunId) loadTimeline(selectedRunId);
              if (activeTab === 'EVENT_AUDIT') loadAuditEvents();
            }}
            className="p-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-md text-coastal-text shadow-coastal-sm transition-all focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAlerts || loadingTimeline || loadingEvents ? 'animate-spin text-coastal-cerulean' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-coastal-border pb-3">
        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'ALERTS'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'text-coastal-text-muted hover:text-coastal-text hover:bg-coastal-powder/40'
          }`}
        >
          <Bell className="w-4 h-4" />
          Active & Historical Alerts
          {alerts.filter((a) => a.status === 'ACTIVE').length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-coastal-dusty-rose text-white text-[10px] font-mono font-bold">
              {alerts.filter((a) => a.status === 'ACTIVE').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('FORENSIC_TIMELINE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'FORENSIC_TIMELINE'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'text-coastal-text-muted hover:text-coastal-text hover:bg-coastal-powder/40'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          Forensic Incident Timeline
        </button>

        <button
          onClick={() => setActiveTab('EVENT_AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'EVENT_AUDIT'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'text-coastal-text-muted hover:text-coastal-text hover:bg-coastal-powder/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          System Event Audit Feed
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-coastal-critical/15 border border-coastal-critical rounded-2xl p-4 text-xs text-coastal-critical-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-coastal-critical" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs font-semibold underline hover:text-coastal-critical"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: ALERTS FEED & MANAGEMENT */}
      {/* ============================================================== */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Resource */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-coastal-text-muted" />
                  <input
                    type="text"
                    value={searchResource}
                    onChange={(e) => setSearchResource(e.target.value)}
                    placeholder="Filter resource or keyword..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-coastal-border bg-white text-xs text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-coastal-text-muted font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-coastal-border bg-white text-xs text-coastal-text"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>

                {/* Severity Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-coastal-text-muted font-medium">Severity:</span>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-coastal-border bg-white text-xs text-coastal-text"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="WARNING">Warning</option>
                    <option value="INFO">Info / Low</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-coastal-text-muted font-medium">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-coastal-border bg-white text-xs text-coastal-text"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="CONNECTIVITY">Connectivity</option>
                    <option value="ROUTING">Routing</option>
                    <option value="CONGESTION">Congestion</option>
                    <option value="SECURITY">Security</option>
                    <option value="INFRASTRUCTURE">Infrastructure</option>
                    <option value="REACHABILITY">Reachability</option>
                  </select>
                </div>

                {/* Time Range Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-coastal-text-muted font-medium">Window:</span>
                  <select
                    value={timeRangeFilter}
                    onChange={(e) => setTimeRangeFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-coastal-border bg-white text-xs text-coastal-text"
                  >
                    <option value="ALL">All Recorded</option>
                    <option value="15m">Last 15 Min</option>
                    <option value="1h">Last 1 Hour</option>
                    <option value="6h">Last 6 Hours</option>
                    <option value="24h">Last 24 Hours</option>
                  </select>
                </div>
              </div>

              {(statusFilter !== 'ALL' ||
                severityFilter !== 'ALL' ||
                categoryFilter !== 'ALL' ||
                timeRangeFilter !== 'ALL' ||
                searchResource) && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-coastal-cerulean hover:underline self-end md:self-auto"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Alerts List */}
          {loadingAlerts ? (
            <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-12 text-center text-coastal-text-muted">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-coastal-cerulean" />
              <p className="text-xs">Loading operational alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-coastal-cream border-2 border-dashed border-coastal-border rounded-2xl p-12 text-center space-y-2">
              <CheckCircle className="w-8 h-8 mx-auto text-coastal-safe-text" />
              <h3 className="text-sm font-bold text-coastal-text">No Alerts Matching Filters</h3>
              <p className="text-xs text-coastal-text-muted max-w-sm mx-auto">
                No active or historical alerts match the current filter criteria.
              </p>
              <button
                onClick={resetFilters}
                className="mt-2 px-3 py-1 bg-coastal-powder text-coastal-cerulean border border-coastal-border rounded-lg text-xs font-semibold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const isCrit = alert.severity === 'CRITICAL';
                const isWarn = alert.severity === 'WARNING' || alert.severity === 'HIGH' || alert.severity === 'MEDIUM';
                const isResolved = alert.status === 'RESOLVED';

                // Restrained severity visual indicator
                let sevDot = 'text-coastal-cerulean';
                let sevLabel = 'Info';
                let borderAccent = 'border-l-coastal-cerulean';

                if (isCrit) {
                  sevDot = 'text-coastal-critical';
                  sevLabel = 'Critical';
                  borderAccent = 'border-l-coastal-critical';
                } else if (isWarn) {
                  sevDot = 'text-coastal-warning-text';
                  sevLabel = 'Warning';
                  borderAccent = 'border-l-coastal-warning';
                }

                return (
                  <div
                    key={alert.alert_id}
                    className={`bg-coastal-cream border border-coastal-border border-l-4 ${borderAccent} rounded-2xl p-4 shadow-coastal-sm transition-all hover:bg-white`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      {/* Left: Metadata & Description */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {/* Severity Indicator */}
                          <span className={`font-semibold flex items-center gap-1.5 ${sevDot}`}>
                            <span className="text-base leading-none">●</span>
                            {sevLabel}
                          </span>

                          <span className="text-coastal-text-muted">•</span>

                          {/* Category (Plain text) */}
                          <span className="font-medium text-coastal-text-muted">
                            Category: {alert.category}
                          </span>

                          {/* Affected Resource */}
                          {alert.affected_resource && (
                            <>
                              <span className="text-coastal-text-muted">•</span>
                              <span className="font-mono text-coastal-text font-semibold">
                                Resource: {alert.affected_resource}
                              </span>
                            </>
                          )}

                          <span className="text-coastal-text-muted">•</span>

                          {/* Timestamp */}
                          <span className="text-coastal-text-muted font-mono text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-coastal-text-muted" />
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>

                          <span className="text-coastal-text-muted">•</span>

                          {/* Status (Plain text) */}
                          <span className="font-medium text-coastal-text">
                            Status: <span className="font-semibold">{alert.status}</span>
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-sm font-bold text-coastal-text">{alert.title}</h4>
                          <p className="text-xs text-coastal-text-muted mt-0.5 leading-relaxed">
                            {alert.description}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0">
                        {alert.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => handleAcknowledge(alert.alert_id)}
                              disabled={alertActionId === alert.alert_id}
                              className="px-3 py-1.5 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-xs font-semibold text-coastal-text transition-all active:scale-95 disabled:opacity-50"
                            >
                              {alertActionId === alert.alert_id ? 'Updating...' : 'Acknowledge'}
                            </button>
                            <button
                              onClick={() => handleResolve(alert.alert_id)}
                              disabled={alertActionId === alert.alert_id}
                              className="px-3 py-1.5 bg-coastal-safe/30 hover:bg-coastal-safe/50 border border-coastal-safe rounded-xl text-xs font-semibold text-coastal-safe-text transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Resolve
                            </button>
                          </>
                        )}

                        {alert.status === 'ACKNOWLEDGED' && (
                          <button
                            onClick={() => handleResolve(alert.alert_id)}
                            disabled={alertActionId === alert.alert_id}
                            className="px-3 py-1.5 bg-coastal-safe/30 hover:bg-coastal-safe/50 border border-coastal-safe rounded-xl text-xs font-semibold text-coastal-safe-text transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Resolve
                          </button>
                        )}

                        {isResolved && (
                          <span className="text-xs font-medium text-coastal-safe-text flex items-center gap-1 px-2.5 py-1 bg-coastal-safe/20 border border-coastal-safe rounded-xl">
                            <CheckCircle className="w-3.5 h-3.5" /> Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FORENSIC EVENT TIMELINE FOR HISTORICAL DRILLS */}
      {/* ============================================================== */}
      {activeTab === 'FORENSIC_TIMELINE' && (
        <div className="space-y-6">
          {/* Read-Only Notice */}
          <div className="bg-coastal-powder/40 border border-coastal-cerulean/30 rounded-2xl p-4 text-xs text-coastal-text flex items-start gap-3 shadow-coastal-sm">
            <Info className="w-5 h-5 text-coastal-cerulean shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-coastal-text">
                Forensic Incident Investigation Mode
              </p>
              <p className="text-coastal-text-muted leading-relaxed">
                Inspect the chronological progression of any historical simulation run without altering current network state.
                Includes the exact sequence of resource failures, SPF Dijkstra route recalculations, packet delivery statistics,
                and recovery convergence metrics.
              </p>
            </div>
          </div>

          {/* Drill Selector Bar */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-coastal-text">Select Historical Run:</span>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-coastal-border bg-white text-xs font-mono font-semibold text-coastal-text focus:outline-none focus:ring-1 focus:ring-coastal-cerulean"
              >
                {simRuns.map((r) => (
                  <option key={r.run_id} value={r.run_id}>
                    {r.run_id} ({r.scenario_id || 'Ad-hoc Drill'}) — {r.result}
                  </option>
                ))}
              </select>
            </div>

            {timeline && (
              <div className="flex items-center gap-4 text-xs text-coastal-text-muted">
                <span>
                  Outcome: <strong className={timeline.result === 'SUCCESS' ? 'text-coastal-safe-text' : 'text-coastal-critical'}>{timeline.result}</strong>
                </span>
                <span>•</span>
                <span>
                  Recovery Time: <strong className="font-mono text-coastal-text">{timeline.recovery_duration_sec}s</strong>
                </span>
              </div>
            )}
          </div>

          {/* Forensic Sequence Render */}
          {loadingTimeline ? (
            <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-12 text-center text-coastal-text-muted">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-coastal-cerulean" />
              <p className="text-xs">Reconstructing forensic incident timeline...</p>
            </div>
          ) : !timeline ? (
            <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-8 text-center text-xs text-coastal-text-muted">
              Select a simulation run to inspect its forensic timeline.
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-coastal-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-coastal-cerulean" />
                Chronological Sequence of Forensic Steps
              </h3>

              <div className="space-y-4 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-coastal-border">
                {timeline.steps.map((step) => {
                  let badgeColor = 'bg-coastal-powder text-coastal-cerulean border-coastal-border';
                  if (step.phase === 'FAILURE_INJECTION') badgeColor = 'bg-coastal-rose/20 text-coastal-rose border-coastal-rose/40';
                  if (step.phase === 'ROUTE_RECALCULATION') badgeColor = 'bg-coastal-mauve/20 text-coastal-mauve border-coastal-mauve/40';
                  if (step.phase === 'PACKET_AUDIT') badgeColor = 'bg-coastal-sand/30 text-coastal-brown border-coastal-border';
                  if (step.phase === 'ACCESS_CONTROL') badgeColor = 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe';
                  if (step.phase === 'RECOVERY_CONVERGENCE') badgeColor = 'bg-coastal-safe/20 text-coastal-safe-text border-coastal-safe';

                  return (
                    <div key={step.step_number} className="relative flex items-start gap-4 pl-2">
                      {/* Step Circle */}
                      <div className="w-7 h-7 rounded-full bg-coastal-cream border-2 border-coastal-cerulean text-coastal-cerulean flex items-center justify-center text-xs font-bold shrink-0 z-10 shadow-sm">
                        {step.step_number}
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold ${badgeColor}`}>
                              {step.phase}
                            </span>
                            <span className="font-bold text-coastal-text text-sm">{step.title}</span>
                          </div>
                          <span className="font-mono text-[11px] text-coastal-text-muted">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-xs text-coastal-text-muted leading-relaxed">
                          {step.description}
                        </p>

                        {/* Additional JSON Details if present */}
                        {step.details && Object.keys(step.details).length > 0 && (
                          <div className="bg-white/80 border border-coastal-border rounded-xl p-3 text-[11px] font-mono space-y-1 text-coastal-text">
                            {Object.entries(step.details).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4">
                                <span className="text-coastal-text-muted capitalize">{k.replace(/_/g, ' ')}:</span>
                                <span className="font-semibold text-right">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Related Alerts for this Drill */}
              {timeline.related_alerts && timeline.related_alerts.length > 0 && (
                <div className="mt-8 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-3">
                  <h4 className="text-xs font-bold text-coastal-text uppercase tracking-wider">
                    Alerts Triggered During This Incident Drill
                  </h4>
                  <div className="space-y-2">
                    {timeline.related_alerts.map((a, idx) => (
                      <div key={idx} className="p-3 bg-white border border-coastal-border rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-coastal-critical flex items-center gap-1.5">
                            ● {a.title}
                          </span>
                          <span className="text-coastal-text-muted font-mono">{a.alert_id}</span>
                        </div>
                        <p className="text-coastal-text-muted">{a.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SYSTEM EVENT AUDIT FEED */}
      {/* ============================================================== */}
      {activeTab === 'EVENT_AUDIT' && (
        <div className="space-y-4">
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-4 shadow-coastal-sm flex items-center justify-between text-xs">
            <span className="text-coastal-text-muted font-medium">
              Real-time audit log of persistent simulation events, route flaps, and state transitions.
            </span>
            <span className="font-mono font-bold text-coastal-text">
              Total Logged: {auditEvents.length}
            </span>
          </div>

          {loadingEvents ? (
            <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-12 text-center text-coastal-text-muted">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-coastal-cerulean" />
              <p className="text-xs">Loading event audit records...</p>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-12 text-center text-xs text-coastal-text-muted">
              No audit events found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditEvents.map((evt) => (
                <div
                  key={evt.event_id}
                  className="bg-coastal-cream border border-coastal-border rounded-2xl p-3.5 shadow-coastal-sm text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-coastal-text">{evt.event_type}</span>
                      <span className="text-coastal-text-muted">•</span>
                      <span className="font-mono text-coastal-cerulean font-semibold">{evt.affected_resource}</span>
                      {evt.related_run && (
                        <>
                          <span className="text-coastal-text-muted">•</span>
                          <span className="font-mono text-coastal-text-muted">{evt.related_run}</span>
                        </>
                      )}
                    </div>
                    <p className="text-coastal-text-muted">{evt.message}</p>
                  </div>
                  <div className="font-mono text-[11px] text-coastal-text-muted shrink-0">
                    {new Date(evt.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

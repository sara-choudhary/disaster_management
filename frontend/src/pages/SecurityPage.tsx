import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  ArrowRight,
  Network,
  Layers,
  Info,
  Terminal,
  Cpu,
  Globe,
  Database,
  Key,
} from 'lucide-react';
import {
  fetchAccessRules,
  createAccessRule,
  updateAccessRule,
  deleteAccessRule,
  evaluateConnection,
  fetchDepartments,
  updateDepartment,
} from '../api/access_rules';
import { fetchAlerts, updateAlertStatus, AlertRecord } from '../api/alerts';
import {
  fetchDHCPConfigs,
  requestDHCPLease,
  releaseDHCPLease,
  resetDHCPPool,
  fetchSSHConfigs,
  simulateSSHConnect,
  fetchPortSecurityConfigs,
  testPortSecurity,
  resetSwitchPort,
  fetchNATTable,
  simulateNATFlow,
} from '../api/security_demos';
import {
  AccessRule,
  AccessRuleCreate,
  ACLEvaluationResponse,
  Department,
  DepartmentUpdate,
  DHCPSubnetConfig,
  DHCPLeaseResponse,
  SSHDeviceConfig,
  SSHSimulationResponse,
  PortSecurityConfig,
  PortSecurityTestResponse,
  NATTranslationEntry,
  NATSimulationResponse,
} from '../types';

const DEFAULT_DEPT_IPS: Record<string, string> = {
  'Emergency Control Center': '192.168.10.10',
  'Police Station': '192.168.20.10',
  'Fire Department': '192.168.30.10',
  Hospital: '192.168.40.10',
  'Ambulance Services': '192.168.50.10',
  'Relief Camp': '192.168.60.10',
  'Backup Control Center': '192.168.70.10',
};

type SecurityTab = 'ACL_VLANS' | 'DHCP' | 'SSH' | 'PORT_SECURITY' | 'NAT' | 'AUDIT_LOG';

export const SecurityPage: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<SecurityTab>('ACL_VLANS');

  // Shared Data States
  const [departments, setDepartments] = useState<Department[]>([]);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab 1: Access Control & VLANs States
  const [sourceDept, setSourceDept] = useState<string>('Ambulance Services');
  const [destDept, setDestDept] = useState<string>('Hospital');
  const [sourceIp, setSourceIp] = useState<string>('192.168.50.10');
  const [destIp, setDestIp] = useState<string>('192.168.40.10');
  const [protocol, setProtocol] = useState<string>('TCP');
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<ACLEvaluationResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptVlanForm, setDeptVlanForm] = useState<DepartmentUpdate>({
    vlan_id: 10,
    subnet: '',
    gateway: '',
  });

  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);
  const [ruleForm, setRuleForm] = useState<AccessRuleCreate>({
    rule_id: '',
    source: 'Emergency Control Center',
    destination: 'ALL',
    protocol: 'ANY',
    action: 'PERMIT',
    enabled: true,
  });

  // Tab 2: DHCP States
  const [dhcpConfigs, setDhcpConfigs] = useState<DHCPSubnetConfig[]>([]);
  const [selectedDhcpDept, setSelectedDhcpDept] = useState<string>('ECC');
  const [dhcpAllocating, setDhcpAllocating] = useState<boolean>(false);
  const [dhcpResult, setDhcpResult] = useState<DHCPLeaseResponse | null>(null);

  // Tab 3: SSH States
  const [sshConfigs, setSshConfigs] = useState<SSHDeviceConfig[]>([]);
  const [selectedSshDevice, setSelectedSshDevice] = useState<string>('ROUTER-01');
  const [sshSourceIp, setSshSourceIp] = useState<string>('192.168.10.15');
  const [sshUsername, setSshUsername] = useState<string>('admin_ecc');
  const [sshConnecting, setSshConnecting] = useState<boolean>(false);
  const [sshResult, setSshResult] = useState<SSHSimulationResponse | null>(null);

  // Tab 4: Port Security States
  const [portConfigs, setPortConfigs] = useState<PortSecurityConfig[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<string>('SW-HOSPITAL-Fa0/1');
  const [incomingMac, setIncomingMac] = useState<string>('00:1A:2B:3C:4D:5E');
  const [portTesting, setPortTesting] = useState<boolean>(false);
  const [portResult, setPortResult] = useState<PortSecurityTestResponse | null>(null);

  // Tab 5: NAT States
  const [natTable, setNatTable] = useState<NATTranslationEntry[]>([]);
  const [natSourceDept, setNatSourceDept] = useState<string>('Hospital');
  const [natService, setNatService] = useState<string>('NDMA_CLOUD');
  const [natSimulating, setNatSimulating] = useState<boolean>(false);
  const [natResult, setNatResult] = useState<NATSimulationResponse | null>(null);

  // Tab 6: Alerts Feed Filter
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'SECURITY' | 'ACTIVE'>('ALL');

  // Load all initial data
  const loadAllData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [deptData, rulesData, alertsData, dhcpData, sshData, portData, natData] =
        await Promise.all([
          fetchDepartments(),
          fetchAccessRules(),
          fetchAlerts(),
          fetchDHCPConfigs(),
          fetchSSHConfigs(),
          fetchPortSecurityConfigs(),
          fetchNATTable(),
        ]);
      setDepartments(deptData);
      setAccessRules(rulesData);
      setAlerts(alertsData);
      setDhcpConfigs(dhcpData);
      setSshConfigs(sshData);
      setPortConfigs(portData);
      setNatTable(natData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load network security data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Sync default endpoint IPs
  const handleSourceDeptChange = (deptName: string) => {
    setSourceDept(deptName);
    if (DEFAULT_DEPT_IPS[deptName]) {
      setSourceIp(DEFAULT_DEPT_IPS[deptName]);
    }
  };

  const handleDestDeptChange = (deptName: string) => {
    setDestDept(deptName);
    if (DEFAULT_DEPT_IPS[deptName]) {
      setDestIp(DEFAULT_DEPT_IPS[deptName]);
    }
  };

  // Evaluate ACL connection
  const handleTestConnection = async () => {
    try {
      setEvaluating(true);
      setEvalError(null);
      const res = await evaluateConnection({
        source_department: sourceDept,
        destination_department: destDept,
        source_ip: sourceIp,
        destination_ip: destIp,
        protocol: protocol,
      });
      setEvalResult(res);

      if (!res.permitted) {
        const freshAlerts = await fetchAlerts();
        setAlerts(freshAlerts);
      }
    } catch (err: any) {
      setEvalError(err.message || 'Error evaluating access control rules.');
      setEvalResult(null);
    } finally {
      setEvaluating(false);
    }
  };

  // Rule Toggle
  const handleToggleRule = async (rule: AccessRule) => {
    try {
      const updated = await updateAccessRule(rule.rule_id, {
        enabled: !rule.enabled,
      });
      setAccessRules((prev) =>
        prev.map((r) => (r.rule_id === rule.rule_id ? updated : r))
      );
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to update rule ${rule.rule_id}`);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm(`Are you sure you want to delete access rule ${ruleId}?`)) {
      return;
    }
    try {
      await deleteAccessRule(ruleId);
      setAccessRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to delete rule ${ruleId}`);
    }
  };

  // Save Department VLAN Update
  const handleSaveDeptVlan = async () => {
    if (!editingDept) return;
    try {
      const updated = await updateDepartment(editingDept.code, deptVlanForm);
      setDepartments((prev) =>
        prev.map((d) => (d.code === editingDept.code ? updated : d))
      );
      setEditingDept(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update department VLAN configuration.');
    }
  };

  // Save Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule) {
        const updated = await updateAccessRule(editingRule.rule_id, {
          source: ruleForm.source,
          destination: ruleForm.destination,
          protocol: ruleForm.protocol,
          action: ruleForm.action,
          enabled: ruleForm.enabled,
        });
        setAccessRules((prev) =>
          prev.map((r) => (r.rule_id === editingRule.rule_id ? updated : r))
        );
      } else {
        const created = await createAccessRule(ruleForm);
        setAccessRules((prev) => [...prev, created]);
      }
      setIsRuleModalOpen(false);
      setEditingRule(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save access control rule.');
    }
  };

  // Open Edit Rule
  const handleOpenEditRule = (rule: AccessRule) => {
    setEditingRule(rule);
    setRuleForm({
      rule_id: rule.rule_id,
      source: rule.source,
      destination: rule.destination,
      protocol: rule.protocol,
      action: rule.action,
      enabled: rule.enabled,
    });
    setIsRuleModalOpen(true);
  };

  // Open Create Rule
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    const nextNum = accessRules.length + 1;
    setRuleForm({
      rule_id: `RULE-CUSTOM-${String(nextNum).padStart(2, '0')}`,
      source: departments[0]?.name || 'Emergency Control Center',
      destination: departments[1]?.name || 'Hospital',
      protocol: 'TCP',
      action: 'PERMIT',
      enabled: true,
    });
    setIsRuleModalOpen(true);
  };

  // DHCP Actions
  const handleRequestDHCP = async () => {
    try {
      setDhcpAllocating(true);
      const res = await requestDHCPLease({ department_code: selectedDhcpDept });
      setDhcpResult(res);
      const freshConfigs = await fetchDHCPConfigs();
      setDhcpConfigs(freshConfigs);
    } catch (err: any) {
      alert(err.message || 'DHCP lease allocation failed');
    } finally {
      setDhcpAllocating(false);
    }
  };

  const handleExhaustDHCPPool = async () => {
    try {
      setDhcpAllocating(true);
      for (let i = 0; i < 8; i++) {
        const res = await requestDHCPLease({
          department_code: selectedDhcpDept,
          hostname: `${selectedDhcpDept}-BULK-${i + 1}`,
        });
        setDhcpResult(res);
        if (res.pool_exhausted) break;
      }
      const freshConfigs = await fetchDHCPConfigs();
      setDhcpConfigs(freshConfigs);
    } catch (err: any) {
      alert(err.message || 'Error during pool exhaustion simulation');
    } finally {
      setDhcpAllocating(false);
    }
  };

  const handleReleaseDHCPLease = async (ip: string) => {
    try {
      await releaseDHCPLease(selectedDhcpDept, ip);
      const freshConfigs = await fetchDHCPConfigs();
      setDhcpConfigs(freshConfigs);
    } catch (err: any) {
      alert(err.message || 'Failed to release lease');
    }
  };

  const handleResetDHCP = async () => {
    try {
      await resetDHCPPool(selectedDhcpDept);
      setDhcpResult(null);
      const freshConfigs = await fetchDHCPConfigs();
      setDhcpConfigs(freshConfigs);
    } catch (err: any) {
      alert(err.message || 'Failed to reset pool');
    }
  };

  // SSH Actions
  const handleSimulateSSH = async () => {
    try {
      setSshConnecting(true);
      const res = await simulateSSHConnect({
        target_device_id: selectedSshDevice,
        source_ip: sshSourceIp,
        username: sshUsername,
        auth_method: 'SSH_KEY',
      });
      setSshResult(res);
      if (!res.authenticated) {
        const freshAlerts = await fetchAlerts();
        setAlerts(freshAlerts);
      }
    } catch (err: any) {
      alert(err.message || 'SSH connection simulation failed');
    } finally {
      setSshConnecting(false);
    }
  };

  // Port Security Actions
  const handleTestPortSecurity = async () => {
    try {
      setPortTesting(true);
      const res = await testPortSecurity({
        port_id: selectedPortId,
        incoming_mac: incomingMac,
      });
      setPortResult(res);
      const freshPorts = await fetchPortSecurityConfigs();
      setPortConfigs(freshPorts);
      if (!res.is_authorized && res.security_event_logged) {
        const freshAlerts = await fetchAlerts();
        setAlerts(freshAlerts);
      }
    } catch (err: any) {
      alert(err.message || 'Port security test failed');
    } finally {
      setPortTesting(false);
    }
  };

  const handleResetPort = async (portId: string) => {
    try {
      await resetSwitchPort(portId);
      const freshPorts = await fetchPortSecurityConfigs();
      setPortConfigs(freshPorts);
      setPortResult(null);
    } catch (err: any) {
      alert(err.message || 'Failed to reset switch port');
    }
  };

  // NAT Actions
  const handleSimulateNAT = async () => {
    try {
      setNatSimulating(true);
      const res = await simulateNATFlow({
        source_department: natSourceDept,
        external_destination_service: natService,
      });
      setNatResult(res);
      const freshTable = await fetchNATTable();
      setNatTable(freshTable);
    } catch (err: any) {
      alert(err.message || 'NAT simulation failed');
    } finally {
      setNatSimulating(false);
    }
  };

  // Acknowledge Alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const updated = await updateAlertStatus(alertId, 'ACKNOWLEDGED');
      setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? updated : a)));
    } catch {
      // Handled
    }
  };

  // Current selected DHCP config
  const currentDhcp = useMemo(() => {
    return dhcpConfigs.find((c) => c.department_code === selectedDhcpDept) || dhcpConfigs[0];
  }, [dhcpConfigs, selectedDhcpDept]);

  // Current selected SSH config
  const currentSsh = useMemo(() => {
    return sshConfigs.find((s) => s.device_id === selectedSshDevice) || sshConfigs[0];
  }, [sshConfigs, selectedSshDevice]);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'SECURITY') {
      return alerts.filter((a) => a.category.toUpperCase() === 'SECURITY');
    }
    if (alertFilter === 'ACTIVE') {
      return alerts.filter((a) => a.status.toUpperCase() === 'ACTIVE');
    }
    return alerts;
  }, [alerts, alertFilter]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coastal-text flex items-center gap-2.5">
            <div className="p-2 bg-coastal-rose/20 text-coastal-rose rounded-xl border border-coastal-rose/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            Security, Segmentation & Management Center
          </h1>
          <p className="text-sm text-coastal-text-muted mt-1">
            Departmental VLANs, Access Control Lists, DHCP Pools, SSH Device Management, Switch Port Security, and Perimeter NAT.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-xl text-coastal-text text-xs font-semibold shadow-coastal-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
      </div>

      {/* Prominent Educational Simulation Notice */}
      <div className="bg-coastal-powder/60 border border-coastal-cerulean/30 rounded-2xl p-4 text-xs text-coastal-text flex items-start gap-3">
        <Info className="w-4 h-4 text-coastal-cerulean shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-coastal-cerulean block uppercase tracking-wider text-[11px]">
            Educational Simulation Notice: Software Modeled Network Infrastructure
          </span>
          <p className="mt-0.5 leading-relaxed text-coastal-text-muted">
            All protocols (IEEE 802.1Q VLANs, ACLs, DHCP DORA allocation, SSH management access-classes,
            switch port-security err-disable behavior, and WAN NAT translation) are educational software
            simulations. They demonstrate protocol mechanics without executing commands on real Cisco hardware.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-coastal-critical/15 border border-coastal-critical/40 rounded-2xl text-xs text-coastal-critical-text flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Security Hub Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-coastal-border pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('ACL_VLANS')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'ACL_VLANS'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          VLANs & Access Control (ACL)
        </button>

        <button
          onClick={() => setActiveTab('DHCP')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'DHCP'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          DHCP Address Services
        </button>

        <button
          onClick={() => setActiveTab('SSH')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'SSH'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          SSH Device Management
        </button>

        <button
          onClick={() => setActiveTab('PORT_SECURITY')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'PORT_SECURITY'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Switch Port Security
        </button>

        <button
          onClick={() => setActiveTab('NAT')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'NAT'
              ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Perimeter NAT Gateway
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_LOG')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'AUDIT_LOG'
              ? 'bg-coastal-rose text-white shadow-coastal-sm'
              : 'bg-coastal-cream hover:bg-coastal-powder text-coastal-text border border-coastal-border'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Security Audit Feed ({alerts.filter((a) => a.category.toUpperCase() === 'SECURITY').length})
        </button>
      </div>

      {/* =========================================================================
          TAB 1: Access Control (ACL) & Departmental VLANs
         ========================================================================= */}
      {activeTab === 'ACL_VLANS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Departmental VLAN Segmentation */}
            <div className="lg:col-span-7 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-coastal-cerulean" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Departmental VLAN Segmentation (IEEE 802.1Q)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-coastal-text-muted">
                  {departments.length} Subnets Configured
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-coastal-border text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider">
                      <th className="pb-2">VLAN</th>
                      <th className="pb-2">Department</th>
                      <th className="pb-2">Subnet</th>
                      <th className="pb-2">Gateway</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coastal-border/60">
                    {departments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-coastal-powder/30 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-coastal-cerulean">
                          <span className="px-2 py-0.5 bg-coastal-powder rounded border border-coastal-border">
                            VLAN {dept.vlan_id}
                          </span>
                        </td>
                        <td className="py-2.5 font-semibold text-coastal-text">
                          {dept.name}
                          <span className="block text-[10px] text-coastal-text-muted font-mono">
                            {dept.code} · {dept.department_type}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-coastal-text-muted text-[11px]">
                          {dept.subnet}
                        </td>
                        <td className="py-2.5 font-mono text-coastal-text-muted text-[11px]">
                          {dept.gateway}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setEditingDept(dept);
                              setDeptVlanForm({
                                vlan_id: dept.vlan_id,
                                subnet: dept.subnet,
                                gateway: dept.gateway,
                                priority: dept.priority,
                              });
                            }}
                            className="px-2.5 py-1 bg-coastal-cream hover:bg-coastal-powder border border-coastal-border rounded-lg text-[11px] font-semibold text-coastal-text transition-all"
                          >
                            <Edit3 className="w-3 h-3 inline mr-1" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Access Control Tester */}
            <div className="lg:col-span-5 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-coastal-rose" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Live Access Control Tester
                  </h2>
                </div>
                <span className="text-[10px] font-mono bg-coastal-lavender px-2 py-0.5 rounded text-coastal-text">
                  L3 Routing & L4 Policy
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Source Department & IP
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={sourceDept}
                      onChange={(e) => handleSourceDeptChange(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none"
                    >
                      {departments.map((d) => (
                        <option key={d.code} value={d.name}>
                          {d.name} (VLAN {d.vlan_id})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={sourceIp}
                      onChange={(e) => setSourceIp(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Destination Department & IP
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={destDept}
                      onChange={(e) => handleDestDeptChange(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none"
                    >
                      {departments.map((d) => (
                        <option key={d.code} value={d.name}>
                          {d.name} (VLAN {d.vlan_id})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={destIp}
                      onChange={(e) => setDestIp(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                      Transport Protocol
                    </label>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs"
                    >
                      <option value="TCP">TCP</option>
                      <option value="UDP">UDP</option>
                      <option value="ICMP">ICMP</option>
                      <option value="ANY">ANY</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleTestConnection}
                      disabled={evaluating}
                      className="w-full py-1.5 px-3 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-coastal-sm"
                    >
                      {evaluating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      {evaluating ? 'Evaluating...' : 'Test Connection'}
                    </button>
                  </div>
                </div>
              </div>

              {evalError && (
                <div className="p-3 bg-coastal-critical/15 border border-coastal-critical/30 rounded-xl text-xs text-coastal-critical-text">
                  {evalError}
                </div>
              )}

              {/* Result Card */}
              {evalResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 animate-in fade-in duration-200 ${
                    evalResult.permitted
                      ? 'bg-coastal-safe/25 border-coastal-safe/60 text-coastal-safe-text'
                      : 'bg-coastal-critical/20 border-coastal-critical/50 text-coastal-critical-text'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {evalResult.permitted ? (
                        <CheckCircle2 className="w-5 h-5 text-coastal-safe-text" />
                      ) : (
                        <XCircle className="w-5 h-5 text-coastal-critical-text" />
                      )}
                      <span className="font-bold text-sm tracking-wide">
                        {evalResult.permitted ? 'TRAFFIC PERMITTED' : 'ACCESS DENIED / BLOCKED'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border bg-white/70">
                      {evalResult.action}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed font-sans">{evalResult.explanation}</p>

                  <div className="pt-2 border-t border-black/10 space-y-2 text-[11px]">
                    {/* Layer 3 OSPF Graph Reachability */}
                    <div className="p-2.5 rounded-lg bg-white/80 border border-black/5 text-coastal-text space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Network className="w-3.5 h-3.5 text-coastal-cerulean" />
                          Layer 3 Routing (OSPF SPF Graph):
                        </span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            evalResult.path_reachable
                              ? 'bg-coastal-safe/30 text-coastal-safe-text'
                              : 'bg-coastal-critical/25 text-coastal-critical-text'
                          }`}
                        >
                          {evalResult.path_reachable ? 'PATH REACHABLE' : 'UNREACHABLE'}
                        </span>
                      </div>
                      <div className="text-[10px] text-coastal-text-muted font-mono truncate">
                        {evalResult.path_reachable && evalResult.path.length > 0
                          ? `Hops: ${evalResult.path.join(' ➔ ')}`
                          : 'No topological path found in routing graph.'}
                      </div>
                    </div>

                    {/* Layer 4 ACL Authorization */}
                    <div className="p-2.5 rounded-lg bg-white/80 border border-black/5 text-coastal-text space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-coastal-rose" />
                          Layer 4 Access Authorization (Firewall ACL):
                        </span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            evalResult.permitted
                              ? 'bg-coastal-safe/30 text-coastal-safe-text'
                              : 'bg-coastal-critical/25 text-coastal-critical-text'
                          }`}
                        >
                          {evalResult.action}
                        </span>
                      </div>
                      <div className="text-[10px] text-coastal-text-muted">
                        {evalResult.matched_rule_id
                          ? `Enforced by rule '${evalResult.matched_rule_id}'`
                          : 'Enforced by implicit zero-trust default DENY'}
                      </div>
                    </div>

                    {/* Highlight Separation Notice */}
                    {evalResult.path_reachable && !evalResult.permitted && (
                      <div className="p-2 bg-coastal-warning/30 border border-coastal-warning/60 rounded-lg text-coastal-warning-text font-medium text-[11px] flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Separation Notice:</strong> Physical/OSPF path is fully reachable,
                          but packets are intercepted and dropped at the firewall boundary.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Access Control Rules Table */}
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-coastal-border">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-coastal-cerulean" />
                <h2 className="text-sm font-bold text-coastal-text">
                  Configured Access Control Rules (Firewall Policies)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-coastal-text-muted">
                  {accessRules.filter((r) => r.enabled).length} of {accessRules.length} rules active
                </span>
                <button
                  onClick={handleOpenCreateRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-coastal-cerulean text-white rounded-lg text-xs font-semibold hover:bg-coastal-cerulean/90 shadow-coastal-sm"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-coastal-border text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider">
                    <th className="pb-2.5">Rule ID</th>
                    <th className="pb-2.5">Source</th>
                    <th className="pb-2.5">Destination</th>
                    <th className="pb-2.5">Protocol</th>
                    <th className="pb-2.5">Action</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coastal-border/60">
                  {accessRules.map((rule) => (
                    <tr
                      key={rule.rule_id}
                      className={`hover:bg-coastal-powder/30 transition-colors ${
                        !rule.enabled ? 'opacity-50 bg-black/5' : ''
                      }`}
                    >
                      <td className="py-3 font-mono font-bold text-coastal-text">
                        {rule.rule_id}
                      </td>
                      <td className="py-3 text-coastal-text font-medium">{rule.source}</td>
                      <td className="py-3 text-coastal-text font-medium">{rule.destination}</td>
                      <td className="py-3 font-mono text-coastal-text-muted">{rule.protocol}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                            rule.action.toUpperCase() === 'PERMIT'
                              ? 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe/50'
                              : 'bg-coastal-critical/25 text-coastal-critical-text border-coastal-critical/40'
                          }`}
                        >
                          {rule.action}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            rule.enabled
                              ? 'bg-coastal-safe/20 text-coastal-safe-text border-coastal-safe/40 hover:bg-coastal-safe/30'
                              : 'bg-coastal-cream-dark text-coastal-text-muted border-coastal-border hover:bg-coastal-powder'
                          }`}
                        >
                          {rule.enabled ? (
                            <>
                              <Unlock className="w-3 h-3 text-coastal-safe-text" /> Enabled
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-coastal-text-muted" /> Disabled
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditRule(rule)}
                          className="px-2 py-1 bg-white hover:bg-coastal-powder border border-coastal-border rounded text-[11px] text-coastal-text transition-all"
                        >
                          <Edit3 className="w-3 h-3 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.rule_id)}
                          className="px-2 py-1 bg-white hover:bg-coastal-critical/20 border border-coastal-border rounded text-[11px] text-coastal-critical-text transition-all"
                        >
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DHCP Address Services & Pool Simulator
         ========================================================================= */}
      {activeTab === 'DHCP' && currentDhcp && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Department DHCP Card & Controls (5 cols) */}
            <div className="lg:col-span-5 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-coastal-cerulean" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    DHCP Subnet Scope & Address Pool
                  </h2>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-coastal-powder text-coastal-cerulean font-bold">
                  VLAN {currentDhcp.vlan_id}
                </span>
              </div>

              {/* Department Dropdown Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                  Select Department to Inspect
                </label>
                <select
                  value={selectedDhcpDept}
                  onChange={(e) => {
                    setSelectedDhcpDept(e.target.value);
                    setDhcpResult(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean font-medium"
                >
                  {dhcpConfigs.map((cfg) => (
                    <option key={cfg.department_code} value={cfg.department_code}>
                      {cfg.department_name} (VLAN {cfg.vlan_id} · {cfg.subnet})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subnet Parameters Card */}
              <div className="p-3.5 bg-white border border-coastal-border rounded-xl space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] uppercase">IPv4 Subnet</span>
                    <span className="font-mono font-bold text-coastal-text">{currentDhcp.subnet}</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] uppercase">Subnet Mask</span>
                    <span className="font-mono font-bold text-coastal-text">{currentDhcp.subnet_mask}</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] uppercase">Default Gateway</span>
                    <span className="font-mono font-bold text-coastal-text">{currentDhcp.gateway}</span>
                  </div>
                  <div>
                    <span className="text-coastal-text-muted block text-[10px] uppercase">DNS Server(s)</span>
                    <span className="font-mono font-bold text-coastal-text">{currentDhcp.dns_servers.join(', ')}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-coastal-border/60">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-coastal-text-muted">Dynamic Pool Range:</span>
                    <span className="font-mono font-semibold text-coastal-cerulean">
                      {currentDhcp.pool_start_ip} – {currentDhcp.pool_end_ip}
                    </span>
                  </div>
                  <div className="w-full bg-coastal-powder h-2 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        currentDhcp.utilization_pct >= 100
                          ? 'bg-coastal-critical'
                          : currentDhcp.utilization_pct >= 70
                          ? 'bg-coastal-warning'
                          : 'bg-coastal-cerulean'
                      }`}
                      style={{ width: `${Math.min(100, currentDhcp.utilization_pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-coastal-text-muted mt-1 font-mono">
                    <span>{currentDhcp.active_leases_count} Leased</span>
                    <span>{currentDhcp.available_addresses_count} Available ({currentDhcp.utilization_pct}%)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleRequestDHCP}
                  disabled={dhcpAllocating}
                  className="w-full py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Request Single Lease (DHCP DORA)
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExhaustDHCPPool}
                    disabled={dhcpAllocating || currentDhcp.available_addresses_count === 0}
                    className="py-1.5 px-2 bg-coastal-rose/15 hover:bg-coastal-rose/25 text-coastal-rose border border-coastal-rose/30 rounded-xl text-xs font-semibold transition-all"
                  >
                    Simulate Exhaustion
                  </button>
                  <button
                    onClick={handleResetDHCP}
                    className="py-1.5 px-2 bg-white hover:bg-coastal-powder border border-coastal-border text-coastal-text rounded-xl text-xs font-semibold transition-all"
                  >
                    Reset Pool
                  </button>
                </div>
              </div>

              {/* Allocation Result */}
              {dhcpResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-200 ${
                    dhcpResult.success
                      ? 'bg-coastal-safe/25 border-coastal-safe/50 text-coastal-safe-text'
                      : 'bg-coastal-critical/20 border-coastal-critical/50 text-coastal-critical-text'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {dhcpResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-coastal-safe-text" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-coastal-critical-text" />
                    )}
                    <span>{dhcpResult.success ? 'DHCP ACK: Address Assigned' : 'DHCP Exhaustion Detected'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{dhcpResult.message}</p>
                  {dhcpResult.success && (
                    <div className="pt-1 text-[10px] font-mono border-t border-black/10">
                      <div>IP: {dhcpResult.assigned_ip} · MAC: {dhcpResult.mac_address}</div>
                      <div>Gateway: {dhcpResult.gateway} · DNS: {dhcpResult.dns_servers.join(', ')}</div>
                      <div className="text-coastal-safe-text font-bold mt-0.5">{dhcpResult.subnet_validation}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Active Leases Table (7 cols) */}
            <div className="lg:col-span-7 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-coastal-cerulean" />
                  <h3 className="text-sm font-bold text-coastal-text">
                    Active DHCP Leases for {currentDhcp.department_name}
                  </h3>
                </div>
                <span className="text-xs text-coastal-text-muted">
                  {currentDhcp.leases.length} active binding(s)
                </span>
              </div>

              {currentDhcp.leases.length === 0 ? (
                <div className="py-12 text-center text-xs text-coastal-text-muted">
                  No active leases currently assigned in this departmental pool.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-coastal-border text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider">
                        <th className="pb-2">Assigned IP</th>
                        <th className="pb-2">Client Hostname</th>
                        <th className="pb-2">Client MAC</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-coastal-border/60">
                      {currentDhcp.leases.map((lease) => (
                        <tr key={lease.ip_address} className="hover:bg-coastal-powder/30 transition-colors">
                          <td className="py-2.5 font-mono font-bold text-coastal-text">
                            {lease.ip_address}
                          </td>
                          <td className="py-2.5 font-medium text-coastal-text">
                            {lease.hostname}
                          </td>
                          <td className="py-2.5 font-mono text-[11px] text-coastal-text-muted">
                            {lease.mac_address}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                lease.is_static
                                  ? 'bg-coastal-lavender text-coastal-text'
                                  : 'bg-coastal-powder text-coastal-cerulean'
                              }`}
                            >
                              {lease.is_static ? 'STATIC' : 'DYNAMIC'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            {!lease.is_static && (
                              <button
                                onClick={() => handleReleaseDHCPLease(lease.ip_address)}
                                className="px-2 py-1 bg-white hover:bg-coastal-critical/20 text-coastal-critical-text border border-coastal-border rounded text-[10px] font-semibold transition-all"
                              >
                                Release
                              </button>
                            )}
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
      )}

      {/* =========================================================================
          TAB 3: SSH Device Management Security
         ========================================================================= */}
      {activeTab === 'SSH' && currentSsh && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Device Selection & Simulated Cisco Configuration (6 cols) */}
            <div className="lg:col-span-6 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-coastal-cerulean" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Simulated Cisco IOS SSH Configuration
                  </h2>
                </div>
                <select
                  value={selectedSshDevice}
                  onChange={(e) => {
                    setSelectedSshDevice(e.target.value);
                    setSshResult(null);
                  }}
                  className="px-2 py-1 bg-white border border-coastal-border rounded-lg text-xs font-mono font-bold text-coastal-cerulean focus:outline-none"
                >
                  {sshConfigs.map((cfg) => (
                    <option key={cfg.device_id} value={cfg.device_id}>
                      {cfg.device_id} ({cfg.ip_address})
                    </option>
                  ))}
                </select>
              </div>

              {/* Educational Explanation Box */}
              <div className="p-3 bg-coastal-powder/40 border border-coastal-cerulean/20 rounded-xl text-xs space-y-1">
                <span className="font-bold text-coastal-cerulean text-[11px] block">
                  Why SSHv2 & Access-Class 99?
                </span>
                <p className="text-coastal-text-muted text-[11px] leading-relaxed">
                  Legacy Telnet sends passwords in cleartext. SSHv2 provides cryptographic encryption
                  (AES/ChaCha20) and host key authentication. Cisco <code className="bg-white px-1 py-0.5 rounded border border-coastal-border">access-class 99 in</code> limits
                  VTY management sessions strictly to ECC (VLAN 10) and Backup CC (VLAN 70), dropping connection attempts from public/unauthorized subnets.
                </p>
              </div>

              {/* Code block */}
              <div className="relative">
                <pre className="bg-[#1E1E24] text-[#E0DEF4] p-4 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-black/20 shadow-inner">
                  {currentSsh.simulated_ios_config}
                </pre>
              </div>
            </div>

            {/* Right: Remote Management Connection Simulator (6 cols) */}
            <div className="lg:col-span-6 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-coastal-rose" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Remote Management Access Simulator
                  </h2>
                </div>
                <span className="text-[10px] font-mono bg-coastal-lavender px-2 py-0.5 rounded text-coastal-text">
                  VTY 0 4 · Port 22
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Source IP with Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-coastal-text-muted">
                      Source Management Station IP
                    </label>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSshSourceIp('192.168.10.15')}
                        className="text-coastal-cerulean underline hover:text-coastal-cerulean/80"
                      >
                        [ECC: 192.168.10.15]
                      </button>
                      <button
                        type="button"
                        onClick={() => setSshSourceIp('192.168.60.25')}
                        className="text-coastal-rose underline hover:text-coastal-rose/80"
                      >
                        [Relief Camp: 192.168.60.25]
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sshSourceIp}
                    onChange={(e) => setSshSourceIp(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text font-mono text-xs focus:outline-none focus:border-coastal-cerulean"
                  />
                </div>

                {/* Username with Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-coastal-text-muted">
                      Administrator Username
                    </label>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSshUsername('admin_ecc')}
                        className="text-coastal-cerulean underline"
                      >
                        [admin_ecc]
                      </button>
                      <button
                        type="button"
                        onClick={() => setSshUsername('guest_user')}
                        className="text-coastal-rose underline"
                      >
                        [guest_user]
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean"
                  />
                </div>

                <button
                  onClick={handleSimulateSSH}
                  disabled={sshConnecting}
                  className="w-full py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {sshConnecting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Terminal className="w-3.5 h-3.5" />
                  )}
                  {sshConnecting ? 'Negotiating SSH Handshake...' : 'Simulate SSH Connection'}
                </button>
              </div>

              {/* SSH Result Output */}
              {sshResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2.5 animate-in fade-in duration-200 ${
                    sshResult.authenticated
                      ? 'bg-[#1E1E24] text-white border-black/30'
                      : 'bg-coastal-critical/20 border-coastal-critical/50 text-coastal-critical-text'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sshResult.authenticated ? (
                        <CheckCircle2 className="w-4 h-4 text-coastal-safe" />
                      ) : (
                        <XCircle className="w-4 h-4 text-coastal-critical-text" />
                      )}
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {sshResult.authenticated ? 'SSHv2 Session Established' : 'Connection Rejected / Auth Failed'}
                      </span>
                    </div>
                    {sshResult.authenticated && (
                      <span className="text-[10px] font-mono text-coastal-safe bg-white/10 px-2 py-0.5 rounded">
                        Encrypted: {sshResult.cipher_suite}
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">{sshResult.explanation}</p>

                  {sshResult.authenticated && sshResult.device_summary && (
                    <div className="pt-2 border-t border-white/10 text-[11px] font-mono space-y-1 text-[#9CCFD8]">
                      <div>{sshResult.terminal_prompt}show version</div>
                      <div className="opacity-75 pl-2 text-[10px]">
                        {sshResult.device_summary.os_version}<br />
                        Uptime: {sshResult.device_summary.uptime}<br />
                        Router-ID: {sshResult.device_summary.router_id} · Interfaces: {sshResult.device_summary.active_interfaces.join(', ')}
                      </div>
                    </div>
                  )}

                  {sshResult.security_event_logged && (
                    <div className="text-[10px] text-coastal-critical-text font-mono flex items-center gap-1 pt-1 border-t border-coastal-critical/30">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>Security event logged to database alert and incident audit feed.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: Switch Port Security
         ========================================================================= */}
      {activeTab === 'PORT_SECURITY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Port Security Ingress Frame Tester (5 cols) */}
            <div className="lg:col-span-5 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-coastal-rose" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Port Security Ingress Tester
                  </h2>
                </div>
                <span className="text-[10px] font-mono bg-coastal-lavender px-2 py-0.5 rounded text-coastal-text">
                  Layer 2 MAC Filtering
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Port Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Target Switch Access Port
                  </label>
                  <select
                    value={selectedPortId}
                    onChange={(e) => {
                      setSelectedPortId(e.target.value);
                      setPortResult(null);
                      const p = portConfigs.find((cfg) => cfg.port_id === e.target.value);
                      if (p) setIncomingMac(p.allowed_mac);
                    }}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean font-medium"
                  >
                    {portConfigs.map((p) => (
                      <option key={p.port_id} value={p.port_id}>
                        {p.port_id} ({p.department} · Mode: {p.violation_action})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Incoming MAC with quick presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-coastal-text-muted">
                      Ingress Frame Source MAC Address
                    </label>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const p = portConfigs.find((cfg) => cfg.port_id === selectedPortId);
                          if (p) setIncomingMac(p.allowed_mac);
                        }}
                        className="text-coastal-cerulean underline"
                      >
                        [Authorized MAC]
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncomingMac('DE:AD:BE:EF:CA:FE')}
                        className="text-coastal-rose underline"
                      >
                        [Rogue MAC]
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={incomingMac}
                    onChange={(e) => setIncomingMac(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text font-mono text-xs focus:outline-none focus:border-coastal-cerulean"
                  />
                </div>

                <button
                  onClick={handleTestPortSecurity}
                  disabled={portTesting}
                  className="w-full py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {portTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  {portTesting ? 'Evaluating Frame Ingress...' : 'Inject Ingress Ethernet Frame'}
                </button>
              </div>

              {/* Port Result */}
              {portResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2 animate-in fade-in duration-200 text-xs ${
                    portResult.is_authorized
                      ? 'bg-coastal-safe/25 border-coastal-safe/60 text-coastal-safe-text'
                      : 'bg-coastal-critical/20 border-coastal-critical/50 text-coastal-critical-text'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {portResult.is_authorized ? (
                        <CheckCircle2 className="w-4 h-4 text-coastal-safe-text" />
                      ) : (
                        <XCircle className="w-4 h-4 text-coastal-critical-text" />
                      )}
                      <span className="font-bold text-xs uppercase">
                        {portResult.is_authorized ? 'Authorized Device Allowed' : 'Port Security Violation'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/70 border">
                      {portResult.port_status_after}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed">{portResult.explanation}</p>

                  <div className="pt-2 border-t border-black/10 text-[10px] font-mono space-y-0.5">
                    <div>Status Transition: {portResult.port_status_before} ➔ {portResult.port_status_after}</div>
                    <div>Frames Forwarded: {portResult.traffic_forwarded ? 'YES' : 'NO (DROPPED)'}</div>
                    <div>Violation Action: {portResult.violation_action} · Count: {portResult.violation_count}</div>
                  </div>

                  {portResult.security_event_logged && (
                    <div className="text-[10px] text-coastal-critical-text font-mono flex items-center gap-1 pt-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>Security alert & event logged to persistent database.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Switch Port Security Configuration Table (7 cols) */}
            <div className="lg:col-span-7 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-coastal-cerulean" />
                  <h3 className="text-sm font-bold text-coastal-text">
                    Configured Switch Access Ports
                  </h3>
                </div>
                <span className="text-xs text-coastal-text-muted">
                  {portConfigs.length} Secured Access Ports
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-coastal-border text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider">
                      <th className="pb-2">Port / Switch</th>
                      <th className="pb-2">Department</th>
                      <th className="pb-2">Secure MAC</th>
                      <th className="pb-2">Violation Mode</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Reset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coastal-border/60">
                    {portConfigs.map((port) => (
                      <tr key={port.port_id} className="hover:bg-coastal-powder/30 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-coastal-text">
                          {port.port_id}
                          <span className="block text-[10px] text-coastal-text-muted font-normal">
                            {port.switch_id}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-coastal-text">
                          {port.department} (VLAN {port.vlan_id})
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-coastal-text-muted">
                          {port.allowed_mac}
                        </td>
                        <td className="py-2.5 font-mono text-[11px] font-semibold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              port.violation_action === 'SHUTDOWN'
                                ? 'bg-coastal-critical/20 text-coastal-critical-text'
                                : port.violation_action === 'RESTRICT'
                                ? 'bg-coastal-warning/25 text-coastal-warning-text'
                                : 'bg-coastal-powder text-coastal-cerulean'
                            }`}
                          >
                            {port.violation_action}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              port.operational_status === 'SECURE_UP'
                                ? 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe/50'
                                : port.operational_status === 'ERR_DISABLED'
                                ? 'bg-coastal-critical/30 text-coastal-critical-text border-coastal-critical/60'
                                : 'bg-coastal-warning/30 text-coastal-warning-text border-coastal-warning/50'
                            }`}
                          >
                            {port.operational_status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleResetPort(port.port_id)}
                            className="px-2 py-1 bg-white hover:bg-coastal-powder border border-coastal-border rounded text-[10px] font-semibold text-coastal-text transition-all"
                            title="Simulate 'shutdown' followed by 'no shutdown' to recover port"
                          >
                            Reset
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: Perimeter NAT Gateway (Private-to-Public Translation)
         ========================================================================= */}
      {activeTab === 'NAT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Outbound WAN Simulator (5 cols) */}
            <div className="lg:col-span-5 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-coastal-cerulean" />
                  <h2 className="text-sm font-bold text-coastal-text">
                    Outbound WAN NAT Simulator
                  </h2>
                </div>
                <span className="text-[10px] font-mono bg-coastal-powder text-coastal-cerulean px-2 py-0.5 rounded">
                  WAN: 203.0.113.1
                </span>
              </div>

              {/* Educational Notice: Internal vs External */}
              <div className="p-3 bg-coastal-lavender/50 border border-coastal-border rounded-xl text-xs space-y-1">
                <span className="font-bold text-coastal-text text-[11px] block">
                  Direct OSPF Routing vs NAT Overload
                </span>
                <p className="text-coastal-text-muted text-[11px] leading-relaxed">
                  <strong>Crucial architectural distinction:</strong> Internal communications between emergency departments
                  (ECC, Police, Hospital, Fire) route <em>directly</em> via Layer 3 OSPF without NAT. NAT is only
                  invoked when packets cross Core Router 1&apos;s perimeter WAN interface to reach external public Internet/NDMA services.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Internal Source Department
                  </label>
                  <select
                    value={natSourceDept}
                    onChange={(e) => setNatSourceDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.code} value={d.name}>
                        {d.name} (VLAN {d.vlan_id} · {d.subnet})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    External WAN Destination Service
                  </label>
                  <select
                    value={natService}
                    onChange={(e) => setNatService(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none"
                  >
                    <option value="NDMA_CLOUD">National Disaster Management (NDMA) Cloud (198.51.100.50:443)</option>
                    <option value="WEATHER_SAT">Geostationary Weather Satellite Downlink (198.51.100.88:8080)</option>
                    <option value="CENTRAL_SUPPLY">National Medical Supply Registry (198.51.100.120:443)</option>
                  </select>
                </div>

                <button
                  onClick={handleSimulateNAT}
                  disabled={natSimulating}
                  className="w-full py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {natSimulating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  {natSimulating ? 'Translating Headers...' : 'Simulate Outbound NAT Request'}
                </button>
              </div>

              {/* Translation Diagram Result */}
              {natResult && (
                <div className="p-4 bg-white border border-coastal-border rounded-xl space-y-3 text-xs animate-in fade-in duration-200 shadow-coastal-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-coastal-text text-xs">
                      Address Translation Flow Verified
                    </span>
                    <span className="px-2 py-0.5 bg-coastal-safe/30 text-coastal-safe-text font-mono font-bold rounded text-[10px]">
                      PAT ACTIVE
                    </span>
                  </div>

                  {/* Packet Header Visualizer */}
                  <div className="p-3 bg-coastal-powder/40 rounded-lg space-y-2 text-[11px] font-mono border border-coastal-border">
                    <div className="text-[10px] text-coastal-cerulean font-bold uppercase tracking-wider">
                      Outbound Header Rewrite:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-white rounded border border-coastal-border text-coastal-text">
                        Src: {natResult.inside_local}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-coastal-cerulean" />
                      <span className="px-2 py-1 bg-coastal-cerulean text-white rounded font-bold">
                        NAT Src: {natResult.inside_global}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-coastal-cerulean" />
                      <span className="px-2 py-1 bg-white rounded border border-coastal-border text-coastal-text">
                        Dst: {natResult.outside_global}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-coastal-text-muted leading-relaxed">
                    {natResult.internal_routing_notice}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Active NAT Translation Table (7 cols) */}
            <div className="lg:col-span-7 bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-coastal-cerulean" />
                  <h3 className="text-sm font-bold text-coastal-text">
                    Active NAT/PAT Translation Table (Cisco Router 1)
                  </h3>
                </div>
                <span className="text-xs text-coastal-text-muted">
                  {natTable.length} Active Sessions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-coastal-border text-[11px] font-semibold text-coastal-text-muted uppercase tracking-wider">
                      <th className="pb-2">Proto</th>
                      <th className="pb-2">Inside Local (Private)</th>
                      <th className="pb-2">Inside Global (Public WAN)</th>
                      <th className="pb-2">Outside Global (Target)</th>
                      <th className="pb-2">Flow Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coastal-border/60">
                    {natTable.map((entry) => (
                      <tr key={entry.id} className="hover:bg-coastal-powder/30 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-coastal-cerulean">
                          {entry.protocol}
                        </td>
                        <td className="py-2.5 font-mono text-coastal-text text-[11px]">
                          {entry.inside_local_ip}:{entry.inside_local_port}
                        </td>
                        <td className="py-2.5 font-mono font-bold text-coastal-cerulean text-[11px]">
                          {entry.inside_global_ip}:{entry.inside_global_port}
                        </td>
                        <td className="py-2.5 font-mono text-coastal-text text-[11px]">
                          {entry.outside_global_ip}:{entry.outside_global_port}
                        </td>
                        <td className="py-2.5 text-coastal-text-muted text-[11px] truncate max-w-[180px]">
                          {entry.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: Security Audit Log & Emergency Alerts Feed
         ========================================================================= */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-5 shadow-coastal-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-coastal-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-coastal-rose" />
              <h2 className="text-sm font-bold text-coastal-text">
                Security Violation & Emergency Alert Audit Feed
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-coastal-text-muted">Filter:</span>
              <button
                onClick={() => setAlertFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  alertFilter === 'ALL'
                    ? 'bg-coastal-cerulean text-white border-coastal-cerulean'
                    : 'bg-white text-coastal-text-muted border-coastal-border'
                }`}
              >
                All ({alerts.length})
              </button>
              <button
                onClick={() => setAlertFilter('SECURITY')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  alertFilter === 'SECURITY'
                    ? 'bg-coastal-rose text-white border-coastal-rose'
                    : 'bg-white text-coastal-text-muted border-coastal-border'
                }`}
              >
                Security Only ({alerts.filter((a) => a.category.toUpperCase() === 'SECURITY').length})
              </button>
              <button
                onClick={() => setAlertFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  alertFilter === 'ACTIVE'
                    ? 'bg-coastal-warning text-coastal-warning-text border-coastal-warning'
                    : 'bg-white text-coastal-text-muted border-coastal-border'
                }`}
              >
                Active ({alerts.filter((a) => a.status.toUpperCase() === 'ACTIVE').length})
              </button>
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-coastal-text-muted">
              No alerts or security violations matching this filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.alert_id}
                  className="bg-white border border-coastal-border rounded-xl p-3.5 shadow-coastal-sm flex items-start gap-3"
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-coastal-critical/20 text-coastal-critical-text'
                        : alert.severity === 'HIGH' || alert.severity === 'MEDIUM'
                        ? 'bg-coastal-warning/20 text-coastal-warning-text'
                        : 'bg-coastal-powder text-coastal-cerulean'
                    }`}
                  >
                    {alert.severity === 'CRITICAL' ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : alert.severity === 'HIGH' || alert.severity === 'MEDIUM' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-coastal-text">{alert.title}</span>
                      <span className="text-[10px] font-mono text-coastal-text-muted">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-coastal-text-muted mt-1 leading-relaxed text-[11px]">
                      {alert.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-coastal-border/60 text-[10px] font-mono text-coastal-text-muted">
                      <span>CATEGORY: {alert.category}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            alert.status === 'ACTIVE'
                              ? 'bg-coastal-warning/25 text-coastal-warning-text border border-coastal-warning/40'
                              : 'bg-coastal-safe/25 text-coastal-safe-text border border-coastal-safe/40'
                          }`}
                        >
                          {alert.status}
                        </span>
                        {alert.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.alert_id)}
                            className="px-2 py-0.5 bg-coastal-cerulean text-white rounded font-sans text-[10px] font-semibold hover:bg-coastal-cerulean/90"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Department VLAN Modal */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl max-w-md w-full p-6 shadow-coastal-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
              <h3 className="text-sm font-bold text-coastal-text">
                Edit VLAN & Subnet: {editingDept.name}
              </h3>
              <button
                onClick={() => setEditingDept(null)}
                className="text-coastal-text-muted hover:text-coastal-text"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                  VLAN ID (IEEE 802.1Q)
                </label>
                <input
                  type="number"
                  value={deptVlanForm.vlan_id}
                  onChange={(e) =>
                    setDeptVlanForm({ ...deptVlanForm, vlan_id: parseInt(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                  IPv4 Subnet (CIDR)
                </label>
                <input
                  type="text"
                  value={deptVlanForm.subnet}
                  onChange={(e) =>
                    setDeptVlanForm({ ...deptVlanForm, subnet: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                  Default Gateway Router Interface
                </label>
                <input
                  type="text"
                  value={deptVlanForm.gateway}
                  onChange={(e) =>
                    setDeptVlanForm({ ...deptVlanForm, gateway: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs focus:outline-none focus:border-coastal-cerulean font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-coastal-border text-xs">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-3.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text font-semibold hover:bg-coastal-powder"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDeptVlan}
                className="px-3.5 py-1.5 bg-coastal-cerulean text-white rounded-lg font-semibold hover:bg-coastal-cerulean/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRule}
            className="bg-coastal-cream border border-coastal-border rounded-2xl max-w-lg w-full p-6 shadow-coastal-lg space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-coastal-border">
              <h3 className="text-sm font-bold text-coastal-text">
                {editingRule ? `Edit Access Rule: ${editingRule.rule_id}` : 'Create New Access Rule'}
              </h3>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="text-coastal-text-muted hover:text-coastal-text"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                  Rule Identifier
                </label>
                <input
                  type="text"
                  value={ruleForm.rule_id}
                  disabled={!!editingRule}
                  onChange={(e) => setRuleForm({ ...ruleForm, rule_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs font-mono disabled:opacity-60"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Source (Dept or Subnet)
                  </label>
                  <input
                    type="text"
                    value={ruleForm.source}
                    onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Destination (Dept or Subnet)
                  </label>
                  <input
                    type="text"
                    value={ruleForm.destination}
                    onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Protocol
                  </label>
                  <select
                    value={ruleForm.protocol}
                    onChange={(e) => setRuleForm({ ...ruleForm, protocol: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs font-mono"
                  >
                    <option value="ANY">ANY</option>
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-coastal-text-muted mb-1">
                    Action
                  </label>
                  <select
                    value={ruleForm.action}
                    onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-coastal-border rounded-lg text-coastal-text text-xs font-semibold"
                  >
                    <option value="PERMIT">PERMIT</option>
                    <option value="DENY">DENY</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleEnabled"
                  checked={ruleForm.enabled}
                  onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                  className="rounded border-coastal-border text-coastal-cerulean"
                />
                <label htmlFor="ruleEnabled" className="text-xs font-medium text-coastal-text">
                  Enable Rule Immediately
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-coastal-border">
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="px-3.5 py-1.5 bg-white border border-coastal-border rounded-lg text-coastal-text font-semibold hover:bg-coastal-powder"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-coastal-cerulean text-white rounded-lg font-semibold hover:bg-coastal-cerulean/90"
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

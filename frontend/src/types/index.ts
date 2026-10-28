export type NodeStatus = 'active' | 'degraded' | 'offline';

export type NodeType =
  | 'command_center'
  | 'hospital'
  | 'relay'
  | 'shelter'
  | 'field_unit'
  | 'router'
  | 'switch'
  | 'server'
  | 'endpoint';

export interface NetworkNode {
  id: number;
  node_id: string;
  device_id?: string;
  name: string;
  node_type: NodeType | string;
  department?: string;
  ip_address?: string;
  status: NodeStatus;
  battery_level: number;
  pos_x: number;
  pos_y: number;
  extra_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type LinkState = 'UP' | 'DEGRADED' | 'DOWN';

export interface NetworkLink {
  id: number;
  link_id: string;
  source_node_id: string;
  destination_node_id: string;
  bandwidth: number;
  latency: number;
  operational_state: LinkState;
  link_cost: number;
  link_type: 'backbone' | 'secondary' | 'distribution' | 'access' | 'ordinary' | string;
  extra_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  department_type: string;
  subnet: string;
  gateway: string;
  vlan_id: number;
  priority: number;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  links: NetworkLink[];
  departments: Department[];
  metrics: Record<string, any>;
  subnets?: Array<{
    department: string;
    code: string;
    subnet: string;
    gateway: string;
    vlan_id: number;
  }>;
  status?: string;
}

export type MessagePriority =
  | 'CRITICAL_SOS'
  | 'HIGH_MEDICAL'
  | 'NORMAL_LOGISTICS'
  | 'LOW_ROUTINE';

export type MessageStatus =
  | 'QUEUED'
  | 'ROUTING'
  | 'DELIVERED'
  | 'FAILED'
  | 'DROPPED';

export interface EmergencyMessage {
  id: number;
  message_id: string;
  sender_id: string;
  recipient_id: string;
  priority: MessagePriority;
  status: MessageStatus;
  content: string;
  hop_count: number;
  route_taken: string;
  created_at: string;
  delivered_at?: string | null;
}

export interface HopDetail {
  step: number;
  from_node: string;
  to_node: string;
  latency_ms: number;
  status: string;
  remaining_battery: number;
}

export interface SimulationRunRequest {
  source_node_id: string;
  target_node_id: string;
  priority: MessagePriority;
  message_content: string;
  simulate_node_failures?: string[];
}

export interface SimulationRunResponse {
  simulation_id: string;
  success: boolean;
  priority: MessagePriority;
  source_node_id: string;
  target_node_id: string;
  path: string[];
  total_hops: number;
  total_latency_ms: number;
  delivery_status: string;
  details: HopDetail[];
  message_id: string;
  transmission_attempts?: number;
  retransmissions?: number;
  alternate_route_selected?: boolean;
  retry_log?: string[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  app_name: string;
  version: string;
  timestamp: string;
  database: string;
  details?: Record<string, unknown>;
}

export interface RecoveryMetrics {
  detection_delay_ms: number;
  spf_calculation_ms: number;
  fib_update_ms: number;
  propagation_delay_ms: number;
  total_recovery_duration_sec: number;
  reachability_percentage: number;
  timing_model: string;
}

export interface FailureInjectionResponse {
  status: string;
  message: string;
  resource_id: string;
  resource_type: string;
  action: string;
  link?: NetworkLink;
  node?: NetworkNode;
  recovery_metrics?: RecoveryMetrics;
  before_path?: string[];
  after_path?: string[];
  alternate_path_selected: boolean;
  route_changes: string[];
  reachability: Record<string, boolean>;
  simulation_run_id?: string;
}

export interface BaselineResetResponse {
  status: string;
  message: string;
  restored_nodes_count: number;
  restored_links_count: number;
  resolved_alerts_count: number;
  historical_runs_preserved: number;
  historical_events_preserved: number;
  timestamp: string;
}

export interface ReachabilityMatrixResponse {
  source_node_id: string;
  total_destinations: number;
  reachable_destinations: number;
  reachability_percentage: number;
  destinations: Record<
    string,
    {
      name: string;
      node_type: string;
      department: string;
      reachable: boolean;
      cost: number | null;
      hops: number;
      path: string[];
      alternate_path_selected?: boolean;
      status: string;
    }
  >;
}

export interface NetworkEventItem {
  id: number;
  event_id: string;
  timestamp: string;
  event_type: string;
  severity: string;
  message: string;
  affected_resource: string;
  related_run?: string;
}

export interface NetworkMetrics {
  total_nodes: number;
  active_nodes: number;
  offline_nodes: number;
  degraded_nodes: number;
  total_links: number;
  up_links: number;
  down_links: number;
  degraded_links: number;
  average_latency_ms: number;
  total_bandwidth_mbps: number;
  network_health_score: number;
  active_alerts_count: number;
}

export interface RouteHopDetail {
  step: number;
  from_node: string;
  to_node: string;
  link_id?: string;
  cost: number;
  cumulative_cost: number;
  latency_ms: number;
  link_type: string;
}

export interface RoutePath {
  source: string;
  destination: string;
  priority: string;
  path_exists: boolean;
  reachability: boolean;
  status: string;
  hops: number;
  cost: number | null;
  estimated_latency_ms: number;
  path: string[];
  next_hop?: string;
  hop_list: RouteHopDetail[];
  alternate_path_selected: boolean;
  route_changes: string[];
  algorithm: string;
}

export interface TrafficClass {
  id?: number;
  code: string;
  name: string;
  priority: number;
  bandwidth_req: number;
  latency_budget: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClassQoSResult {
  traffic_class: string;
  class_name: string;
  priority: number;
  offered_mbps: number;
  allocated_mbps: number;
  packets_sent: number;
  packets_delivered: number;
  packets_lost: number;
  delivery_ratio_pct: number;
  estimated_latency_ms: number;
  queue_delay_ms: number;
  status: string;
}

export interface QoSSimulationRequest {
  source_department: string;
  destination_department: string;
  traffic_class: string;
  packet_count: number;
  offered_load_mbps: number;
  test_duration_sec: number;
  competing_traffic: boolean;
  scheduler_policy?: string;
}

export interface QoSSimulationResponse {
  simulation_id: string;
  timestamp: string;
  source_department: string;
  destination_department: string;
  selected_class: string;
  path: string[];
  bottleneck_link_id: string;
  bottleneck_capacity_mbps: number;
  total_offered_load_mbps: number;
  link_utilization_pct: number;
  is_congested: boolean;
  scheduler_policy: string;
  test_duration_sec: number;
  packets_sent: number;
  packets_delivered: number;
  packets_lost: number;
  delivery_ratio_pct: number;
  estimated_latency_ms: number;
  queue_delay_ms: number;
  results_by_class: ClassQoSResult[];
  simulated_estimate_notice: string;
  qos_vs_routing_explanation: string;
}

export interface AccessRule {
  id: number;
  rule_id: string;
  source: string;
  destination: string;
  protocol: string;
  action: 'PERMIT' | 'DENY' | string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AccessRuleCreate {
  rule_id: string;
  source: string;
  destination: string;
  protocol: string;
  action: string;
  enabled: boolean;
}

export interface AccessRuleUpdate {
  source?: string;
  destination?: string;
  protocol?: string;
  action?: string;
  enabled?: boolean;
}

export interface ACLEvaluationRequest {
  source_department?: string;
  destination_department?: string;
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  port?: number;
}

export interface ACLEvaluationResponse {
  permitted: boolean;
  action: string;
  matched_rule_id?: string | null;
  matched_rule?: AccessRule | null;
  explanation: string;
  source_department: string;
  destination_department: string;
  source_vlan_id: number;
  destination_vlan_id: number;
  source_ip: string;
  destination_ip: string;
  protocol: string;
  path_reachable: boolean;
  path: string[];
  routing_status: string;
  security_event_logged: boolean;
  disclaimer: string;
}

export interface DepartmentUpdate {
  name?: string;
  department_type?: string;
  subnet?: string;
  gateway?: string;
  vlan_id?: number;
  priority?: number;
}

// ---------------- Educational Security Demo Types ----------------

export interface DHCPLease {
  ip_address: string;
  mac_address: string;
  hostname: string;
  leased_at: string;
  expires_at: string;
  is_static: boolean;
}

export interface DHCPSubnetConfig {
  department_code: string;
  department_name: string;
  vlan_id: number;
  subnet: string;
  subnet_mask: string;
  gateway: string;
  dns_servers: string[];
  pool_start_ip: string;
  pool_end_ip: string;
  total_pool_addresses: number;
  active_leases_count: number;
  available_addresses_count: number;
  utilization_pct: number;
  leases: DHCPLease[];
}

export interface DHCPLeaseRequest {
  department_code: string;
  hostname?: string;
  mac_address?: string;
}

export interface DHCPLeaseResponse {
  success: boolean;
  assigned_ip?: string | null;
  subnet: string;
  subnet_mask: string;
  gateway: string;
  dns_servers: string[];
  mac_address: string;
  hostname: string;
  lease_time_sec: number;
  subnet_validation: string;
  message: string;
  pool_exhausted: boolean;
}

export interface SSHDeviceConfig {
  device_id: string;
  device_name: string;
  device_type: string;
  ip_address: string;
  management_vlan: number;
  allowed_management_subnets: string[];
  ssh_version: string;
  ciphers: string[];
  rsa_key_bits: number;
  simulated_ios_config: string;
}

export interface SSHSimulationRequest {
  target_device_id: string;
  source_ip: string;
  username: string;
  auth_method: string;
  password?: string;
}

export interface SSHSimulationResponse {
  authenticated: boolean;
  target_device: string;
  source_ip: string;
  source_subnet_authorized: boolean;
  session_id?: string | null;
  cipher_suite?: string | null;
  terminal_prompt?: string | null;
  device_summary?: Record<string, any> | null;
  explanation: string;
  security_event_logged: boolean;
  disclaimer: string;
}

export interface PortSecurityConfig {
  port_id: string;
  switch_id: string;
  department: string;
  vlan_id: number;
  allowed_mac: string;
  max_mac_count: number;
  violation_action: string;
  operational_status: string;
  violation_count: number;
  last_violation_mac?: string | null;
  last_violation_time?: string | null;
}

export interface PortSecurityTestRequest {
  port_id: string;
  incoming_mac: string;
  frame_description?: string;
}

export interface PortSecurityTestResponse {
  port_id: string;
  switch_id: string;
  incoming_mac: string;
  allowed_mac: string;
  is_authorized: boolean;
  violation_action: string;
  port_status_before: string;
  port_status_after: string;
  traffic_forwarded: boolean;
  violation_count: number;
  explanation: string;
  security_event_logged: boolean;
  disclaimer: string;
}

export interface NATTranslationEntry {
  id: number;
  protocol: string;
  inside_local_ip: string;
  inside_local_port: number;
  inside_global_ip: string;
  inside_global_port: number;
  outside_local_ip: string;
  outside_local_port: number;
  outside_global_ip: string;
  outside_global_port: number;
  description: string;
  created_at: string;
}

export interface NATSimulationRequest {
  source_department: string;
  source_local_ip?: string;
  source_local_port?: number;
  external_destination_service: string;
}

export interface NATSimulationResponse {
  translation_success: boolean;
  source_department: string;
  flow_type: string;
  nat_applied: boolean;
  inside_local: string;
  inside_global: string;
  outside_global: string;
  service_name: string;
  header_rewrite_summary: string;
  internal_routing_notice: string;
  translation_entry?: NATTranslationEntry | null;
  disclaimer: string;
}

export interface AvailabilityPoint {
  timestamp: string;
  time_label: string;
  availability_pct: number;
  node_availability_pct: number;
  link_availability_pct: number;
  reachability_pct: number;
  run_id?: string;
  drill_name?: string;
}

export interface LatencyPoint {
  timestamp: string;
  time_label: string;
  estimated_latency_ms: number;
  baseline_target_ms: number;
  warning_threshold_ms: number;
  run_id?: string;
}

export interface PacketMetricPoint {
  timestamp: string;
  time_label: string;
  delivery_ratio_pct: number;
  packet_loss_pct: number;
  total_packets: number;
  delivered_packets: number;
  dropped_packets: number;
  run_id?: string;
}

export interface LinkUtilizationPoint {
  link_id: string;
  link_name: string;
  source_node_id: string;
  destination_node_id: string;
  operational_state: string;
  bandwidth_mbps: number;
  current_load_mbps: number;
  utilization_pct: number;
  link_cost: number;
  is_secondary: boolean;
}

export interface TrafficClassVolumePoint {
  timestamp: string;
  time_label: string;
  critical_mbps: number;
  high_mbps: number;
  normal_mbps: number;
  low_mbps: number;
  total_offered_mbps: number;
  run_id?: string;
}

export interface RecoveryDurationPoint {
  timestamp: string;
  time_label: string;
  recovery_duration_sec: number;
  target_sla_sec: number;
  scenario_name: string;
  result: string;
  run_id: string;
}

export interface RouteChangesPoint {
  timestamp: string;
  time_label: string;
  route_changes_count: number;
  alternate_paths_activated: number;
  events_logged: number;
  run_id?: string;
}

export interface TelemetrySnapshot {
  total_simulation_runs: number;
  current_health_score: number;
  current_availability_pct: number;
  current_avg_latency_ms: number;
  active_nodes: number;
  total_nodes: number;
  active_links: number;
  total_links: number;
  active_alerts: number;
  modeled_status: string;
}

export interface TelemetryResponse {
  time_range: string;
  data_points_count: number;
  has_sufficient_data: boolean;
  explanation?: string | null;
  snapshot: TelemetrySnapshot;
  availability_over_time: AvailabilityPoint[];
  latency_over_time: LatencyPoint[];
  packet_delivery_and_loss: PacketMetricPoint[];
  link_utilization: LinkUtilizationPoint[];
  traffic_volume_by_class: TrafficClassVolumePoint[];
  recovery_duration: RecoveryDurationPoint[];
  route_changes_over_time: RouteChangesPoint[];
  disclaimer: string;
}

export interface AlternativeRouteItem {
  rank: number;
  path: string[];
  total_cost: number;
  hop_count: number;
  role: string;
  valid_after_failure: boolean;
}

export interface AlgorithmComparisonItem {
  algorithm_key: string;
  algorithm_name: string;
  path: string[];
  total_cost: number | null;
  hop_count: number;
  reachable: boolean;
  execution_time_ms: number;
  time_complexity: string;
  space_complexity: string;
  purpose: string;
  assumptions: string;
  scalability_warning?: string | null;
  is_optimal: boolean;
  ranked_alternatives?: AlternativeRouteItem[] | null;
}

export interface AlgorithmComparisonResponse {
  source: string;
  destination: string;
  active_nodes_count: number;
  active_links_count: number;
  k_paths_requested: number;
  algorithms: AlgorithmComparisonItem[];
  all_pairs_matrix_summary?: Record<string, any> | null;
  educational_notes: string;
  timestamp: string;
}

export interface SchedulerComparisonItem {
  policy_key: string;
  policy_name: string;
  description: string;
  starvation_observed: boolean;
  starvation_safeguard_active: boolean;
  critical_delivery_pct: number;
  normal_delivery_pct: number;
  low_delivery_pct: number;
  results_by_class: Array<{
    traffic_class: string;
    priority: number;
    offered_rate_mbps: number;
    allocated_bandwidth_mbps: number;
    queue_delay_ms: number;
    loss_ratio_pct: number;
    delivery_ratio_pct: number;
    starved: boolean;
    qos_compliance: boolean;
  }>;
}

export interface SchedulerComparisonResponse {
  source_department: string;
  destination_department: string;
  bottleneck_link_id: string;
  bottleneck_capacity_mbps: number;
  total_offered_load_mbps: number;
  is_congested: boolean;
  schedulers: SchedulerComparisonItem[];
  engineering_insights: string;
}



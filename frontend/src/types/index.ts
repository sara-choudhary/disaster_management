export type NodeStatus = 'active' | 'degraded' | 'offline';

export type NodeType =
  | 'command_center'
  | 'hospital'
  | 'relay'
  | 'shelter'
  | 'field_unit';

export interface NetworkNode {
  id: number;
  node_id: string;
  name: string;
  node_type: NodeType | string;
  status: NodeStatus;
  battery_level: number;
  pos_x: number;
  pos_y: number;
  created_at: string;
  updated_at: string;
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
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  app_name: string;
  version: string;
  timestamp: string;
  database: string;
  details?: Record<string, unknown>;
}

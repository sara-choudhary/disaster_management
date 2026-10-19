export type WebSocketConnectionState =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'POLLING_FALLBACK';

export interface StructuredNetworkEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | string;
  resource_id?: string;
  affected_resource?: string;
  event?: string;
  message?: string;
  status?: string;
  action?: string;
  run_id?: string;
  scenario_id?: string;
  alert_id?: string;
  before_path?: string[];
  after_path?: string[];
  route_changes?: string[];
  reachability?: Record<string, boolean>;
  packet_statistics?: Record<string, any>;
  recovery_duration?: number;
  delivery_rate?: number;
  latency_ms?: number;
  traffic_class?: string;
  [key: string]: any;
}

export type EventSubscriber = (event: StructuredNetworkEvent) => void;

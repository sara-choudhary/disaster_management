import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  WebSocketConnectionState,
  StructuredNetworkEvent,
  EventSubscriber,
} from '../types/events';

interface NetworkEventContextType {
  connectionState: WebSocketConnectionState;
  isLive: boolean;
  lastEvent: StructuredNetworkEvent | null;
  recentEvents: StructuredNetworkEvent[];
  subscribe: (eventType: string | '*', callback: EventSubscriber) => () => void;
  reconnect: () => void;
  sendPing: () => void;
}

const NetworkEventContext = createContext<NetworkEventContextType | undefined>(undefined);

// Maximum event cache size for deduplication ring buffer
const MAX_SEEN_EVENT_IDS = 500;
// Exponential backoff configuration
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;
const BACKOFF_MULTIPLIER = 1.5;
const MAX_RECONNECT_ATTEMPTS_BEFORE_POLL = 3;
const POLLING_INTERVAL_MS = 6000;

interface NetworkEventProviderProps {
  children: ReactNode;
  urlOverride?: string;
  disableAutoConnect?: boolean;
}

export const NetworkEventProvider: React.FC<NetworkEventProviderProps> = ({
  children,
  urlOverride,
  disableAutoConnect = false,
}) => {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('CONNECTING');
  const [lastEvent, setLastEvent] = useState<StructuredNetworkEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<StructuredNetworkEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const subscribersRef = useRef<Map<string, Set<EventSubscriber>>>(new Map());

  // Deduplication cache (ordered ring buffer + set)
  const seenEventIdsSet = useRef<Set<string>>(new Set());
  const seenEventIdsList = useRef<string[]>([]);

  // Stale event prevention: latest confirmed timestamp per resource
  const resourceTimestampsRef = useRef<Map<string, number>>(new Map());

  // Construct WebSocket URL
  const getWebSocketUrl = useCallback((): string => {
    if (urlOverride) return urlOverride;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    return `${protocol}//${host}/ws/network-events`;
  }, [urlOverride]);

  // Event dispatcher to registered subscribers
  const dispatchEvent = useCallback((event: StructuredNetworkEvent) => {
    // 1. Event Deduplication
    if (event.event_id) {
      if (seenEventIdsSet.current.has(event.event_id)) {
        // Discard duplicate event
        return;
      }
      seenEventIdsSet.current.add(event.event_id);
      seenEventIdsList.current.push(event.event_id);
      if (seenEventIdsList.current.length > MAX_SEEN_EVENT_IDS) {
        const oldest = seenEventIdsList.current.shift();
        if (oldest) seenEventIdsSet.current.delete(oldest);
      }
    }

    // 2. Stale Event Protection
    if (event.timestamp) {
      const eventTime = new Date(event.timestamp).getTime();
      const resId = event.resource_id || event.affected_resource;
      if (resId && !isNaN(eventTime)) {
        const lastTime = resourceTimestampsRef.current.get(resId) || 0;
        // If event is more than 1500ms older than the latest state seen for this resource, ignore
        if (eventTime < lastTime - 1500) {
          console.warn(`[NetworkSync] Dropping stale event for ${resId}: ${event.event_type} (${event.timestamp})`);
          return;
        }
        if (eventTime > lastTime) {
          resourceTimestampsRef.current.set(resId, eventTime);
        }
      }
    }

    // 3. Update active states
    setLastEvent(event);
    setRecentEvents((prev) => [event, ...prev.slice(0, 49)]);

    // 4. Notify type-specific subscribers
    const typeSubscribers = subscribersRef.current.get(event.event_type);
    if (typeSubscribers) {
      typeSubscribers.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`[NetworkSync] Error in subscriber for ${event.event_type}:`, err);
        }
      });
    }

    // 5. Also notify wildcard '*' subscribers
    const wildcardSubscribers = subscribersRef.current.get('*');
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error('[NetworkSync] Error in wildcard subscriber:', err);
        }
      });
    }
  }, []);

  // Cleanup helper for polling interval
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Start polling fallback when WebSocket is unavailable
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return;
    setConnectionState('POLLING_FALLBACK');

    pollingIntervalRef.current = setInterval(() => {
      // Broadcast synthetic sync tick to trigger REST refresh in components
      const pollEvent: StructuredNetworkEvent = {
        event_id: `POLL-TICK-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event_type: 'POLLING_SYNC_TICK',
        severity: 'INFO',
        message: 'Periodic HTTP polling state synchronizer tick',
      };
      // Direct notification without deduplication check
      const wildcardSubscribers = subscribersRef.current.get('*');
      if (wildcardSubscribers) {
        wildcardSubscribers.forEach((cb) => {
          try {
            cb(pollEvent);
          } catch {
            // Ignore callback error
          }
        });
      }
    }, POLLING_INTERVAL_MS);
  }, []);

  // Establish WebSocket connection with bounded exponential backoff
  const connectWebSocket = useCallback(() => {
    if (disableAutoConnect) return;

    // Clear any pending reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any previous socket cleanly
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    const wsUrl = getWebSocketUrl();
    setConnectionState((prev) => (prev === 'POLLING_FALLBACK' ? 'POLLING_FALLBACK' : 'CONNECTING'));

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionState('CONNECTED');
        reconnectAttemptsRef.current = 0;
        stopPollingFallback();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const structured: StructuredNetworkEvent = {
            event_id: payload.event_id || `EVT-ANON-${Date.now()}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            event_type: payload.event_type || payload.event || 'UNKNOWN',
            severity: payload.severity || 'INFO',
            resource_id: payload.resource_id || payload.affected_resource,
            affected_resource: payload.affected_resource || payload.resource_id,
            ...payload,
          };
          dispatchEvent(structured);
        } catch (parseErr) {
          console.warn('[NetworkSync] Failed to parse WebSocket message:', parseErr);
        }
      };

      socket.onclose = () => {
        wsRef.current = null;
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS_BEFORE_POLL) {
          startPollingFallback();
        } else {
          setConnectionState('RECONNECTING');
        }

        // Bounded exponential backoff delay with 15% random jitter
        const baseDelay = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, reconnectAttemptsRef.current - 1),
          MAX_BACKOFF_MS
        );
        const jitter = (Math.random() - 0.5) * 0.3 * baseDelay;
        const delay = Math.max(500, Math.round(baseDelay + jitter));

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };

      socket.onerror = () => {
        // Socket onclose will handle scheduling reconnection
        try {
          socket.close();
        } catch {
          // Ignore
        }
      };
    } catch {
      // WebSocket initialization failure (e.g. invalid URL)
      reconnectAttemptsRef.current += 1;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS_BEFORE_POLL) {
        startPollingFallback();
      } else {
        setConnectionState('DISCONNECTED');
      }
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, [disableAutoConnect, getWebSocketUrl, dispatchEvent, startPollingFallback, stopPollingFallback]);

  // Initial connection on mount & unmount cleanup
  useEffect(() => {
    connectWebSocket();

    return () => {
      // Cleanup all resources when unmounted
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      stopPollingFallback();
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
    };
  }, [connectWebSocket, stopPollingFallback]);

  // Manual reconnect action
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    stopPollingFallback();
    connectWebSocket();
  }, [connectWebSocket, stopPollingFallback]);

  // Ping action for testing / heartbeat
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  // Subscription manager
  const subscribe = useCallback(
    (eventType: string | '*', callback: EventSubscriber): (() => void) => {
      if (!subscribersRef.current.has(eventType)) {
        subscribersRef.current.set(eventType, new Set());
      }
      subscribersRef.current.get(eventType)!.add(callback);

      // Return cleanup function to remove subscriber on component unmount
      return () => {
        const subs = subscribersRef.current.get(eventType);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            subscribersRef.current.delete(eventType);
          }
        }
      };
    },
    []
  );

  const isLive = connectionState === 'CONNECTED';

  return (
    <NetworkEventContext.Provider
      value={{
        connectionState,
        isLive,
        lastEvent,
        recentEvents,
        subscribe,
        reconnect,
        sendPing,
      }}
    >
      {children}
    </NetworkEventContext.Provider>
  );
};

export const useNetworkEvents = (): NetworkEventContextType => {
  const context = useContext(NetworkEventContext);
  if (!context) {
    return {
      connectionState: 'DISCONNECTED',
      isLive: false,
      lastEvent: null,
      recentEvents: [],
      subscribe: () => () => {},
      reconnect: () => {},
      sendPing: () => {},
    };
  }
  return context;
};

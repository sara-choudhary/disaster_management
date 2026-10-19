import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NetworkEventProvider,
  useNetworkEvents,
} from '../context/NetworkEventContext';
import { StructuredNetworkEvent } from '../types/events';

// Mock WebSocket implementation for deterministic event testing
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sentData: string[] = [];

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  // Helper test methods
  triggerOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  triggerMessage(payload: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(payload) });
    }
  }

  triggerClose() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
}

describe('Frontend Network Event Synchronization Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('handles connection lifecycle and sets isLive accurately', () => {
    const TestConsumer = () => {
      const { connectionState, isLive } = useNetworkEvents();
      return (
        <div>
          <span data-testid="conn-state">{connectionState}</span>
          <span data-testid="is-live">{isLive ? 'LIVE_YES' : 'LIVE_NO'}</span>
        </div>
      );
    };

    render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <TestConsumer />
      </NetworkEventProvider>
    );

    // Initial state: CONNECTING and NOT live
    expect(screen.getByTestId('conn-state')).toHaveTextContent('CONNECTING');
    expect(screen.getByTestId('is-live')).toHaveTextContent('LIVE_NO');

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    // Trigger open -> CONNECTED and isLive = true
    act(() => {
      ws.triggerOpen();
    });

    expect(screen.getByTestId('conn-state')).toHaveTextContent('CONNECTED');
    expect(screen.getByTestId('is-live')).toHaveTextContent('LIVE_YES');
  });

  it('delivers structured events to subscribers with full metadata', () => {
    const receivedEvents: StructuredNetworkEvent[] = [];

    const TestSubscriber = () => {
      const { subscribe } = useNetworkEvents();
      useEffect(() => {
        return subscribe('LINK_FAILURE', (event) => {
          receivedEvents.push(event);
        });
      }, [subscribe]);
      return <div>Listening</div>;
    };

    render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <TestSubscriber />
      </NetworkEventProvider>
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const linkFailurePayload: StructuredNetworkEvent = {
      event_id: 'EVT-FAIL-001',
      timestamp: new Date().toISOString(),
      event_type: 'LINK_FAILURE',
      severity: 'CRITICAL',
      resource_id: 'LINK-R1-R2',
      affected_resource: 'LINK-R1-R2',
      message: 'Physical fiber conduit severed',
      recovery_metrics: { total_recovery_duration_sec: 0.12 },
    };

    act(() => {
      ws.triggerMessage(linkFailurePayload);
    });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event_id).toBe('EVT-FAIL-001');
    expect(receivedEvents[0].resource_id).toBe('LINK-R1-R2');
    expect(receivedEvents[0].severity).toBe('CRITICAL');
  });

  it('performs event deduplication when receiving duplicate event IDs', () => {
    let callCount = 0;

    const TestDeduplication = () => {
      const { subscribe } = useNetworkEvents();
      useEffect(() => {
        return subscribe('ROUTE_RECALCULATION', () => {
          callCount++;
        });
      }, [subscribe]);
      return <div>Deduplication Tester</div>;
    };

    render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <TestDeduplication />
      </NetworkEventProvider>
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const sampleEvent = {
      event_id: 'EVT-DEDUP-TEST-99',
      timestamp: new Date().toISOString(),
      event_type: 'ROUTE_RECALCULATION',
      severity: 'WARNING',
      resource_id: 'ROUTER-01',
    };

    // Send original event
    act(() => {
      ws.triggerMessage(sampleEvent);
    });
    expect(callCount).toBe(1);

    // Send duplicate event with identical event_id
    act(() => {
      ws.triggerMessage(sampleEvent);
    });
    // Call count must remain 1 (deduplicated)
    expect(callCount).toBe(1);

    // Send different event ID
    act(() => {
      ws.triggerMessage({ ...sampleEvent, event_id: 'EVT-DEDUP-TEST-100' });
    });
    expect(callCount).toBe(2);
  });

  it('safely handles stale events and avoids regressing confirmed resource state', () => {
    const receivedTimestamps: string[] = [];

    const TestStaleHandling = () => {
      const { subscribe } = useNetworkEvents();
      useEffect(() => {
        return subscribe('NODE_FAILURE', (event) => {
          receivedTimestamps.push(event.timestamp);
        });
      }, [subscribe]);
      return <div>Stale Protection Tester</div>;
    };

    render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <TestStaleHandling />
      </NetworkEventProvider>
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const now = Date.now();
    const tCurrent = new Date(now).toISOString();
    const tStale = new Date(now - 10000).toISOString(); // 10 seconds older

    // 1. Deliver current state at tCurrent
    act(() => {
      ws.triggerMessage({
        event_id: 'EVT-NODE-NEW',
        timestamp: tCurrent,
        event_type: 'NODE_FAILURE',
        severity: 'CRITICAL',
        resource_id: 'ROUTER-02',
      });
    });
    expect(receivedTimestamps).toHaveLength(1);

    // 2. Deliver stale event with timestamp 10s in the past for the same resource
    act(() => {
      ws.triggerMessage({
        event_id: 'EVT-NODE-OLD',
        timestamp: tStale,
        event_type: 'NODE_FAILURE',
        severity: 'CRITICAL',
        resource_id: 'ROUTER-02',
      });
    });

    // Stale event should be dropped without triggering callback
    expect(receivedTimestamps).toHaveLength(1);
    expect(receivedTimestamps[0]).toBe(tCurrent);
  });

  it('handles disconnects, schedules exponential backoff reconnects, and enters polling fallback', () => {
    const TestReconnect = () => {
      const { connectionState } = useNetworkEvents();
      return <div data-testid="reconnect-state">{connectionState}</div>;
    };

    render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <TestReconnect />
      </NetworkEventProvider>
    );

    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });
    expect(screen.getByTestId('reconnect-state')).toHaveTextContent('CONNECTED');

    // 1. First Disconnection -> RECONNECTING
    act(() => {
      ws1.triggerClose();
    });
    expect(screen.getByTestId('reconnect-state')).toHaveTextContent('RECONNECTING');

    // Fast-forward backoff delay (1000ms base)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should create a 2nd WebSocket attempt
    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = MockWebSocket.instances[1];

    // 2. Second Disconnect
    act(() => {
      ws2.triggerClose();
    });

    // Advance backoff for 2nd attempt (1500ms base)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(MockWebSocket.instances.length).toBe(3);
    const ws3 = MockWebSocket.instances[2];

    // 3. Third Disconnect -> Transitions to POLLING_FALLBACK
    act(() => {
      ws3.triggerClose();
    });
    expect(screen.getByTestId('reconnect-state')).toHaveTextContent('POLLING_FALLBACK');

    // Verify polling fallback tick fires periodically
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    // 4. Recovery: next WebSocket reconnect succeeds
    act(() => {
      vi.advanceTimersByTime(16000);
    });
    const lastWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    act(() => {
      lastWs.triggerOpen();
    });

    // Successfully returned to CONNECTED mode and disabled polling fallback
    expect(screen.getByTestId('reconnect-state')).toHaveTextContent('CONNECTED');
  });

  it('cleans up subscribers and closes sockets cleanly when unmounted', () => {
    let unmountedSubscriberCalled = false;

    const SubComponent = () => {
      const { subscribe } = useNetworkEvents();
      useEffect(() => {
        return subscribe('TRAFFIC_UPDATE', () => {
          unmountedSubscriberCalled = true;
        });
      }, [subscribe]);
      return <div>Sub</div>;
    };

    const { unmount } = render(
      <NetworkEventProvider urlOverride="ws://localhost:8000/ws/network-events">
        <SubComponent />
      </NetworkEventProvider>
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    // Unmount the component and provider
    unmount();

    // Verify socket close was triggered
    expect(ws.readyState).toBe(3); // CLOSED

    // Subsequent message after unmount should not trigger subscriber
    act(() => {
      ws.triggerMessage({
        event_id: 'EVT-POST-UNMOUNT',
        timestamp: new Date().toISOString(),
        event_type: 'TRAFFIC_UPDATE',
        severity: 'INFO',
      });
    });

    expect(unmountedSubscriberCalled).toBe(false);
  });
});

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.event import NetworkEvent
from app.models.link import NetworkLink
from app.models.node import NetworkNode
from app.models.alert import Alert


def test_websocket_structured_connection_and_ping(client: TestClient):
    """
    Verify WebSocket /ws/network-events sends structured CONNECTED event
    and replies to ping with structured PONG event.
    """
    with client.websocket_connect("/ws/network-events") as ws:
        connected_msg = ws.receive_json()
        assert connected_msg["event_type"] == "CONNECTED"
        assert connected_msg["event"] == "CONNECTED"
        assert connected_msg["severity"] == "INFO"
        assert connected_msg["resource_id"] == "WS-SERVER"
        assert "event_id" in connected_msg
        assert "timestamp" in connected_msg

        # Send ping text
        ws.send_text("ping")
        pong_msg = ws.receive_json()
        assert pong_msg["event_type"] == "PONG"
        assert pong_msg["event"] == "PONG"
        assert pong_msg["severity"] == "INFO"
        assert pong_msg["resource_id"] == "WS-SERVER"
        assert "event_id" in pong_msg
        assert "timestamp" in pong_msg


def test_websocket_simulation_events_published(client: TestClient):
    """
    Verify SIMULATION_STARTED and SIMULATION_COMPLETED/SIMULATION_FAILED events
    are broadcast with structured fields when running a simulation drill.
    """
    with client.websocket_connect("/ws/network-events") as ws:
        # Drain CONNECTED
        init = ws.receive_json()
        assert init["event_type"] == "CONNECTED"

        payload = {
            "source_node_id": "HQ-COMMAND-01",
            "target_node_id": "HOSPITAL-TRIAGE-03",
            "priority": "CRITICAL_SOS",
            "packet_count": 25,
        }
        res = client.post("/api/v1/simulations", json=payload)
        assert res.status_code == 201
        run_data = res.json()
        assert run_data["run_id"].startswith("SIM-")

        # First broadcast: SIMULATION_STARTED
        start_evt = ws.receive_json()
        assert start_evt["event_type"] == "SIMULATION_STARTED"
        assert start_evt["severity"] == "INFO"
        assert "event_id" in start_evt
        assert "timestamp" in start_evt
        assert start_evt["resource_id"] == "HOSPITAL-TRIAGE-03"

        # Second broadcast: SIMULATION_COMPLETED
        comp_evt = ws.receive_json()
        assert comp_evt["event_type"] in ["SIMULATION_COMPLETED", "SIMULATION_FAILED"]
        assert "event_id" in comp_evt
        assert "timestamp" in comp_evt
        assert "severity" in comp_evt
        assert comp_evt["run_id"] == run_data["run_id"]


def test_websocket_failure_and_restoration_events(client: TestClient):
    """
    Verify LINK_FAILURE, ROUTE_RECALCULATION, CONNECTIVITY_CHANGE, and
    RESOURCE_RESTORED events are broadcast with full metadata.
    """
    with client.websocket_connect("/ws/network-events") as ws:
        # Drain CONNECTED
        ws.receive_json()

        # 1. Fail a link
        fail_res = client.post(
            "/api/v1/network/links/LINK-R1-R2/failure",
            json={"reason": "Test fiber cut drill"},
        )
        assert fail_res.status_code == 200

        # Receive LINK_FAILURE
        msg1 = ws.receive_json()
        assert msg1["event_type"] == "LINK_FAILURE"
        assert msg1["severity"] == "CRITICAL"
        assert msg1["resource_id"] == "LINK-R1-R2"
        assert "event_id" in msg1
        assert "timestamp" in msg1

        # Receive ROUTE_RECALCULATION
        msg2 = ws.receive_json()
        assert msg2["event_type"] == "ROUTE_RECALCULATION"
        assert "before_path" in msg2
        assert "after_path" in msg2
        assert "event_id" in msg2
        assert "severity" in msg2

        # Receive CONNECTIVITY_CHANGE
        msg3 = ws.receive_json()
        assert msg3["event_type"] == "CONNECTIVITY_CHANGE"
        assert "reachability" in msg3
        assert "event_id" in msg3
        assert "severity" in msg3

        # 2. Restore the link
        restore_res = client.post("/api/v1/network/links/LINK-R1-R2/restore")
        assert restore_res.status_code == 200

        # Receive RESOURCE_RESTORED
        msg4 = ws.receive_json()
        assert msg4["event_type"] == "RESOURCE_RESTORED"
        assert msg4["severity"] == "INFO"
        assert msg4["resource_id"] == "LINK-R1-R2"
        assert "event_id" in msg4
        assert "timestamp" in msg4


def test_websocket_traffic_and_alert_events(client: TestClient):
    """
    Verify TRAFFIC_UPDATE and ALERT_CREATED / ALERT_UPDATED / ALERT_RESOLVED
    events are broadcast with required fields.
    """
    with client.websocket_connect("/ws/network-events") as ws:
        # Drain CONNECTED
        ws.receive_json()

        # 1. Traffic QoS update
        traffic_payload = {
            "source_department": "Police",
            "destination_department": "Fire Department",
            "traffic_class": "HIGH",
            "packet_count": 50,
            "offered_load_mbps": 20.0,
            "test_duration_sec": 5.0,
            "competing_traffic": True,
        }
        t_res = client.post("/api/v1/traffic/simulate", json=traffic_payload)
        assert t_res.status_code == 200

        trf_evt = ws.receive_json()
        assert trf_evt["event_type"] == "TRAFFIC_UPDATE"
        assert "event_id" in trf_evt
        assert "timestamp" in trf_evt
        assert "severity" in trf_evt
        assert "delivery_rate" in trf_evt
        assert "packets_sent" in trf_evt

        # 2. Alert creation & resolution
        alert_payload = {
            "alert_id": "ALT-TEST-WS-01",
            "severity": "CRITICAL",
            "category": "CONNECTIVITY",
            "title": "Test Critical Outage Alert",
            "description": "Verification of WebSocket event propagation",
            "affected_resource": "ROUTER-01",
            "status": "ACTIVE",
        }
        a_res = client.post("/api/v1/alerts", json=alert_payload)
        assert a_res.status_code == 201

        alt_created = ws.receive_json()
        assert alt_created["event_type"] == "ALERT_CREATED"
        assert alt_created["alert_id"] == "ALT-TEST-WS-01"
        assert alt_created["severity"] == "CRITICAL"
        assert alt_created["resource_id"] == "ROUTER-01"
        assert "event_id" in alt_created
        assert "timestamp" in alt_created

        # Resolve alert
        r_res = client.post("/api/v1/alerts/ALT-TEST-WS-01/resolve")
        assert r_res.status_code == 200

        alt_resolved = ws.receive_json()
        assert alt_resolved["event_type"] == "ALERT_RESOLVED"
        assert alt_resolved["status"] == "RESOLVED"
        assert alt_resolved["alert_id"] == "ALT-TEST-WS-01"
        assert "event_id" in alt_resolved


def test_rest_state_recovery_after_actions(client: TestClient):
    """
    Verify that REST APIs accurately reflect live state for recovery after browser refresh.
    """
    # 1. Check baseline topology
    topo_res = client.get("/api/v1/network/topology")
    assert topo_res.status_code == 200
    topo = topo_res.json()
    assert len(topo["nodes"]) >= 4
    assert len(topo["links"]) >= 4

    # 2. Check reachability
    reach_res = client.get("/api/v1/network/reachability?source=HQ-COMMAND-01")
    assert reach_res.status_code == 200
    reach = reach_res.json()
    assert reach["total_destinations"] >= 7

    # 3. Check historical events query
    events_res = client.get("/api/v1/events?limit=10")
    assert events_res.status_code == 200
    events = events_res.json()
    assert isinstance(events, list)
    for evt in events:
        assert "event_id" in evt
        assert "event_type" in evt
        assert "severity" in evt
        assert "affected_resource" in evt

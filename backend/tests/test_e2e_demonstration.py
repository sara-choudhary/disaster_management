"""
End-to-End Demonstration and Full-Stack Project-Readiness Test Suite
Executes the full 12-step emergency operations drill against backend APIs:
1. Open the landing page (API root & health check)
2. Navigate to the dashboard (topology, metrics, reachability)
3. Verify normal baseline connectivity (100% health, reachable departments)
4. Select a source and destination (calculate initial shortest path)
5. Inject a primary-link failure
6. Verify alternate-path selection
7. Inspect recovery metrics and generated events
8. Run a congestion and priority traffic test (QoS differentiation)
9. Test an ACL denial and security event creation
10. Restore the baseline network
11. Open the report (summary, history, CSV and JSON exports)
12. Refresh / re-query to verify database persistence across sessions
"""

import pytest
from fastapi.testclient import TestClient


def test_end_to_end_demonstration_drill(client: TestClient):
    # -------------------------------------------------------------
    # Step 1: Open the landing page (Check root & health)
    # -------------------------------------------------------------
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    root_data = root_resp.json()
    assert "Disaster-Resistant Emergency Communication Network" in root_data["project"]

    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["status"] == "ok"
    assert health_data["database"] == "connected"

    # -------------------------------------------------------------
    # Step 2: Navigate to the dashboard (Fetch topology, metrics, alerts)
    # -------------------------------------------------------------
    topo_resp = client.get("/api/v1/network/topology")
    assert topo_resp.status_code == 200
    topo = topo_resp.json()
    assert len(topo["nodes"]) >= 7
    assert len(topo["links"]) >= 8

    metrics_resp = client.get("/api/v1/network/metrics")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics["total_nodes"] > 0
    assert metrics["total_links"] > 0

    alerts_resp = client.get("/api/v1/alerts")
    assert alerts_resp.status_code == 200
    assert isinstance(alerts_resp.json(), list)

    # -------------------------------------------------------------
    # Step 3: Verify normal baseline connectivity
    # -------------------------------------------------------------
    reach_resp = client.get("/api/v1/network/reachability")
    assert reach_resp.status_code == 200
    reach = reach_resp.json()
    assert reach["total_destinations"] >= 7
    assert reach["reachable_destinations"] == reach["total_destinations"]
    assert reach["reachability_percentage"] == 100.0

    # -------------------------------------------------------------
    # Step 4: Select a source and destination (ROUTER-01 to ROUTER-02)
    # -------------------------------------------------------------
    source = "ROUTER-01"
    dest = "ROUTER-02"
    route_resp = client.get(f"/api/v1/network/routes?source={source}&destination={dest}")
    assert route_resp.status_code == 200
    normal_route = route_resp.json()
    assert normal_route["reachability"] is True
    initial_path = normal_route["path"]
    assert initial_path == ["ROUTER-01", "ROUTER-02"]
    assert normal_route["alternate_path_selected"] is False

    # -------------------------------------------------------------
    # Step 5: Inject a primary-link failure
    # -------------------------------------------------------------
    # Fail primary backbone link LINK-R1-R2
    fail_resp = client.post(
        "/api/v1/network/links/LINK-R1-R2/failure",
        json={"reason": "Seismic ground shift severed primary fiber conduit"},
    )
    assert fail_resp.status_code == 200
    fail_data = fail_resp.json()
    assert fail_data["status"] == "success"
    assert fail_data["link"]["operational_state"] == "DOWN"
    assert fail_data["alternate_path_selected"] is True
    assert fail_data["recovery_metrics"] is not None

    # -------------------------------------------------------------
    # Step 6: Verify alternate-path selection
    # -------------------------------------------------------------
    reroute_resp = client.get(f"/api/v1/network/routes?source={source}&destination={dest}")
    assert reroute_resp.status_code == 200
    reroute = reroute_resp.json()
    assert reroute["reachability"] is True
    alternate_path = reroute["path"]
    # Path must remain valid and alternate
    assert alternate_path != ["ROUTER-01", "ROUTER-02"]
    assert alternate_path[0] == source
    assert alternate_path[-1] == dest
    assert reroute["alternate_path_selected"] is True

    # -------------------------------------------------------------
    # Step 7: Inspect recovery metrics and events
    # -------------------------------------------------------------
    events_resp = client.get("/api/v1/events")
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) > 0
    # Confirm link failure event was recorded
    fail_events = [e for e in events if "LINK" in e["event_type"] or "FAIL" in e["event_type"]]
    assert len(fail_events) > 0

    # -------------------------------------------------------------
    # Step 8: Run a congestion and priority traffic test
    # -------------------------------------------------------------
    traffic_resp = client.post(
        "/api/v1/traffic/simulate",
        json={
            "source_department": "Ambulance Services",
            "destination_department": "Hospital",
            "traffic_class": "CRITICAL",
            "offered_load_mbps": 40.0,
            "packet_count": 200,
            "competing_traffic": True,
        },
    )
    assert traffic_resp.status_code == 200
    traffic_data = traffic_resp.json()
    assert traffic_data["is_congested"] is True
    assert traffic_data["delivery_ratio_pct"] == 100.0  # Critical protected
    assert traffic_data["packets_lost"] == 0

    # Verify results by class
    class_map = {c["traffic_class"]: c for c in traffic_data["results_by_class"]}
    assert class_map["CRITICAL"]["delivery_ratio_pct"] == 100.0
    assert class_map["LOW"]["packets_lost"] > 0 or class_map["LOW"]["queue_delay_ms"] > class_map["CRITICAL"]["queue_delay_ms"]

    # -------------------------------------------------------------
    # Step 9: Test an ACL denial and security event creation
    # -------------------------------------------------------------
    # Default seeded rule: Relief Camp to Backup Control Center is DENY
    acl_resp = client.post(
        "/api/v1/access-rules/evaluate",
        json={
            "source_department": "Relief Camp",
            "destination_department": "Backup Control Center",
            "source_ip": "192.168.60.10",
            "destination_ip": "192.168.70.10",
            "protocol": "TCP",
            "port": 80,
        },
    )
    assert acl_resp.status_code == 200
    acl_data = acl_resp.json()
    assert acl_data["action"] == "DENY"
    assert "denied" in acl_data["explanation"].lower()

    assert acl_data["security_event_logged"] is True

    # Verify a security event was logged for the denied attempt
    sec_events_resp = client.get("/api/v1/events?event_type=SECURITY_VIOLATION")
    assert sec_events_resp.status_code == 200
    sec_events = sec_events_resp.json()
    assert len(sec_events) > 0

    # -------------------------------------------------------------
    # Step 10: Restore the baseline network
    # -------------------------------------------------------------
    restore_resp = client.post("/api/v1/network/restore")
    assert restore_resp.status_code == 200
    restore_data = restore_resp.json()
    assert restore_data["status"] == "success"

    # Confirm reachability is fully restored
    restored_reach = client.get("/api/v1/network/reachability").json()
    assert restored_reach["reachable_destinations"] == restored_reach["total_destinations"]
    assert restored_reach["reachability_percentage"] == 100.0

    # -------------------------------------------------------------
    # Step 11: Open the report (summary, history, CSV and JSON exports)
    # -------------------------------------------------------------
    summary_resp = client.get("/api/v1/reports/summary")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert "network_health_score" in summary
    assert "active_nodes" in summary

    history_resp = client.get("/api/v1/reports/history?page=1&page_size=10")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert "items" in history
    assert history["total_count"] >= 1

    # Test CSV export
    csv_resp = client.get("/api/v1/reports/export/csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Run ID" in csv_resp.text

    # Test JSON export of first run
    first_run_id = history["items"][0]["run_id"]
    json_resp = client.get(f"/api/v1/reports/export/json/{first_run_id}")
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    detail_data = json_resp.json()
    assert detail_data["run_id"] == first_run_id

    # -------------------------------------------------------------
    # Step 12: Refresh browser & verify persistence
    # -------------------------------------------------------------
    # Re-fetch report and history to ensure persisted records remain unchanged
    persist_check = client.get(f"/api/v1/reports/simulations/{first_run_id}")
    assert persist_check.status_code == 200
    report_data = persist_check.json()
    assert report_data["run_id"] == first_run_id
    assert "events_triggered" in report_data
    assert "alerts_triggered" in report_data
    assert "initial_topology" in report_data
    assert "final_topology" in report_data

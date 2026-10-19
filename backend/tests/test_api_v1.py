import pytest
from starlette.testclient import TestClient


def test_health_endpoints(client: TestClient):
    """GET /health and GET /api/health."""
    res_root = client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "ok"
    assert res_root.json()["database"] == "connected"

    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    assert res_api.json()["status"] == "ok"


def test_network_topology(client: TestClient):
    """GET /api/v1/network/topology."""
    res = client.get("/api/v1/network/topology")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "links" in data
    assert "departments" in data
    assert "metrics" in data
    assert len(data["nodes"]) >= 7
    assert len(data["links"]) >= 7
    assert len(data["departments"]) >= 6
    assert data["metrics"]["total_nodes"] >= 7


def test_network_nodes_pagination_and_filter(client: TestClient):
    """GET /api/v1/network/nodes."""
    res = client.get("/api/v1/network/nodes?skip=0&limit=3")
    assert res.status_code == 200
    nodes = res.json()
    assert len(nodes) == 3

    # Filter by status
    res_active = client.get("/api/v1/network/nodes?status=active")
    assert res_active.status_code == 200
    assert all(n["status"] == "active" for n in res_active.json())


def test_network_links_pagination_and_filter(client: TestClient):
    """GET /api/v1/network/links."""
    res = client.get("/api/v1/network/links?skip=0&limit=4")
    assert res.status_code == 200
    links = res.json()
    assert len(links) == 4

    # Filter by state
    res_up = client.get("/api/v1/network/links?operational_state=UP")
    assert res_up.status_code == 200
    assert all(l["operational_state"] == "UP" for l in res_up.json())


def test_network_departments(client: TestClient):
    """GET /api/v1/network/departments."""
    res = client.get("/api/v1/network/departments")
    assert res.status_code == 200
    deps = res.json()
    codes = [d["code"] for d in deps]
    assert "ECC" in codes
    assert "POLICE" in codes
    assert "HOSPITAL" in codes


def test_network_routes(client: TestClient):
    """GET /api/v1/network/routes."""
    res = client.get("/api/v1/network/routes?source=HQ-COMMAND-01&destination=HOSPITAL-TRIAGE-03&priority=CRITICAL_SOS")
    assert res.status_code == 200
    data = res.json()
    assert data["path_exists"] is True
    assert data["source"] == "HQ-COMMAND-01"
    assert data["destination"] == "HOSPITAL-TRIAGE-03"
    assert data["path"][0] == "HQ-COMMAND-01"
    assert data["path"][-1] == "HOSPITAL-TRIAGE-03"
    assert data["hops"] >= 1
    assert data["estimated_latency_ms"] > 0



def test_network_metrics(client: TestClient):
    """GET /api/v1/network/metrics."""
    res = client.get("/api/v1/network/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_nodes"] >= 7
    assert data["active_nodes"] >= 7
    assert data["total_links"] >= 7
    assert data["up_links"] >= 7
    assert 0.0 <= data["network_health_score"] <= 100.0


def test_scenarios_crud(client: TestClient):
    """GET /api/v1/scenarios, POST /api/v1/scenarios, GET /api/v1/scenarios/{scenario_id}."""
    # List scenarios
    res_list = client.get("/api/v1/scenarios")
    assert res_list.status_code == 200
    scenarios = res_list.json()
    assert len(scenarios) >= 3

    # Get single scenario
    first_id = scenarios[0]["scenario_id"]
    res_get = client.get(f"/api/v1/scenarios/{first_id}")
    assert res_get.status_code == 200
    assert res_get.json()["scenario_id"] == first_id

    # Create new scenario
    new_scenario = {
        "scenario_id": "SCEN-CUSTOM-99",
        "name": "Custom Flash Flood Drill",
        "description": "Flooding of low-lying northern river repeater station.",
        "scenario_type": "flood",
        "configuration": {"failed_nodes": ["RELAY-NORTH-02"]},
    }
    res_post = client.post("/api/v1/scenarios", json=new_scenario)
    assert res_post.status_code == 201
    assert res_post.json()["scenario_id"] == "SCEN-CUSTOM-99"

    # Get the created scenario
    res_fetch = client.get("/api/v1/scenarios/SCEN-CUSTOM-99")
    assert res_fetch.status_code == 200
    assert res_fetch.json()["name"] == "Custom Flash Flood Drill"

    # 404 on nonexistent
    res_404 = client.get("/api/v1/scenarios/NON-EXISTENT")
    assert res_404.status_code == 404


def test_simulations_lifecycle(client: TestClient):
    """POST /api/v1/simulations, GET /api/v1/simulations, GET /api/v1/simulations/{run_id}, POST /api/v1/simulations/{run_id}/stop."""
    payload = {
        "source_node_id": "ECC-01",
        "target_node_id": "HOSPITAL-04",
        "priority": "CRITICAL_SOS",
        "message_content": "Emergency medical team dispatched.",
        "packet_count": 25,
    }
    # Create simulation
    res_post = client.post("/api/v1/simulations", json=payload)
    assert res_post.status_code == 201
    sim_data = res_post.json()
    run_id = sim_data["run_id"]
    assert sim_data["result"] == "SUCCESS"
    assert sim_data["packet_statistics"]["delivered"] == 25

    # List simulations
    res_list = client.get("/api/v1/simulations?limit=5")
    assert res_list.status_code == 200
    runs = res_list.json()
    assert any(r["run_id"] == run_id for r in runs)

    # Get specific simulation run
    res_get = client.get(f"/api/v1/simulations/{run_id}")
    assert res_get.status_code == 200
    assert res_get.json()["run_id"] == run_id

    # Stop simulation run
    res_stop = client.post(f"/api/v1/simulations/{run_id}/stop")
    assert res_stop.status_code == 200
    assert res_stop.json()["result"] == "STOPPED"

    # 404 on nonexistent
    assert client.get("/api/v1/simulations/SIM-NONEXISTENT").status_code == 404


def test_network_link_failure_and_restore(client: TestClient):
    """POST /api/v1/network/links/{link_id}/failure and restore."""
    link_id = "LINK-ECC-POLICE"

    # Fail the link
    fail_res = client.post(
        f"/api/v1/network/links/{link_id}/failure",
        json={"reason": "Seismic fiber rupture"},
    )
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "success"
    assert fail_res.json()["link"]["operational_state"] == "DOWN"

    # Verify link is DOWN in list
    links_res = client.get("/api/v1/network/links")
    ecc_police = next(l for l in links_res.json() if l["link_id"] == link_id)
    assert ecc_police["operational_state"] == "DOWN"

    # Restore the link
    restore_res = client.post(f"/api/v1/network/links/{link_id}/restore")
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "success"
    assert restore_res.json()["link"]["operational_state"] == "UP"

    # 404 on nonexistent link
    assert client.post("/api/v1/network/links/LINK-UNKNOWN/failure").status_code == 404
    assert client.post("/api/v1/network/links/LINK-UNKNOWN/restore").status_code == 404


def test_network_node_failure_and_restore(client: TestClient):
    """POST /api/v1/network/nodes/{node_id}/failure and restore."""
    node_id = "RELAY-VALLEY-04"

    # Fail the node
    fail_res = client.post(
        f"/api/v1/network/nodes/{node_id}/failure",
        json={"reason": "Battery backup depleted"},
    )
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "success"
    assert fail_res.json()["node"]["status"] == "offline"

    # Verify node is offline in list
    node_get = client.get(f"/api/v1/nodes/{node_id}")
    assert node_get.json()["status"] == "offline"

    # Restore the node
    restore_res = client.post(f"/api/v1/network/nodes/{node_id}/restore")
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "success"
    assert restore_res.json()["node"]["status"] == "active"

    # 404 on nonexistent node
    assert client.post("/api/v1/network/nodes/NODE-UNKNOWN/failure").status_code == 404
    assert client.post("/api/v1/network/nodes/NODE-UNKNOWN/restore").status_code == 404


def test_events_and_alerts(client: TestClient):
    """GET /api/v1/events, GET /api/v1/alerts, PATCH /api/v1/alerts/{alert_id}."""
    # List events
    events_res = client.get("/api/v1/events?limit=10")
    assert events_res.status_code == 200
    events = events_res.json()
    assert isinstance(events, list)

    # List alerts
    alerts_res = client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    target_alert_id = alerts[0]["alert_id"]

    # Patch alert
    patch_res = client.patch(
        f"/api/v1/alerts/{target_alert_id}",
        json={"status": "ACKNOWLEDGED", "description": "Triage in progress."},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "ACKNOWLEDGED"

    # 404 on nonexistent alert
    assert client.patch("/api/v1/alerts/ALT-NONEXISTENT", json={"status": "RESOLVED"}).status_code == 404


def test_access_rules_crud(client: TestClient):
    """GET /api/v1/access-rules, POST /api/v1/access-rules, PATCH /api/v1/access-rules/{rule_id}."""
    # List rules
    rules_res = client.get("/api/v1/access-rules")
    assert rules_res.status_code == 200
    rules = rules_res.json()
    assert len(rules) >= 3

    # Create new rule
    new_rule = {
        "rule_id": "RULE-TEST-99",
        "source": "Relief & Logistics",
        "destination": "Public Safety & Law Enforcement",
        "protocol": "UDP",
        "action": "PERMIT",
        "enabled": True,
    }
    create_res = client.post("/api/v1/access-rules", json=new_rule)
    assert create_res.status_code == 201
    assert create_res.json()["rule_id"] == "RULE-TEST-99"

    # Patch rule
    patch_res = client.patch(
        "/api/v1/access-rules/RULE-TEST-99",
        json={"action": "DENY", "enabled": False},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["action"] == "DENY"
    assert patch_res.json()["enabled"] is False

    # 404 on nonexistent rule
    assert client.patch("/api/v1/access-rules/RULE-UNKNOWN", json={"action": "PERMIT"}).status_code == 404


def test_reports(client: TestClient):
    """GET /api/v1/reports/summary and GET /api/v1/reports/simulations/{run_id}."""
    # Summary report
    summary_res = client.get("/api/v1/reports/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_nodes"] >= 7
    assert summary["total_links"] >= 7
    assert 0.0 <= summary["network_health_score"] <= 100.0
    assert "events_by_severity" in summary

    # Run a simulation to generate report for
    sim_post = client.post(
        "/api/v1/simulations",
        json={
            "source_node_id": "ECC-01",
            "target_node_id": "FIRE-03",
            "priority": "HIGH_MEDICAL",
            "packet_count": 10,
        },
    )
    assert sim_post.status_code == 201
    run_id = sim_post.json()["run_id"]

    # Drill report
    report_res = client.get(f"/api/v1/reports/simulations/{run_id}")
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["run_id"] == run_id
    assert report["status"] == "SUCCESS"
    assert report["resilience_score"] > 0.0
    assert "assessment" in report

    # 404 on nonexistent report
    assert client.get("/api/v1/reports/simulations/SIM-UNKNOWN").status_code == 404


def test_websocket_network_events(client: TestClient):
    """WebSocket /ws/network-events connection and ping/pong."""
    with client.websocket_connect("/ws/network-events") as ws:
        # First message is connection acknowledgment
        init_data = ws.receive_json()
        assert init_data["event"] == "CONNECTED"

        # Send ping
        ws.send_text("ping")
        pong_data = ws.receive_json()
        assert pong_data["event"] == "PONG"

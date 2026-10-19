def test_deterministic_routing_success(client):
    """Test deterministic packet path from HQ to Hospital."""
    payload = {
        "source_node_id": "HQ-COMMAND-01",
        "target_node_id": "HOSPITAL-TRIAGE-03",
        "priority": "CRITICAL_SOS",
        "message_content": "Trauma team needed immediately.",
        "simulate_node_failures": [],
    }
    response = client.post("/api/v1/simulation/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["source_node_id"] == "HQ-COMMAND-01"
    assert data["target_node_id"] == "HOSPITAL-TRIAGE-03"
    assert data["path"][0] == "HQ-COMMAND-01"
    assert data["path"][-1] == "HOSPITAL-TRIAGE-03"
    assert data["total_hops"] >= 1
    assert data["delivery_status"] == "DELIVERED"


def test_deterministic_routing_with_node_failure(client):
    """Test dynamic detour when northern relay fails."""
    payload = {
        "source_node_id": "HQ-COMMAND-01",
        "target_node_id": "SHELTER-SOUTH-05",
        "priority": "NORMAL_LOGISTICS",
        "message_content": "Water supplies delivered.",
        "simulate_node_failures": ["RELAY-NORTH-02"],
    }
    response = client.post("/api/v1/simulation/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "RELAY-NORTH-02" not in data["path"]


def test_routing_failure_when_target_isolated(client):
    """Test graceful handling when target node is unreachable."""
    payload = {
        "source_node_id": "HQ-COMMAND-01",
        "target_node_id": "HOSPITAL-TRIAGE-03",
        "priority": "CRITICAL_SOS",
        "message_content": "Ping test.",
        "simulate_node_failures": ["RELAY-NORTH-02", "RELAY-VALLEY-04", "HOSPITAL-TRIAGE-03"],
    }
    response = client.post("/api/v1/simulation/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["delivery_status"] == "DROPPED"
    assert len(data["path"]) == 0


def test_messages_history_endpoint(client):
    """Test emergency message history log endpoint."""
    response = client.get("/api/v1/simulation/messages")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

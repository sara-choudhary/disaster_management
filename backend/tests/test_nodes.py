def test_list_nodes(client):
    """Test listing network nodes seeded by default."""
    response = client.get("/api/v1/nodes")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    node_ids = [n["node_id"] for n in data]
    assert "HQ-COMMAND-01" in node_ids


def test_create_and_get_node(client):
    """Test registering a new disaster shelter node and fetching it."""
    payload = {
        "node_id": "TEST-SHELTER-99",
        "name": "Community Gym Shelter",
        "node_type": "shelter",
        "status": "active",
        "battery_level": 95.0,
        "pos_x": 420.0,
        "pos_y": 180.0,
    }
    response = client.post("/api/v1/nodes", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["node_id"] == "TEST-SHELTER-99"

    # Fetch it
    fetch_res = client.get("/api/v1/nodes/TEST-SHELTER-99")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["name"] == "Community Gym Shelter"


def test_create_duplicate_node_fails(client):
    """Test duplicate node ID returns 400 error."""
    payload = {
        "node_id": "HQ-COMMAND-01",
        "name": "Duplicate HQ",
        "node_type": "command_center",
        "status": "active",
        "battery_level": 100.0,
        "pos_x": 100.0,
        "pos_y": 150.0,
    }
    response = client.post("/api/v1/nodes", json=payload)
    assert response.status_code == 400

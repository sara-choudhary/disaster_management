def test_health_check_endpoint(client):
    """Test standard health check endpoint returns 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Disaster-Resistant Emergency Communication Network" in data["app_name"]
    assert data["database"] == "connected"


def test_root_endpoint(client):
    """Test root endpoint returns discovery metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["health_check"] == "/api/health"
    assert data["docs_url"] == "/docs"

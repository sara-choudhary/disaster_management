def test_seven_emergency_stations_seeded(client):
    """Verify all 7 designated emergency response stations are seeded in database."""
    response = client.get("/api/v1/nodes")
    assert response.status_code == 200
    nodes = response.json()
    names = [n["name"] for n in nodes]

    expected_stations = [
        "Emergency Control Center",
        "Police Station",
        "Fire Department",
        "Hospital",
        "Ambulance Services",
        "Relief Camp",
        "Backup Control Center",
    ]
    for station in expected_stations:
        assert station in names, f"Expected {station} to be in seeded database nodes"


def test_departments_endpoint(client):
    """Verify departments endpoint returns configured subnets and VLANs."""
    response = client.get("/api/v1/departments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 7
    codes = [d["code"] for d in data]
    assert "ECC" in codes
    assert "POLICE" in codes
    assert "HOSPITAL" in codes


def test_traffic_classes_endpoint(client):
    """Verify traffic classes endpoint returns QoS priority classes."""
    response = client.get("/api/v1/traffic-classes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    codes = [tc["code"] for tc in data]
    assert "CRITICAL_SOS" in codes
    assert "HIGH_MEDICAL" in codes


def test_network_links_endpoint(client):
    """Verify network links endpoint returns peer topology channels."""
    response = client.get("/api/v1/links")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    link_ids = [l["link_id"] for l in data]
    assert "LINK-ECC-POLICE" in link_ids


def test_scenarios_endpoint(client):
    """Verify disaster drill scenarios are seeded."""
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_alerts_endpoint(client):
    """Verify alerts endpoint returns operational warnings."""
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_access_rules_endpoint(client):
    """Verify access rules endpoint returns firewall policies."""
    response = client.get("/api/v1/access-rules")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_idempotent_seeding(client, db_session):
    """Verify multiple seed calls do not duplicate records."""
    from app.services.seed_data import seed_database_idempotent
    from app.models.node import NetworkNode
    from app.models.department import Department

    initial_nodes = db_session.query(NetworkNode).count()
    initial_depts = db_session.query(Department).count()

    # Re-run seed operation
    seed_database_idempotent(db_session)

    assert db_session.query(NetworkNode).count() == initial_nodes
    assert db_session.query(Department).count() == initial_depts

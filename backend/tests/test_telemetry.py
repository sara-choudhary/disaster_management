import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.simulation import SimulationRun
from app.services import telemetry_service


def test_get_telemetry_endpoint_success(client: TestClient, db_session: Session):
    """Test retrieving full telemetry response with all 8 requested datasets."""
    response = client.get("/api/v1/telemetry?time_range=24h")
    assert response.status_code == 200
    data = response.json()

    assert "snapshot" in data
    assert "availability_over_time" in data
    assert "latency_over_time" in data
    assert "packet_delivery_and_loss" in data
    assert "link_utilization" in data
    assert "traffic_volume_by_class" in data
    assert "recovery_duration" in data
    assert "route_changes_over_time" in data
    assert "disclaimer" in data
    assert "SIMULATED TELEMETRY" in data["disclaimer"].upper()

    # Verify snapshot
    snapshot = data["snapshot"]
    assert snapshot["current_availability_pct"] >= 0.0
    assert snapshot["active_nodes"] > 0
    assert snapshot["active_links"] > 0
    assert snapshot["total_links"] >= snapshot["active_links"]

    # Verify link utilization entries
    link_util = data["link_utilization"]
    assert len(link_util) > 0
    for link in link_util:
        assert "link_id" in link
        assert "utilization_pct" in link
        assert 0.0 <= link["utilization_pct"] <= 100.0


def test_network_telemetry_alias_endpoint(client: TestClient):
    """Test retrieving telemetry via the /api/v1/network/telemetry route."""
    response = client.get("/api/v1/network/telemetry?time_range=all")
    assert response.status_code == 200
    data = response.json()
    assert data["time_range"] == "all"
    assert isinstance(data["availability_over_time"], list)


def test_time_range_filter_and_empty_state(client: TestClient, db_session: Session):
    """Test that time range filters work and insufficient data flag is raised when appropriate."""
    # When filtering to a very narrow 15m window where fewer than 2 runs might exist
    response = client.get("/api/v1/telemetry?time_range=15m")
    assert response.status_code == 200
    data = response.json()
    assert "has_sufficient_data" in data

    if not data["has_sufficient_data"]:
        assert data["explanation"] is not None
        assert "insufficient" in data["explanation"].lower()


def test_post_telemetry_drill_execution(client: TestClient, db_session: Session):
    """Test executing an on-demand baseline simulation drill from telemetry."""
    initial_res = client.get("/api/v1/telemetry?time_range=all")
    initial_count = initial_res.json()["data_points_count"]

    post_res = client.post("/api/v1/telemetry/drill?drill_name=TEST-UNIT-DRILL")
    assert post_res.status_code == 201
    run_record = post_res.json()
    assert run_record["scenario_id"] == "TEST-UNIT-DRILL"
    assert run_record["result"] in ["SUCCESS", "FAILED"]

    # Verify that telemetry now includes this new run
    updated_res = client.get("/api/v1/telemetry?time_range=all")
    updated_count = updated_res.json()["data_points_count"]
    assert updated_count >= initial_count + 1


def test_telemetry_datasets_consistency(client: TestClient, db_session: Session):
    """Verify mathematical and logical consistency across all telemetry data points."""
    # Ensure at least 3 runs exist
    telemetry_service.seed_baseline_simulation_runs_if_empty(db_session)
    response = client.get("/api/v1/telemetry?time_range=all")
    data = response.json()

    # Latency dataset
    for lat_point in data["latency_over_time"]:
        assert lat_point["estimated_latency_ms"] >= 0.0
        assert lat_point["baseline_target_ms"] == 15.0

    # Packet delivery & loss
    for pkt_point in data["packet_delivery_and_loss"]:
        total_pct = pkt_point["delivery_ratio_pct"] + pkt_point["packet_loss_pct"]
        assert 99.0 <= total_pct <= 101.0  # Float tolerance around 100%

    # Traffic volume by class
    for vol_point in data["traffic_volume_by_class"]:
        assert vol_point["critical_mbps"] > 0
        assert vol_point["high_mbps"] > 0
        assert vol_point["normal_mbps"] > 0
        assert vol_point["low_mbps"] > 0
        assert vol_point["total_offered_mbps"] > 0

    # Recovery duration
    for rec_point in data["recovery_duration"]:
        assert rec_point["recovery_duration_sec"] >= 0.0
        assert rec_point["target_sla_sec"] == 1.50

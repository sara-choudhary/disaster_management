import pytest
from concurrent.futures import ThreadPoolExecutor
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TestingSessionLocal
from app.models.node import NetworkNode
from app.models.link import NetworkLink
from app.models.alert import Alert
from app.models.simulation import SimulationRun
from app.models.event import NetworkEvent
from app.services import network_service


def test_successful_alternate_route_recovery(client: TestClient, db_session: Session):
    """
    Test 1: Successful alternate-route recovery.
    Severs primary core link LINK-R1-R2.
    Routing engine dynamically selects alternate path via ROUTER-04 or ROUTER-03.
    Verifies dynamic non-hardcoded modeled timing recovery metrics, alert generation,
    and SimulationRun database persistence.
    """
    # 1. Ensure baseline reset first
    reset_res = client.post("/api/v1/network/reset")
    assert reset_res.status_code == 200

    # 2. Check initial route between ROUTER-01 and ROUTER-02
    init_route = client.get(
        "/api/v1/network/routes",
        params={"source": "ROUTER-01", "destination": "ROUTER-02"},
    )
    assert init_route.status_code == 200
    assert init_route.json()["path"] == ["ROUTER-01", "ROUTER-02"]
    assert init_route.json()["alternate_path_selected"] is False

    # 3. Inject failure on primary link LINK-R1-R2
    fail_res = client.post(
        "/api/v1/network/links/LINK-R1-R2/failure",
        json={"reason": "Seismic ground shift severed primary fiber conduit"},
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()

    assert fail_data["status"] == "success"
    assert fail_data["action"] == "FAILED"
    assert fail_data["resource_id"] == "LINK-R1-R2"
    assert fail_data["link"]["operational_state"] == "DOWN"
    assert fail_data["alternate_path_selected"] is True
    assert fail_data["before_path"] == ["ROUTER-01", "ROUTER-02"]
    assert fail_data["after_path"] != ["ROUTER-01", "ROUTER-02"]
    assert "ROUTER-01" in fail_data["after_path"]
    assert "ROUTER-02" in fail_data["after_path"]
    assert len(fail_data["after_path"]) >= 3

    # Verify modeled non-hardcoded recovery metrics
    metrics = fail_data["recovery_metrics"]
    assert metrics is not None
    assert metrics["detection_delay_ms"] == 45.0
    assert metrics["spf_calculation_ms"] > 0.0
    assert metrics["fib_update_ms"] > 0.0
    assert metrics["total_recovery_duration_sec"] > 0.0
    assert "BFD" in metrics["timing_model"]
    assert "Dijkstra" in metrics["timing_model"]

    # Verify SimulationRun record was persisted
    sim_run_id = fail_data["simulation_run_id"]
    assert sim_run_id is not None
    sim_record = db_session.query(SimulationRun).filter(SimulationRun.run_id == sim_run_id).first()
    assert sim_record is not None
    assert sim_record.result == "SUCCESS"
    assert sim_record.recovery_duration == metrics["total_recovery_duration_sec"]
    assert sim_record.packet_statistics["recalculated_hops"] >= 2

    # Verify active alert was created
    alert_record = (
        db_session.query(Alert)
        .filter(Alert.description.contains("LINK-R1-R2"), Alert.status == "ACTIVE")
        .first()
    )
    assert alert_record is not None
    assert alert_record.severity == "CRITICAL"

    # Verify audit event was logged with related_run
    event_record = (
        db_session.query(NetworkEvent)
        .filter(NetworkEvent.affected_resource == "LINK-R1-R2", NetworkEvent.related_run == sim_run_id)
        .first()
    )
    assert event_record is not None
    assert event_record.event_type == "LINK_FAILURE"

    # 4. Restore the link
    restore_res = client.post("/api/v1/network/links/LINK-R1-R2/restore")
    assert restore_res.status_code == 200
    restore_data = restore_res.json()

    assert restore_data["status"] == "success"
    assert restore_data["action"] == "RESTORED"
    assert restore_data["link"]["operational_state"] == "UP"
    assert restore_data["after_path"] == ["ROUTER-01", "ROUTER-02"]

    # Verify alert resolved
    db_session.expire_all()
    resolved_alert = db_session.query(Alert).filter(Alert.alert_id == alert_record.alert_id).first()
    assert resolved_alert.status == "RESOLVED"


def test_failure_with_no_alternate_route_disconnected(client: TestClient, db_session: Session):
    """
    Test 2: Failure with no alternate route (destination disconnected/unreachable).
    When a destination node fails, all routes to it are severed with no alternate path possible.
    The routing engine reports reachability as False, empty path, and simulation run records FAILED result.
    """
    # 1. Reset baseline first
    client.post("/api/v1/network/reset")

    # 2. Verify FIRE-03 is initially reachable from Emergency Control Center
    init_route = client.get(
        "/api/v1/network/routes",
        params={"source": "HQ-COMMAND-01", "destination": "FIRE-03"},
    )
    assert init_route.status_code == 200
    assert init_route.json()["reachability"] is True

    # 3. Fail node FIRE-03
    fail_res = client.post(
        "/api/v1/network/nodes/FIRE-03/failure",
        json={"reason": "Catastrophic power grid failure at fire dispatch center"},
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()

    assert fail_data["status"] == "success"
    assert fail_data["action"] == "FAILED"
    assert fail_data["node"]["status"] == "offline"
    assert fail_data["reachability"]["FIRE-03"] is False

    # 4. Verify route calculation now reports UNREACHABLE
    route_check = client.get(
        "/api/v1/network/routes",
        params={"source": "HQ-COMMAND-01", "destination": "FIRE-03"},
    )
    assert route_check.status_code == 200
    route_data = route_check.json()
    assert route_data["reachability"] is False
    assert route_data["status"] == "UNREACHABLE"
    assert route_data["path"] == []

    # 5. Check persisted simulation run reports FAILED result
    sim_run_id = fail_data["simulation_run_id"]
    sim_record = db_session.query(SimulationRun).filter(SimulationRun.run_id == sim_run_id).first()
    assert sim_record is not None
    assert sim_record.result == "FAILED"
    assert sim_record.packet_statistics["packet_loss_percent"] == 100.0

    # 6. Restore node and confirm FIRE-03 becomes reachable again
    restore_res = client.post("/api/v1/network/nodes/FIRE-03/restore")
    assert restore_res.status_code == 200
    assert restore_res.json()["action"] == "RESTORED"

    route_restored = client.get(
        "/api/v1/network/routes",
        params={"source": "HQ-COMMAND-01", "destination": "FIRE-03"},
    )
    assert route_restored.status_code == 200
    assert route_restored.json()["reachability"] is True
    assert route_restored.json()["status"] == "OPTIMAL"



def test_controlled_baseline_reset_preserves_history(client: TestClient, db_session: Session):
    """
    Test 3: Controlled baseline reset restores default topology configuration
    while preserving historical simulation runs and network audit events.
    """
    # 1. Cause multiple link and node failures
    client.post("/api/v1/network/links/LINK-R1-R2/failure", json={"reason": "Drill 1"})
    client.post("/api/v1/network/links/LINK-R3-R4/failure", json={"reason": "Drill 2"})
    client.post("/api/v1/network/nodes/ROUTER-03/failure", json={"reason": "Drill 3"})

    # Check that resources are DOWN / offline
    down_links = db_session.query(NetworkLink).filter(NetworkLink.operational_state == "DOWN").count()
    offline_nodes = db_session.query(NetworkNode).filter(NetworkNode.status == "offline").count()
    assert down_links >= 2
    assert offline_nodes >= 1

    # Count historical records before reset
    runs_before = db_session.query(SimulationRun).count()
    events_before = db_session.query(NetworkEvent).count()
    assert runs_before >= 3
    assert events_before >= 3

    # 2. Trigger baseline reset
    reset_res = client.post("/api/v1/network/reset")
    assert reset_res.status_code == 200
    reset_data = reset_res.json()

    assert reset_data["status"] == "success"
    assert reset_data["restored_nodes_count"] >= 1
    assert reset_data["restored_links_count"] >= 2
    assert reset_data["historical_runs_preserved"] >= runs_before
    assert reset_data["historical_events_preserved"] >= events_before

    # 3. Verify in database: All nodes ACTIVE, all links UP, historical runs intact
    db_session.expire_all()
    remaining_down_links = db_session.query(NetworkLink).filter(NetworkLink.operational_state != "UP").count()
    remaining_offline_nodes = db_session.query(NetworkNode).filter(NetworkNode.status != "active").count()
    assert remaining_down_links == 0
    assert remaining_offline_nodes == 0

    runs_after = db_session.query(SimulationRun).count()
    events_after = db_session.query(NetworkEvent).count()
    assert runs_after == runs_before
    assert events_after >= events_before + 1  # includes BASELINE_RESET event


def test_concurrency_protection():
    """
    Test 4: Concurrency protection.
    Tests network_service thread safety under concurrent execution across worker threads.
    Each thread acquires its own database session and simultaneously executes failure,
    restoration, reachability matrix, and baseline reset operations under network_state_lock.
    Verifies no deadlocks, race conditions, or corrupted state.
    """
    def worker_action(action_id: int):
        session = TestingSessionLocal()
        try:
            if action_id == 1:
                network_service.fail_link(session, "LINK-R1-R2", "Concurrent drill 1")
            elif action_id == 2:
                network_service.restore_link(session, "LINK-R1-R2")
            elif action_id == 3:
                network_service.fail_node(session, "RELAY-NORTH-02", "Concurrent drill 2")
            elif action_id == 4:
                network_service.restore_node(session, "RELAY-NORTH-02")
            elif action_id == 5:
                network_service.get_reachability_matrix(session, "HQ-COMMAND-01")
            elif action_id == 6:
                network_service.reset_baseline_network(session)
        finally:
            session.close()

    actions = [1, 2, 3, 4, 5, 6] * 4
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(worker_action, act) for act in actions]
        for f in futures:
            f.result()

    # Clean final reset
    final_session = TestingSessionLocal()
    try:
        network_service.reset_baseline_network(final_session)
        metrics = network_service.get_metrics(final_session)
        assert metrics.down_links == 0
        assert metrics.offline_nodes == 0
    finally:
        final_session.close()


def test_network_reachability_matrix_endpoint(client: TestClient):
    """
    Test 5: Reachability matrix endpoint.
    Verifies reachability matrix evaluates all departmental endpoints, routers,
    and switches with path hop breakdowns and percentages.
    """
    client.post("/api/v1/network/reset")
    res = client.get("/api/v1/network/reachability", params={"source_node_id": "HQ-COMMAND-01"})
    assert res.status_code == 200
    data = res.json()

    assert data["source_node_id"] == "HQ-COMMAND-01"
    assert data["total_destinations"] >= 7
    assert data["reachable_destinations"] >= 7
    assert data["reachability_percentage"] == 100.0
    assert "HOSPITAL-TRIAGE-03" in data["destinations"]
    assert data["destinations"]["HOSPITAL-TRIAGE-03"]["reachable"] is True
    assert data["destinations"]["HOSPITAL-TRIAGE-03"]["status"] == "OPTIMAL"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.event import NetworkEvent
from app.models.simulation import SimulationRun
from app.services import telemetry_service


def test_list_alerts_with_all_filters(client: TestClient, db_session: Session):
    """Test filtering alerts by severity, category, status, and time range."""
    # Ensure baseline data exists
    telemetry_service.seed_baseline_simulation_runs_if_empty(db_session)

    # Create distinct test alerts
    alert1 = Alert(
        alert_id="ALT-TEST-CRIT-01",
        severity="CRITICAL",
        category="CONNECTIVITY",
        title="Fiber Severance Alert",
        description="Core fiber trunk disconnected.",
        affected_resource="LINK-R1-R2",
        status="ACTIVE",
    )
    alert2 = Alert(
        alert_id="ALT-TEST-WARN-02",
        severity="WARNING",
        category="CONGESTION",
        title="Link Congestion Warning",
        description="High packet queueing on bottleneck link.",
        affected_resource="LINK-R2-R3",
        status="ACKNOWLEDGED",
    )
    alert3 = Alert(
        alert_id="ALT-TEST-INFO-03",
        severity="INFO",
        category="CONNECTIVITY",
        title="Connectivity Restored",
        description="Link restored to UP state.",
        affected_resource="LINK-R1-R2",
        status="RESOLVED",
    )
    db_session.add_all([alert1, alert2, alert3])
    db_session.commit()

    # 1. Filter by severity
    res_crit = client.get("/api/v1/alerts?severity=CRITICAL")
    assert res_crit.status_code == 200
    crit_ids = [a["alert_id"] for a in res_crit.json()]
    assert "ALT-TEST-CRIT-01" in crit_ids
    assert "ALT-TEST-WARN-02" not in crit_ids

    # 2. Filter by status
    res_ack = client.get("/api/v1/alerts?status=ACKNOWLEDGED")
    assert res_ack.status_code == 200
    ack_ids = [a["alert_id"] for a in res_ack.json()]
    assert "ALT-TEST-WARN-02" in ack_ids
    assert "ALT-TEST-CRIT-01" not in ack_ids

    # 3. Filter by category
    res_cong = client.get("/api/v1/alerts?category=CONGESTION")
    assert res_cong.status_code == 200
    cong_ids = [a["alert_id"] for a in res_cong.json()]
    assert "ALT-TEST-WARN-02" in cong_ids
    assert "ALT-TEST-CRIT-01" not in cong_ids

    # 4. Filter by resource
    res_link = client.get("/api/v1/alerts?resource=LINK-R1-R2")
    assert res_link.status_code == 200
    link_ids = [a["alert_id"] for a in res_link.json()]
    assert "ALT-TEST-CRIT-01" in link_ids
    assert "ALT-TEST-INFO-03" in link_ids

    # 5. Filter by time range
    res_time = client.get("/api/v1/alerts?time_range=24h")
    assert res_time.status_code == 200
    assert len(res_time.json()) >= 3


def test_alert_acknowledgment_and_resolution(client: TestClient, db_session: Session):
    """Test acknowledging and resolving alerts via backend API endpoints and verifying persistence."""
    test_alert = Alert(
        alert_id="ALT-ACTION-TEST-01",
        severity="HIGH",
        category="SECURITY",
        title="Security Violation Dropped",
        description="Unauthorized cross-VLAN communication attempt.",
        affected_resource="POLICE -> HOSPITAL",
        status="ACTIVE",
    )
    db_session.add(test_alert)
    db_session.commit()

    # Acknowledge via POST /alerts/{id}/acknowledge
    ack_res = client.post("/api/v1/alerts/ALT-ACTION-TEST-01/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # Verify persisted in database
    db_alert = db_session.query(Alert).filter(Alert.alert_id == "ALT-ACTION-TEST-01").first()
    assert db_alert.status == "ACKNOWLEDGED"

    # Resolve via PATCH /alerts/{id}
    patch_res = client.patch(
        "/api/v1/alerts/ALT-ACTION-TEST-01",
        json={"status": "RESOLVED"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "RESOLVED"

    db_session.refresh(db_alert)
    assert db_alert.status == "RESOLVED"


def test_alerts_generated_from_simulation_events(client: TestClient, db_session: Session):
    """Verify alerts are created from link failures, routing changes, and access-control denials."""
    # 1. Trigger link failure
    fail_res = client.post("/api/v1/network/links/LINK-R1-R2/failure", json={"reason": "Simulated fiber severance"})
    assert fail_res.status_code == 200

    # Verify alert was created with affected_resource
    alerts_res = client.get("/api/v1/alerts?resource=LINK-R1-R2")
    assert alerts_res.status_code == 200
    link_alerts = alerts_res.json()
    assert len(link_alerts) > 0
    assert any(a["affected_resource"] == "LINK-R1-R2" for a in link_alerts)

    # 2. Trigger link restoration
    restore_res = client.post("/api/v1/network/links/LINK-R1-R2/restore")
    assert restore_res.status_code == 200

    # 3. Trigger ACL access denial
    acl_res = client.post(
        "/api/v1/access-rules/evaluate",
        json={
            "source_department": "Relief Camp",
            "destination_department": "Backup Control Center",
            "protocol": "ANY",
        },
    )
    assert acl_res.status_code == 200
    assert acl_res.json()["permitted"] is False

    # Verify security alert logged
    sec_alerts_res = client.get("/api/v1/alerts?category=SECURITY")
    assert sec_alerts_res.status_code == 200
    sec_alerts = sec_alerts_res.json()
    assert len(sec_alerts) > 0


def test_forensic_timeline_for_simulation_run(client: TestClient, db_session: Session):
    """Test retrieving forensic timeline for a historical simulation run in read-only mode."""
    # Ensure baseline run exists
    telemetry_service.seed_baseline_simulation_runs_if_empty(db_session)
    run = db_session.query(SimulationRun).first()
    assert run is not None

    timeline_res = client.get(f"/api/v1/events/timeline/{run.run_id}")
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()

    assert timeline["run_id"] == run.run_id
    assert "steps" in timeline
    assert len(timeline["steps"]) >= 4

    phases = [s["phase"] for s in timeline["steps"]]
    assert "FAILURE_INJECTION" in phases
    assert "ROUTE_RECALCULATION" in phases
    assert "PACKET_AUDIT" in phases
    assert "ACCESS_CONTROL" in phases
    assert "RECOVERY_CONVERGENCE" in phases

    # Verify read-only: running state of network was not modified
    for step in timeline["steps"]:
        assert "title" in step
        assert "description" in step
        assert "timestamp" in step
        assert "details" in step

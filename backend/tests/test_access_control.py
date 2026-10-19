import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.access_rule import AccessRule
from app.models.event import NetworkEvent
from app.models.alert import Alert


def test_list_access_rules(client: TestClient):
    """Ensure baseline demonstration access rules are retrieved."""
    response = client.get("/api/v1/access-rules")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    rule_ids = [r["rule_id"] for r in data]
    assert "RULE-ALL-EMERGENCY" in rule_ids
    assert "RULE-MED-TRIAGE" in rule_ids
    assert "RULE-PUBLIC-ISOLATION" in rule_ids


def test_permitted_traffic(client: TestClient):
    """
    Test that permitted traffic (Ambulance Services -> Hospital via TCP)
    matches RULE-MED-TRIAGE and returns permitted=True.
    """
    payload = {
        "source_department": "Ambulance Services",
        "destination_department": "Hospital",
        "protocol": "TCP",
    }
    response = client.post("/api/v1/access-rules/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["permitted"] is True
    assert data["action"] == "PERMIT"
    assert data["matched_rule_id"] == "RULE-MED-TRIAGE"
    assert data["source_vlan_id"] == 50
    assert data["destination_vlan_id"] == 40
    assert data["path_reachable"] is True
    assert len(data["path"]) > 1
    assert data["security_event_logged"] is False
    assert "SIMULATION NOTICE" in data["disclaimer"]


def test_denied_traffic_and_security_event_logging(client: TestClient, db_session: Session):
    """
    Test that denied traffic (Relief Camp -> Backup Control Center)
    matches RULE-PUBLIC-ISOLATION, returns permitted=False,
    and logs a persistent security violation event and alert.
    """
    initial_alerts_count = db_session.query(Alert).filter(Alert.category == "SECURITY").count()
    initial_events_count = db_session.query(NetworkEvent).filter(NetworkEvent.event_type == "SECURITY_VIOLATION").count()

    payload = {
        "source_department": "Relief Camp",
        "destination_department": "Backup Control Center",
        "protocol": "ANY",
    }
    response = client.post("/api/v1/access-rules/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["permitted"] is False
    assert data["action"] == "DENY"
    assert data["matched_rule_id"] == "RULE-PUBLIC-ISOLATION"
    assert data["source_vlan_id"] == 60
    assert data["destination_vlan_id"] == 70
    assert data["security_event_logged"] is True

    # Crucially verify routing reachability vs security authorization separation:
    # Physical/OSPF graph path IS reachable, while access authorization is DENIED
    assert data["path_reachable"] is True
    assert "OSPF" in data["routing_status"]

    # Verify event and alert in DB
    new_alerts_count = db_session.query(Alert).filter(Alert.category == "SECURITY").count()
    new_events_count = db_session.query(NetworkEvent).filter(NetworkEvent.event_type == "SECURITY_VIOLATION").count()
    assert new_alerts_count > initial_alerts_count
    assert new_events_count > initial_events_count


def test_implicit_default_deny(client: TestClient):
    """
    Test unconfigured traffic that does not match any rule falls through
    to implicit default zero-trust DENY.
    """
    payload = {
        "source_department": "Relief Camp",
        "destination_department": "Hospital",
        "protocol": "UDP",
    }
    response = client.post("/api/v1/access-rules/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["permitted"] is False
    assert data["action"] == "DENY"
    assert data["matched_rule_id"] is None
    assert "zero-trust default DENY" in data["explanation"]
    assert data["security_event_logged"] is True


def test_disabled_rules_behavior(client: TestClient):
    """
    Test that disabling a rule causes traffic to skip that rule.
    When RULE-MED-TRIAGE is disabled, Ambulance -> Hospital is no longer permitted
    by that rule and falls through to default DENY.
    """
    # 1. Disable the rule
    patch_resp = client.patch(
        "/api/v1/access-rules/RULE-MED-TRIAGE",
        json={"enabled": False},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["enabled"] is False

    try:
        # 2. Evaluate connection
        eval_resp = client.post(
            "/api/v1/access-rules/evaluate",
            json={
                "source_department": "Ambulance Services",
                "destination_department": "Hospital",
                "protocol": "TCP",
            },
        )
        assert eval_resp.status_code == 200
        data = eval_resp.json()
        assert data["permitted"] is False
        assert data["action"] == "DENY"
        assert data["matched_rule_id"] is None
    finally:
        # Re-enable the rule for idempotency
        client.patch(
            "/api/v1/access-rules/RULE-MED-TRIAGE",
            json={"enabled": True},
        )


def test_invalid_configurations(client: TestClient):
    """Test validation errors on unknown departments or invalid IP addresses."""
    # Unknown source department
    resp_bad_dept = client.post(
        "/api/v1/access-rules/evaluate",
        json={
            "source_department": "NonExistentSector99",
            "destination_department": "Hospital",
            "protocol": "TCP",
        },
    )
    assert resp_bad_dept.status_code == 400
    assert "Unable to resolve department" in resp_bad_dept.json()["detail"]

    # Invalid source IP syntax
    resp_bad_ip = client.post(
        "/api/v1/access-rules/evaluate",
        json={
            "source_department": "Hospital",
            "destination_department": "Fire Department",
            "source_ip": "999.999.999.999",
            "protocol": "TCP",
        },
    )
    assert resp_bad_ip.status_code == 400
    assert "Invalid IP address" in resp_bad_ip.json()["detail"]


def test_create_and_delete_custom_access_rule(client: TestClient):
    """Test creating a new access rule, evaluating it, then deleting it."""
    custom_rule = {
        "rule_id": "RULE-TEST-CUSTOM-01",
        "source": "Fire Department",
        "destination": "Relief Camp",
        "protocol": "UDP",
        "action": "PERMIT",
        "enabled": True,
    }
    create_resp = client.post("/api/v1/access-rules", json=custom_rule)
    assert create_resp.status_code == 201
    assert create_resp.json()["rule_id"] == "RULE-TEST-CUSTOM-01"

    # Evaluate using the newly created rule
    eval_resp = client.post(
        "/api/v1/access-rules/evaluate",
        json={
            "source_department": "Fire Department",
            "destination_department": "Relief Camp",
            "protocol": "UDP",
        },
    )
    assert eval_resp.status_code == 200
    assert eval_resp.json()["permitted"] is True
    assert eval_resp.json()["matched_rule_id"] == "RULE-TEST-CUSTOM-01"

    # Delete the rule
    del_resp = client.delete("/api/v1/access-rules/RULE-TEST-CUSTOM-01")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True


def test_department_vlan_update(client: TestClient):
    """Test updating departmental VLAN ID, subnet, and gateway configuration."""
    dept_code = "RELIEF"
    update_payload = {
        "vlan_id": 65,
        "subnet": "192.168.65.0/24",
        "gateway": "192.168.65.1",
    }
    resp = client.patch(f"/api/v1/departments/{dept_code}", json=update_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["vlan_id"] == 65
    assert data["subnet"] == "192.168.65.0/24"
    assert data["gateway"] == "192.168.65.1"

    # Reset back to default VLAN 60
    reset_resp = client.patch(
        f"/api/v1/departments/{dept_code}",
        json={
            "vlan_id": 60,
            "subnet": "192.168.60.0/24",
            "gateway": "192.168.60.1",
        },
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["vlan_id"] == 60

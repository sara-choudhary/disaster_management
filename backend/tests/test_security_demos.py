import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import ipaddress

from app.models.event import NetworkEvent
from app.models.alert import Alert
from app.services.dhcp_service import reset_dhcp_pool
from app.services.port_security_service import reset_switch_port


# ---------------- DHCP Tests ----------------

def test_dhcp_inspect_departmental_configurations(client: TestClient):
    """Inspect all departmental DHCP address pools, subnet masks, gateways, and DNS settings."""
    response = client.get("/api/v1/security-demos/dhcp")
    assert response.status_code == 200
    configs = response.json()
    assert len(configs) >= 7

    # Verify ECC (VLAN 10)
    ecc = next(c for c in configs if c["department_code"] == "ECC")
    assert ecc["vlan_id"] == 10
    assert ecc["subnet"] == "192.168.10.0/24"
    assert ecc["subnet_mask"] == "255.255.255.0"
    assert ecc["gateway"] == "192.168.10.1"
    assert "192.168.10.1" in ecc["dns_servers"]
    assert ecc["total_pool_addresses"] > 0
    assert ecc["available_addresses_count"] >= 0


def test_dhcp_allocation_and_subnet_validation(client: TestClient):
    """
    Simulate DHCP address allocation and validate that assigned IP strictly
    belongs to the department's CIDR subnet.
    """
    reset_dhcp_pool("FIRE")
    req = {
        "department_code": "FIRE",
        "hostname": "FIRE-TRUCK-ENGINE-09",
        "mac_address": "02:00:c0:a8:1e:99",
    }
    response = client.post("/api/v1/security-demos/dhcp/lease", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["assigned_ip"] is not None
    assert data["gateway"] == "192.168.30.1"
    assert data["subnet"] == "192.168.30.0/24"

    # Strictly validate subnet membership
    net = ipaddress.ip_network("192.168.30.0/24")
    allocated = ipaddress.ip_address(data["assigned_ip"])
    assert allocated in net
    assert "VALIDATED" in data["subnet_validation"]


def test_dhcp_pool_exhaustion_and_release(client: TestClient):
    """
    Simulate address allocations until the departmental pool is completely exhausted,
    then release a lease and verify address availability is restored.
    """
    reset_dhcp_pool("HOSPITAL")

    # Allocate until exhaustion (Hospital pool has 6 addresses: .50 to .55)
    last_response = None
    for i in range(10):
        resp = client.post(
            "/api/v1/security-demos/dhcp/lease",
            json={
                "department_code": "HOSPITAL",
                "hostname": f"HOSP-MOBILE-TABLET-{i}",
            },
        )
        assert resp.status_code == 200
        last_response = resp.json()
        if last_response["pool_exhausted"]:
            break

    assert last_response is not None
    assert last_response["pool_exhausted"] is True
    assert last_response["success"] is False
    assert "Exhausted" in last_response["message"]

    # Now release an IP address (.51)
    rel_resp = client.post(
        "/api/v1/security-demos/dhcp/release?department_code=HOSPITAL&ip_address=192.168.40.51"
    )
    assert rel_resp.status_code == 200
    assert rel_resp.json()["released"] is True

    # Try allocating again: it should succeed and re-lease 192.168.40.51!
    realloc_resp = client.post(
        "/api/v1/security-demos/dhcp/lease",
        json={
            "department_code": "HOSPITAL",
            "hostname": "HOSP-NEW-VENTILATOR-01",
        },
    )
    assert realloc_resp.status_code == 200
    realloc_data = realloc_resp.json()
    assert realloc_data["success"] is True
    assert realloc_data["assigned_ip"] == "192.168.40.51"
    assert realloc_data["pool_exhausted"] is False


# ---------------- SSH Management Tests ----------------

def test_ssh_inspect_device_configuration(client: TestClient):
    """Verify simulated Cisco IOS SSH configuration display and access-class policy."""
    response = client.get("/api/v1/security-demos/ssh/configs")
    assert response.status_code == 200
    configs = response.json()
    assert len(configs) >= 4

    r1 = next(c for c in configs if c["device_id"] == "ROUTER-01")
    assert r1["ssh_version"] == "SSHv2"
    assert "access-list 99" in r1["simulated_ios_config"]
    assert "192.168.10.0/24" in r1["allowed_management_subnets"]


def test_ssh_authorized_management_connection(client: TestClient):
    """
    Test authorized SSH connection from ECC management subnet (192.168.10.15)
    with admin credentials.
    """
    req = {
        "target_device_id": "ROUTER-01",
        "source_ip": "192.168.10.15",
        "username": "admin_ecc",
        "auth_method": "SSH_KEY",
    }
    response = client.post("/api/v1/security-demos/ssh/connect", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["source_subnet_authorized"] is True
    assert data["terminal_prompt"] == "ROUTER-01# "
    assert "chacha20-poly1305" in data["cipher_suite"]
    assert data["security_event_logged"] is False
    assert "EDUCATIONAL SIMULATION NOTICE" in data["disclaimer"]


def test_ssh_unauthorized_management_connection_logged(client: TestClient, db_session: Session):
    """
    Test unauthorized SSH connection from Relief Camp public subnet (192.168.60.25).
    Verifies rejection by access-class 99 and logs persistent security violation.
    """
    init_events = db_session.query(NetworkEvent).filter(NetworkEvent.affected_resource == "ROUTER-01:VTY_SSH").count()

    req = {
        "target_device_id": "ROUTER-01",
        "source_ip": "192.168.60.25",  # Outside management network
        "username": "admin_ecc",
        "auth_method": "SSH_KEY",
    }
    response = client.post("/api/v1/security-demos/ssh/connect", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is False
    assert data["source_subnet_authorized"] is False
    assert "access-class 99 in" in data["explanation"]
    assert data["security_event_logged"] is True

    # Check database event
    new_events = db_session.query(NetworkEvent).filter(NetworkEvent.affected_resource == "ROUTER-01:VTY_SSH").count()
    assert new_events > init_events


# ---------------- Port Security Tests ----------------

def test_port_security_authorized_device_traffic(client: TestClient):
    """Test authorized device on hospital access-port forwards frames normally."""
    reset_switch_port("SW-HOSPITAL-Fa0/1")
    req = {
        "port_id": "SW-HOSPITAL-Fa0/1",
        "incoming_mac": "00:1A:2B:3C:4D:5E",  # Allowed MAC
    }
    response = client.post("/api/v1/security-demos/port-security/test", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["is_authorized"] is True
    assert data["traffic_forwarded"] is True
    assert data["port_status_after"] == "SECURE_UP"
    assert data["security_event_logged"] is False


def test_port_security_unauthorized_device_shutdown_and_recovery(client: TestClient, db_session: Session):
    """
    Test rogue MAC on hospital switch port (mode: SHUTDOWN) triggers err-disable state,
    drops traffic, records a critical security violation event, and recovers upon reset.
    """
    reset_switch_port("SW-HOSPITAL-Fa0/1")
    init_alerts = db_session.query(Alert).filter(Alert.category == "SECURITY").count()

    req = {
        "port_id": "SW-HOSPITAL-Fa0/1",
        "incoming_mac": "DE:AD:BE:EF:CA:FE",  # Rogue MAC
    }
    response = client.post("/api/v1/security-demos/port-security/test", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["is_authorized"] is False
    assert data["traffic_forwarded"] is False
    assert data["port_status_after"] == "ERR_DISABLED"
    assert data["violation_count"] >= 1
    assert data["security_event_logged"] is True

    # Verify critical security alert in DB
    new_alerts = db_session.query(Alert).filter(Alert.category == "SECURITY").count()
    assert new_alerts > init_alerts

    # Test that subsequent frames are blocked due to err-disable
    subsequent = client.post(
        "/api/v1/security-demos/port-security/test",
        json={"port_id": "SW-HOSPITAL-Fa0/1", "incoming_mac": "00:1A:2B:3C:4D:5E"},
    )
    assert subsequent.status_code == 200
    assert subsequent.json()["traffic_forwarded"] is False
    assert subsequent.json()["port_status_after"] == "ERR_DISABLED"

    # Reset port (simulated shutdown / no shutdown)
    reset_resp = client.post("/api/v1/security-demos/port-security/SW-HOSPITAL-Fa0/1/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["operational_status"] == "SECURE_UP"


def test_port_security_restrict_mode(client: TestClient, db_session: Session):
    """Test rogue MAC on police switch port (mode: RESTRICT) drops frame and logs alert."""
    reset_switch_port("SW-POLICE-Fa0/1")
    req = {
        "port_id": "SW-POLICE-Fa0/1",
        "incoming_mac": "11:22:33:44:55:66",
    }
    response = client.post("/api/v1/security-demos/port-security/test", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["is_authorized"] is False
    assert data["traffic_forwarded"] is False
    assert data["port_status_after"] == "RESTRICTED"
    assert data["violation_action"] == "RESTRICT"
    assert data["security_event_logged"] is True


# ---------------- NAT Tests ----------------

def test_nat_private_to_public_translation(client: TestClient):
    """
    Test outbound private-to-public NAT translation for external service (NDMA Cloud),
    and verify header rewrite and non-interference with internal routing.
    """
    req = {
        "source_department": "Hospital",
        "external_destination_service": "NDMA_CLOUD",
    }
    response = client.post("/api/v1/security-demos/nat/simulate", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["translation_success"] is True
    assert data["flow_type"] == "OUTBOUND_WAN"
    assert data["nat_applied"] is True
    assert "203.0.113.1" in data["inside_global"]
    assert "198.51.100.50:443" in data["outside_global"]
    assert "OUTBOUND PACKET REWRITE" in data["header_rewrite_summary"]
    # Verify internal routing distinction notice
    assert "NAT is NOT required for internal communication" in data["internal_routing_notice"]

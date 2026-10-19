from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.security_demos import (
    DHCPSubnetConfig,
    DHCPLeaseRequest,
    DHCPLeaseResponse,
    SSHDeviceConfig,
    SSHSimulationRequest,
    SSHSimulationResponse,
    PortSecurityConfig,
    PortSecurityTestRequest,
    PortSecurityTestResponse,
    NATTranslationEntry,
    NATSimulationRequest,
    NATSimulationResponse,
)
from app.services import (
    dhcp_service,
    ssh_service,
    port_security_service,
    nat_service,
)

router = APIRouter()


# ---------------- DHCP Endpoints ----------------

@router.get("/dhcp", response_model=List[DHCPSubnetConfig], tags=["Security Demos - DHCP"])
def list_dhcp_configurations():
    """Retrieve all departmental DHCP address pools, subnet masks, gateways, and active leases."""
    return dhcp_service.get_all_dhcp_configs()


@router.get("/dhcp/{dept_code}", response_model=DHCPSubnetConfig, tags=["Security Demos - DHCP"])
def get_department_dhcp(dept_code: str):
    """Retrieve DHCP configuration and active lease table for a specific department."""
    return dhcp_service.get_dhcp_config_by_dept(dept_code)


@router.post("/dhcp/lease", response_model=DHCPLeaseResponse, tags=["Security Demos - DHCP"])
def request_dhcp_lease(payload: DHCPLeaseRequest):
    """
    Simulate DHCP DORA address allocation.
    Validates subnet membership and models pool exhaustion when capacity is reached.
    """
    return dhcp_service.allocate_dhcp_lease(payload)


@router.post("/dhcp/release", tags=["Security Demos - DHCP"])
def release_dhcp_lease(department_code: str = Query(...), ip_address: str = Query(...)):
    """Release an active DHCP lease, returning the IP address to the departmental pool."""
    success = dhcp_service.release_dhcp_lease(department_code, ip_address)
    return {"released": success, "ip_address": ip_address, "department": department_code}


@router.post("/dhcp/reset", tags=["Security Demos - DHCP"])
def reset_dhcp_pool(department_code: Optional[str] = Query(None)):
    """Reset departmental DHCP pool back to initial demonstration baseline."""
    dhcp_service.reset_dhcp_pool(department_code)
    return {"status": "reset_successful", "department": department_code or "ALL"}


# ---------------- SSH Management Endpoints ----------------

@router.get("/ssh/configs", response_model=List[SSHDeviceConfig], tags=["Security Demos - SSH"])
def list_ssh_device_configs():
    """Retrieve simulated Cisco IOS SSH management configurations and access-class restrictions."""
    return ssh_service.get_all_ssh_device_configs()


@router.post("/ssh/connect", response_model=SSHSimulationResponse, tags=["Security Demos - SSH"])
def test_ssh_connection(payload: SSHSimulationRequest, db: Session = Depends(get_db)):
    """
    Simulate remote device SSH management attempt.
    Enforces management ACL 99 subnet restrictions and admin authentication.
    Does not execute real shell commands or expose host credentials.
    """
    return ssh_service.simulate_ssh_connection(db, payload)


# ---------------- Switch Port Security Endpoints ----------------

@router.get("/port-security", response_model=List[PortSecurityConfig], tags=["Security Demos - Port Security"])
def list_port_security_configs():
    """Retrieve switch access-port security configurations (allowed MACs, violation modes, status)."""
    return port_security_service.get_all_port_security_configs()


@router.post("/port-security/test", response_model=PortSecurityTestResponse, tags=["Security Demos - Port Security"])
def test_port_frame_ingress(payload: PortSecurityTestRequest, db: Session = Depends(get_db)):
    """
    Simulate ingress frame MAC evaluation against switch port security policy.
    Demonstrates authorized forwarding versus SHUTDOWN (err-disable), RESTRICT, or PROTECT behaviors.
    """
    return port_security_service.test_port_security(db, payload)


@router.post("/port-security/reset", response_model=PortSecurityConfig, tags=["Security Demos - Port Security"])
def reset_err_disabled_port_query(port_id: str = Query(...)):
    """
    Simulate administrative port recovery ('shutdown' followed by 'no shutdown').
    Restores an err-disabled port to SECURE_UP operational status.
    """
    return port_security_service.reset_switch_port(port_id)


@router.post("/port-security/{port_id:path}/reset", response_model=PortSecurityConfig, tags=["Security Demos - Port Security"])
def reset_err_disabled_port(port_id: str):
    """
    Simulate administrative port recovery ('shutdown' followed by 'no shutdown').
    Restores an err-disabled port to SECURE_UP operational status.
    """
    return port_security_service.reset_switch_port(port_id)


# ---------------- NAT Endpoints ----------------

@router.get("/nat/table", response_model=List[NATTranslationEntry], tags=["Security Demos - NAT"])
def list_nat_translation_table():
    """Retrieve active NAT/PAT private-to-public translation table."""
    return nat_service.get_nat_translation_table()


@router.post("/nat/simulate", response_model=NATSimulationResponse, tags=["Security Demos - NAT"])
def simulate_nat_translation(payload: NATSimulationRequest):
    """
    Simulate private-to-public NAT translation for external WAN communications.
    Demonstrates that intra-departmental emergency mesh communications bypass NAT.
    """
    return nat_service.simulate_nat_flow(payload)

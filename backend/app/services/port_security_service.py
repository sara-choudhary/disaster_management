import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.event import NetworkEvent
from app.models.alert import Alert
from app.schemas.security_demos import (
    PortSecurityConfig,
    PortSecurityTestRequest,
    PortSecurityTestResponse,
)

PORT_SECURITY_DISCLAIMER = (
    "EDUCATIONAL SIMULATION NOTICE: This is a software demonstration of Cisco switch port-security "
    "(802.1X/MAC sticky filtering). It models port violation modes (shutdown, restrict, protect) "
    "and err-disable state transitions. It does not configure physical switch ASIC hardware."
)

DEFAULT_SWITCH_PORTS: Dict[str, Dict[str, Any]] = {
    "SW-HOSPITAL-Fa0/1": {
        "switch_id": "SW-HOSPITAL",
        "department": "Hospital",
        "vlan_id": 40,
        "allowed_mac": "00:1A:2B:3C:4D:5E",
        "max_mac_count": 1,
        "violation_action": "SHUTDOWN",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
    "SW-ECC-Fa0/1": {
        "switch_id": "SW-ECC",
        "department": "Emergency Control Center",
        "vlan_id": 10,
        "allowed_mac": "02:00:C0:A8:0A:32",
        "max_mac_count": 1,
        "violation_action": "SHUTDOWN",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
    "SW-POLICE-Fa0/1": {
        "switch_id": "SW-POLICE",
        "department": "Police Station",
        "vlan_id": 20,
        "allowed_mac": "02:00:C0:A8:14:32",
        "max_mac_count": 1,
        "violation_action": "RESTRICT",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
    "SW-FIRE-Fa0/1": {
        "switch_id": "SW-FIRE",
        "department": "Fire Department",
        "vlan_id": 30,
        "allowed_mac": "02:00:C0:A8:1E:0A",
        "max_mac_count": 1,
        "violation_action": "PROTECT",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
    "SW-AMBULANCE-Fa0/1": {
        "switch_id": "SW-AMBULANCE",
        "department": "Ambulance Services",
        "vlan_id": 50,
        "allowed_mac": "02:00:C0:A8:32:01",
        "max_mac_count": 1,
        "violation_action": "RESTRICT",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
    "SW-RELIEF-Fa0/1": {
        "switch_id": "SW-RELIEF",
        "department": "Relief Camp",
        "vlan_id": 60,
        "allowed_mac": "02:00:C0:A8:3C:0A",
        "max_mac_count": 1,
        "violation_action": "SHUTDOWN",
        "operational_status": "SECURE_UP",
        "violation_count": 0,
        "last_violation_mac": None,
        "last_violation_time": None,
    },
}

_RUNTIME_PORTS: Dict[str, Dict[str, Any]] = {}


def _init_ports_if_needed():
    if not _RUNTIME_PORTS:
        for k, v in DEFAULT_SWITCH_PORTS.items():
            _RUNTIME_PORTS[k] = dict(v)


def get_all_port_security_configs() -> List[PortSecurityConfig]:
    """Retrieve all switch port security configurations."""
    _init_ports_if_needed()
    return [
        PortSecurityConfig(port_id=pid, **data)
        for pid, data in _RUNTIME_PORTS.items()
    ]


def normalize_mac(mac: str) -> str:
    """Normalize MAC address string into uppercase colon-delimited format."""
    clean = mac.replace("-", "").replace(":", "").replace(".", "").upper()
    if len(clean) != 12:
        return mac.upper()
    return ":".join(clean[i : i + 2] for i in range(0, 12, 2))


def test_port_security(
    db: Session, request: PortSecurityTestRequest
) -> PortSecurityTestResponse:
    """
    Simulates ingress frame evaluation against switch port security policy.
    Checks allowed MAC address and applies SHUTDOWN, RESTRICT, or PROTECT behaviors.
    Records security violation events and alerts on unauthorized frames.
    """
    _init_ports_if_needed()
    port_id = request.port_id.strip()
    if port_id not in _RUNTIME_PORTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Switch port '{request.port_id}' not found in port security registry",
        )

    port = _RUNTIME_PORTS[port_id]
    incoming_mac = normalize_mac(request.incoming_mac.strip())
    allowed_mac = normalize_mac(port["allowed_mac"])

    status_before = port["operational_status"]

    # 1. If port is already err-disabled, all traffic is dropped
    if status_before == "ERR_DISABLED":
        return PortSecurityTestResponse(
            port_id=port_id,
            switch_id=port["switch_id"],
            incoming_mac=incoming_mac,
            allowed_mac=allowed_mac,
            is_authorized=(incoming_mac == allowed_mac),
            violation_action=port["violation_action"],
            port_status_before=status_before,
            port_status_after="ERR_DISABLED",
            traffic_forwarded=False,
            violation_count=port["violation_count"],
            explanation=f"Port is in 'ERR_DISABLED' state from previous security violation. All traffic dropped until port is administratively reset (shutdown / no shutdown).",
            security_event_logged=False,
            disclaimer=PORT_SECURITY_DISCLAIMER,
        )

    # 2. Authorized MAC Check
    if incoming_mac == allowed_mac:
        return PortSecurityTestResponse(
            port_id=port_id,
            switch_id=port["switch_id"],
            incoming_mac=incoming_mac,
            allowed_mac=allowed_mac,
            is_authorized=True,
            violation_action=port["violation_action"],
            port_status_before=status_before,
            port_status_after="SECURE_UP",
            traffic_forwarded=True,
            violation_count=port["violation_count"],
            explanation=f"Authorized Access: Incoming frame MAC {incoming_mac} matches configured secure MAC on {port_id}. Frame forwarded without restriction.",
            security_event_logged=False,
            disclaimer=PORT_SECURITY_DISCLAIMER,
        )

    # 3. Violation Handling (Unauthorized MAC)
    port["last_violation_mac"] = incoming_mac
    port["last_violation_time"] = datetime.utcnow().isoformat()
    action = port["violation_action"].upper()
    security_event_logged = False

    if action == "SHUTDOWN":
        port["operational_status"] = "ERR_DISABLED"
        port["violation_count"] += 1
        status_after = "ERR_DISABLED"
        traffic_forwarded = False
        explanation = (
            f"PORT SECURITY VIOLATION: Rogue MAC {incoming_mac} detected on {port_id} (allowed: {allowed_mac}). "
            f"Action 'SHUTDOWN' executed: Port transitioned to ERR_DISABLED state and line protocol went down."
        )

        # Log critical event and alert
        event_id = f"EVT-PORTSEC-{uuid.uuid4().hex[:8]}"
        alert_id = f"ALT-PORTSEC-{uuid.uuid4().hex[:8]}"
        msg = f"Port Security Violation on {port_id}: Rogue MAC {incoming_mac} blocked. Port placed in ERR_DISABLED."

        db.add(
            NetworkEvent(
                event_id=event_id,
                timestamp=datetime.utcnow(),
                event_type="PORT_SECURITY_VIOLATION",
                severity="CRITICAL",
                message=msg,
                affected_resource=f"{port['switch_id']}:{port_id}",
                related_run="SWITCH-PORT-SEC",
            )
        )
        db.add(
            Alert(
                alert_id=alert_id,
                severity="CRITICAL",
                category="SECURITY",
                title=f"Port Security Violation: {port_id} Shut Down",
                description=msg,
                status="ACTIVE",
                timestamp=datetime.utcnow(),
            )
        )
        db.commit()
        security_event_logged = True

    elif action == "RESTRICT":
        port["operational_status"] = "RESTRICTED"
        port["violation_count"] += 1
        status_after = "RESTRICTED"
        traffic_forwarded = False
        explanation = (
            f"PORT SECURITY VIOLATION: Rogue MAC {incoming_mac} detected on {port_id} (allowed: {allowed_mac}). "
            f"Action 'RESTRICT' executed: Unauthorized frames dropped, violation counter incremented to {port['violation_count']}, and security alert generated. Port remains up for authorized frames."
        )

        event_id = f"EVT-PORTSEC-{uuid.uuid4().hex[:8]}"
        alert_id = f"ALT-PORTSEC-{uuid.uuid4().hex[:8]}"
        msg = f"Port Security Violation on {port_id}: Unauthorized frame from {incoming_mac} dropped (Action: RESTRICT)."

        db.add(
            NetworkEvent(
                event_id=event_id,
                timestamp=datetime.utcnow(),
                event_type="PORT_SECURITY_VIOLATION",
                severity="HIGH",
                message=msg,
                affected_resource=f"{port['switch_id']}:{port_id}",
                related_run="SWITCH-PORT-SEC",
            )
        )
        db.add(
            Alert(
                alert_id=alert_id,
                severity="HIGH",
                category="SECURITY",
                title=f"Port Security Frame Dropped: {port_id}",
                description=msg,
                status="ACTIVE",
                timestamp=datetime.utcnow(),
            )
        )
        db.commit()
        security_event_logged = True

    else:  # PROTECT mode
        status_after = "SECURE_UP"
        traffic_forwarded = False
        explanation = (
            f"PORT SECURITY VIOLATION: Rogue MAC {incoming_mac} detected on {port_id}. "
            f"Action 'PROTECT' executed: Unauthorized frames dropped silently without incrementing counter or generating alerts."
        )

    return PortSecurityTestResponse(
        port_id=port_id,
        switch_id=port["switch_id"],
        incoming_mac=incoming_mac,
        allowed_mac=allowed_mac,
        is_authorized=False,
        violation_action=action,
        port_status_before=status_before,
        port_status_after=status_after,
        traffic_forwarded=traffic_forwarded,
        violation_count=port["violation_count"],
        explanation=explanation,
        security_event_logged=security_event_logged,
        disclaimer=PORT_SECURITY_DISCLAIMER,
    )


def reset_switch_port(port_id: str) -> PortSecurityConfig:
    """
    Simulates administrative port recovery ('shutdown' followed by 'no shutdown').
    Clears ERR_DISABLED state and restores SECURE_UP operational status.
    """
    _init_ports_if_needed()
    pid = port_id.strip()
    if pid not in _RUNTIME_PORTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Port '{port_id}' not found",
        )
    port = _RUNTIME_PORTS[pid]
    port["operational_status"] = "SECURE_UP"
    port["violation_count"] = 0
    port["last_violation_mac"] = None
    port["last_violation_time"] = None
    return PortSecurityConfig(port_id=pid, **port)

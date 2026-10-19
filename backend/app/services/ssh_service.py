import uuid
import ipaddress
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.event import NetworkEvent
from app.models.alert import Alert
from app.schemas.security_demos import (
    SSHDeviceConfig,
    SSHSimulationRequest,
    SSHSimulationResponse,
)

SSH_DISCLAIMER = (
    "EDUCATIONAL SIMULATION NOTICE: This is a software simulation of Cisco IOS SSH management "
    "access-class filtering and cryptographic key authentication. No real SSH daemons are running, "
    "no host shell commands are executed, and no system credentials are exposed."
)

SSH_DEVICES: Dict[str, Dict[str, Any]] = {
    "ROUTER-01": {
        "device_name": "Core Router 1 (North Hub)",
        "device_type": "Cisco 2911 ISR",
        "ip_address": "10.0.0.1",
        "management_vlan": 10,
        "allowed_management_subnets": ["192.168.10.0/24", "192.168.70.0/24"],
        "ciphers": ["chacha20-poly1305@openssh.com", "aes256-gcm@openssh.com"],
        "rsa_key_bits": 2048,
        "simulated_ios_config": """! Cisco IOS Simulated Secure SSH Management Configuration
hostname ROUTER-01
ip domain-name emergency.mesh.internal
crypto key generate rsa modulus 2048
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
!
! Standard Access List restricting VTY remote management
access-list 99 remark PERMIT_ECC_AND_BACKUP_MANAGEMENT_ONLY
access-list 99 permit 192.168.10.0 0.0.0.255
access-list 99 permit 192.168.70.0 0.0.0.255
access-list 99 deny   any log
!
username admin_ecc privilege 15 secret 9 $9$simulated_hash_ecc_admin
username netops_lead privilege 15 secret 9 $9$simulated_hash_netops
!
line vty 0 4
  access-class 99 in
  transport input ssh
  login local
  exec-timeout 10 0
""",
    },
    "ROUTER-02": {
        "device_name": "Core Router 2 (East Hub - Medical Zone)",
        "device_type": "Cisco 2911 ISR",
        "ip_address": "10.0.0.2",
        "management_vlan": 10,
        "allowed_management_subnets": ["192.168.10.0/24", "192.168.70.0/24"],
        "ciphers": ["aes256-gcm@openssh.com", "aes128-gcm@openssh.com"],
        "rsa_key_bits": 2048,
        "simulated_ios_config": """! Cisco IOS Simulated Secure SSH Management Configuration
hostname ROUTER-02
ip domain-name emergency.mesh.internal
ip ssh version 2
access-list 99 permit 192.168.10.0 0.0.0.255
access-list 99 permit 192.168.70.0 0.0.0.255
access-list 99 deny any log
line vty 0 4
  access-class 99 in
  transport input ssh
  login local
""",
    },
    "ROUTER-03": {
        "device_name": "Core Router 3 (South Hub - Relief Zone)",
        "device_type": "Cisco 2911 ISR",
        "ip_address": "10.0.0.3",
        "management_vlan": 10,
        "allowed_management_subnets": ["192.168.10.0/24", "192.168.70.0/24"],
        "ciphers": ["chacha20-poly1305@openssh.com"],
        "rsa_key_bits": 2048,
        "simulated_ios_config": """! Cisco IOS Simulated Secure SSH Management Configuration
hostname ROUTER-03
ip domain-name emergency.mesh.internal
ip ssh version 2
access-list 99 permit 192.168.10.0 0.0.0.255
access-list 99 permit 192.168.70.0 0.0.0.255
access-list 99 deny any log
line vty 0 4
  access-class 99 in
  transport input ssh
  login local
""",
    },
    "ROUTER-04": {
        "device_name": "Core Router 4 (West Hub)",
        "device_type": "Cisco 2911 ISR",
        "ip_address": "10.0.0.4",
        "management_vlan": 10,
        "allowed_management_subnets": ["192.168.10.0/24", "192.168.70.0/24"],
        "ciphers": ["aes256-gcm@openssh.com"],
        "rsa_key_bits": 2048,
        "simulated_ios_config": """! Cisco IOS Simulated Secure SSH Management Configuration
hostname ROUTER-04
ip domain-name emergency.mesh.internal
ip ssh version 2
access-list 99 permit 192.168.10.0 0.0.0.255
access-list 99 permit 192.168.70.0 0.0.0.255
access-list 99 deny any log
line vty 0 4
  access-class 99 in
  transport input ssh
  login local
""",
    },
}

VALID_ADMIN_USERS = ["admin_ecc", "netops_lead"]


def get_all_ssh_device_configs() -> List[SSHDeviceConfig]:
    """Retrieve simulated SSH management configurations for network devices."""
    results = []
    for dev_id, d in SSH_DEVICES.items():
        results.append(
            SSHDeviceConfig(
                device_id=dev_id,
                device_name=d["device_name"],
                device_type=d["device_type"],
                ip_address=d["ip_address"],
                management_vlan=d["management_vlan"],
                allowed_management_subnets=d["allowed_management_subnets"],
                ssh_version="SSHv2",
                ciphers=d["ciphers"],
                rsa_key_bits=d["rsa_key_bits"],
                simulated_ios_config=d["simulated_ios_config"],
            )
        )
    return results


def simulate_ssh_connection(
    db: Session, request: SSHSimulationRequest
) -> SSHSimulationResponse:
    """
    Simulates remote SSH management connection attempt.
    Verifies management ACL 99 subnet restrictions and admin authentication.
    Records unauthorized access attempts as security events and alerts.
    """
    dev_id = request.target_device_id.strip().upper()
    if dev_id not in SSH_DEVICES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target device '{request.target_device_id}' not found in SSH management directory",
        )

    device = SSH_DEVICES[dev_id]

    # 1. Check IP address syntax
    try:
        src_ip_obj = ipaddress.ip_address(request.source_ip.strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source IPv4 address format: '{request.source_ip}'",
        )

    # 2. Check Management Subnet ACL (Access-Class 99)
    is_subnet_authorized = False
    for subnet_str in device["allowed_management_subnets"]:
        net = ipaddress.ip_network(subnet_str, strict=False)
        if src_ip_obj in net:
            is_subnet_authorized = True
            break

    # If source IP is outside management network: Connection Refused by access-class
    if not is_subnet_authorized:
        event_id = f"EVT-SSH-{uuid.uuid4().hex[:8]}"
        alert_id = f"ALT-SSH-{uuid.uuid4().hex[:8]}"
        msg = (
            f"Unauthorized SSH attempt to {dev_id} ({device['ip_address']}) from {request.source_ip}. "
            f"Access blocked by VTY access-class 99: Source IP is outside authorized management subnets."
        )

        db.add(
            NetworkEvent(
                event_id=event_id,
                timestamp=datetime.utcnow(),
                event_type="SECURITY_VIOLATION",
                severity="HIGH",
                message=msg,
                affected_resource=f"{dev_id}:VTY_SSH",
                related_run="SSH-MANAGEMENT-AUDIT",
            )
        )
        db.add(
            Alert(
                alert_id=alert_id,
                severity="HIGH",
                category="SECURITY",
                title=f"Unauthorized SSH Management Attempt: {dev_id}",
                description=msg,
                status="ACTIVE",
                timestamp=datetime.utcnow(),
            )
        )
        db.commit()

        return SSHSimulationResponse(
            authenticated=False,
            target_device=dev_id,
            source_ip=request.source_ip,
            source_subnet_authorized=False,
            explanation=(
                f"Connection Refused: Source IP '{request.source_ip}' is outside authorized management "
                f"subnets ({', '.join(device['allowed_management_subnets'])}). "
                f"Blocked by Cisco IOS 'access-class 99 in' on line vty 0 4."
            ),
            security_event_logged=True,
            disclaimer=SSH_DISCLAIMER,
        )

    # 3. Check Username and Authentication Method
    user_clean = request.username.strip().lower()
    if user_clean not in VALID_ADMIN_USERS:
        event_id = f"EVT-SSH-{uuid.uuid4().hex[:8]}"
        alert_id = f"ALT-SSH-{uuid.uuid4().hex[:8]}"
        msg = f"Failed SSH login on {dev_id} from management IP {request.source_ip}: Invalid user '{request.username}'."

        db.add(
            NetworkEvent(
                event_id=event_id,
                timestamp=datetime.utcnow(),
                event_type="SECURITY_VIOLATION",
                severity="MEDIUM",
                message=msg,
                affected_resource=f"{dev_id}:VTY_SSH",
                related_run="SSH-MANAGEMENT-AUDIT",
            )
        )
        db.add(
            Alert(
                alert_id=alert_id,
                severity="MEDIUM",
                category="SECURITY",
                title=f"Failed SSH Login: {dev_id}",
                description=msg,
                status="ACTIVE",
                timestamp=datetime.utcnow(),
            )
        )
        db.commit()

        return SSHSimulationResponse(
            authenticated=False,
            target_device=dev_id,
            source_ip=request.source_ip,
            source_subnet_authorized=True,
            explanation=f"Authentication Denied: User '{request.username}' is not a recognized administrator on {dev_id}.",
            security_event_logged=True,
            disclaimer=SSH_DISCLAIMER,
        )

    # 4. Successful Authorized Connection
    session_id = f"SSH-SESS-{uuid.uuid4().hex[:6].upper()}"
    selected_cipher = device["ciphers"][0]

    device_summary = {
        "hostname": dev_id,
        "os_version": "Cisco IOS Software (C2900-UNIVERSALK9-M), Version 15.7(3)M2",
        "uptime": "14 days, 6 hours, 22 minutes",
        "router_id": device["ip_address"],
        "ospf_process_id": 1,
        "active_interfaces": ["GigabitEthernet0/0", "GigabitEthernet0/1", "Loopback0"],
        "secure_management_mode": "SSHv2 / FIPS 140-2 Mode Enforced",
    }

    return SSHSimulationResponse(
        authenticated=True,
        target_device=dev_id,
        source_ip=request.source_ip,
        source_subnet_authorized=True,
        session_id=session_id,
        cipher_suite=selected_cipher,
        terminal_prompt=f"{dev_id}# ",
        device_summary=device_summary,
        explanation=(
            f"Authorized SSHv2 Handshake Successful: Source IP {request.source_ip} verified in management "
            f"ACL 99. Asymmetric key authentication verified for '{request.username}'. "
            f"Session encrypted via {selected_cipher}."
        ),
        security_event_logged=False,
        disclaimer=SSH_DISCLAIMER,
    )

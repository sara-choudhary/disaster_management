import ipaddress
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import HTTPException, status

from app.schemas.security_demos import (
    DHCPSubnetConfig,
    DHCPLease,
    DHCPLeaseRequest,
    DHCPLeaseResponse,
)

DEPT_DHCP_DEFINITIONS: Dict[str, Dict] = {
    "ECC": {
        "name": "Emergency Control Center",
        "vlan_id": 10,
        "subnet": "192.168.10.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.10.1",
        "dns": ["192.168.10.1", "1.1.1.1"],
        "pool_start": "192.168.10.50",
        "pool_end": "192.168.10.56",  # 7 IPs for fast exhaustion demonstration
        "initial_leases": [
            {
                "ip_address": "192.168.10.50",
                "mac_address": "02:00:c0:a8:0a:32",
                "hostname": "ECC-CAD-SERVER",
                "is_static": True,
            }
        ],
    },
    "POLICE": {
        "name": "Police Station",
        "vlan_id": 20,
        "subnet": "192.168.20.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.20.1",
        "dns": ["192.168.20.1", "1.1.1.1"],
        "pool_start": "192.168.20.50",
        "pool_end": "192.168.20.56",
        "initial_leases": [
            {
                "ip_address": "192.168.20.50",
                "mac_address": "02:00:c0:a8:14:32",
                "hostname": "POLICE-CRUISER-01",
                "is_static": False,
            }
        ],
    },
    "FIRE": {
        "name": "Fire Department",
        "vlan_id": 30,
        "subnet": "192.168.30.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.30.1",
        "dns": ["192.168.30.1", "1.1.1.1"],
        "pool_start": "192.168.30.50",
        "pool_end": "192.168.30.56",
        "initial_leases": [],
    },
    "HOSPITAL": {
        "name": "Hospital",
        "vlan_id": 40,
        "subnet": "192.168.40.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.40.1",
        "dns": ["192.168.40.1", "1.1.1.1"],
        "pool_start": "192.168.40.50",
        "pool_end": "192.168.40.55",  # 6 IPs
        "initial_leases": [
            {
                "ip_address": "192.168.40.50",
                "mac_address": "00:1A:2B:3C:4D:5E",
                "hostname": "HOSP-EHR-TERM-01",
                "is_static": True,
            }
        ],
    },
    "AMBULANCE": {
        "name": "Ambulance Services",
        "vlan_id": 50,
        "subnet": "192.168.50.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.50.1",
        "dns": ["192.168.50.1", "1.1.1.1"],
        "pool_start": "192.168.50.50",
        "pool_end": "192.168.50.56",
        "initial_leases": [
            {
                "ip_address": "192.168.50.50",
                "mac_address": "02:00:c0:a8:32:01",
                "hostname": "MEDIC-UNIT-07",
                "is_static": False,
            }
        ],
    },
    "RELIEF": {
        "name": "Relief Camp",
        "vlan_id": 60,
        "subnet": "192.168.60.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.60.1",
        "dns": ["192.168.60.1", "1.1.1.1"],
        "pool_start": "192.168.60.50",
        "pool_end": "192.168.60.56",
        "initial_leases": [],
    },
    "BACKUP_CC": {
        "name": "Backup Control Center",
        "vlan_id": 70,
        "subnet": "192.168.70.0/24",
        "mask": "255.255.255.0",
        "gateway": "192.168.70.1",
        "dns": ["192.168.70.1", "1.1.1.1"],
        "pool_start": "192.168.70.50",
        "pool_end": "192.168.70.56",
        "initial_leases": [],
    },
}

# Runtime in-memory store for active DHCP leases
_RUNTIME_LEASES: Dict[str, List[DHCPLease]] = {}


def _init_leases_if_needed():
    if not _RUNTIME_LEASES:
        now = datetime.utcnow()
        for code, defn in DEPT_DHCP_DEFINITIONS.items():
            lease_objs: List[DHCPLease] = []
            for init_l in defn["initial_leases"]:
                lease_objs.append(
                    DHCPLease(
                        ip_address=init_l["ip_address"],
                        mac_address=init_l["mac_address"],
                        hostname=init_l["hostname"],
                        leased_at=now.isoformat(),
                        expires_at=(now + timedelta(hours=24)).isoformat(),
                        is_static=init_l.get("is_static", False),
                    )
                )
            _RUNTIME_LEASES[code] = lease_objs


def _get_ip_range(start_ip: str, end_ip: str) -> List[str]:
    start = int(ipaddress.IPv4Address(start_ip))
    end = int(ipaddress.IPv4Address(end_ip))
    return [str(ipaddress.IPv4Address(ip)) for ip in range(start, end + 1)]


def get_all_dhcp_configs() -> List[DHCPSubnetConfig]:
    """Retrieve all departmental DHCP pool configurations and active lease states."""
    _init_leases_if_needed()
    results = []
    for code, defn in DEPT_DHCP_DEFINITIONS.items():
        all_pool_ips = _get_ip_range(defn["pool_start"], defn["pool_end"])
        leases = _RUNTIME_LEASES.get(code, [])
        active_ips = {l.ip_address for l in leases}
        available_count = max(0, len(all_pool_ips) - len(active_ips))
        utilization = round((len(active_ips) / len(all_pool_ips)) * 100.0, 1) if all_pool_ips else 0.0

        results.append(
            DHCPSubnetConfig(
                department_code=code,
                department_name=defn["name"],
                vlan_id=defn["vlan_id"],
                subnet=defn["subnet"],
                subnet_mask=defn["mask"],
                gateway=defn["gateway"],
                dns_servers=defn["dns"],
                pool_start_ip=defn["pool_start"],
                pool_end_ip=defn["pool_end"],
                total_pool_addresses=len(all_pool_ips),
                active_leases_count=len(active_ips),
                available_addresses_count=available_count,
                utilization_pct=utilization,
                leases=leases,
            )
        )
    return results


def get_dhcp_config_by_dept(department_code: str) -> DHCPSubnetConfig:
    """Retrieve DHCP configuration for a specific department."""
    code = department_code.strip().upper()
    all_configs = get_all_dhcp_configs()
    for cfg in all_configs:
        if cfg.department_code == code or cfg.department_name.lower() == department_code.strip().lower():
            return cfg
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Department code '{department_code}' not found in DHCP service",
    )


def allocate_dhcp_lease(request: DHCPLeaseRequest) -> DHCPLeaseResponse:
    """
    Simulates DHCP DORA process (Discover, Offer, Request, Acknowledge).
    Validates subnet inclusion and handles pool exhaustion.
    """
    _init_leases_if_needed()
    dept_code = request.department_code.strip().upper()
    if dept_code not in DEPT_DHCP_DEFINITIONS:
        # Check by name
        found_code = None
        for c, d in DEPT_DHCP_DEFINITIONS.items():
            if d["name"].lower() == request.department_code.strip().lower():
                found_code = c
                break
        if not found_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department '{request.department_code}' not found in DHCP definitions",
            )
        dept_code = found_code

    defn = DEPT_DHCP_DEFINITIONS[dept_code]
    pool_ips = _get_ip_range(defn["pool_start"], defn["pool_end"])
    current_leases = _RUNTIME_LEASES.get(dept_code, [])
    leased_ips = {l.ip_address for l in current_leases}

    # Generate client details if omitted
    mac = request.mac_address or f"02:00:c0:a8:{defn['vlan_id']:02x}:{random.randint(10, 99):02x}"
    hostname = request.hostname or f"{dept_code}-CLIENT-{random.randint(100, 999)}"

    # Check for available IP
    assigned_ip: Optional[str] = None
    for candidate_ip in pool_ips:
        if candidate_ip not in leased_ips:
            assigned_ip = candidate_ip
            break

    # If pool is exhausted
    if not assigned_ip:
        return DHCPLeaseResponse(
            success=False,
            assigned_ip=None,
            subnet=defn["subnet"],
            subnet_mask=defn["mask"],
            gateway=defn["gateway"],
            dns_servers=defn["dns"],
            mac_address=mac,
            hostname=hostname,
            lease_time_sec=86400,
            subnet_validation="N/A - Allocation Failed",
            message=f"DHCP Pool Exhausted: All {len(pool_ips)} addresses in {defn['pool_start']} - {defn['pool_end']} for {defn['name']} (VLAN {defn['vlan_id']}) are active.",
            pool_exhausted=True,
        )

    # Validate that assigned IP belongs to the correct departmental subnet
    net = ipaddress.ip_network(defn["subnet"], strict=False)
    ip_obj = ipaddress.ip_address(assigned_ip)
    if ip_obj not in net:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subnet integrity error: Allocated IP {assigned_ip} is outside department subnet {defn['subnet']}",
        )

    now = datetime.utcnow()
    new_lease = DHCPLease(
        ip_address=assigned_ip,
        mac_address=mac,
        hostname=hostname,
        leased_at=now.isoformat(),
        expires_at=(now + timedelta(hours=24)).isoformat(),
        is_static=False,
    )
    _RUNTIME_LEASES[dept_code].append(new_lease)

    return DHCPLeaseResponse(
        success=True,
        assigned_ip=assigned_ip,
        subnet=defn["subnet"],
        subnet_mask=defn["mask"],
        gateway=defn["gateway"],
        dns_servers=defn["dns"],
        mac_address=mac,
        hostname=hostname,
        lease_time_sec=86400,
        subnet_validation=f"VALIDATED: {assigned_ip} belongs to {defn['subnet']} (Netmask: {defn['mask']}, Gateway: {defn['gateway']})",
        message=f"DHCP ACK: Successfully leased {assigned_ip} to {hostname} ({mac}) on VLAN {defn['vlan_id']}",
        pool_exhausted=False,
    )


def release_dhcp_lease(department_code: str, ip_address: str) -> bool:
    """Release an active DHCP lease."""
    _init_leases_if_needed()
    dept_code = department_code.strip().upper()
    if dept_code not in _RUNTIME_LEASES:
        return False
    before_len = len(_RUNTIME_LEASES[dept_code])
    _RUNTIME_LEASES[dept_code] = [l for l in _RUNTIME_LEASES[dept_code] if l.ip_address != ip_address.strip()]
    return len(_RUNTIME_LEASES[dept_code]) < before_len


def reset_dhcp_pool(department_code: Optional[str] = None):
    """Reset departmental DHCP pool back to initial seed state."""
    _init_leases_if_needed()
    if department_code:
        code = department_code.strip().upper()
        if code in DEPT_DHCP_DEFINITIONS:
            now = datetime.utcnow()
            lease_objs = [
                DHCPLease(
                    ip_address=l["ip_address"],
                    mac_address=l["mac_address"],
                    hostname=l["hostname"],
                    leased_at=now.isoformat(),
                    expires_at=(now + timedelta(hours=24)).isoformat(),
                    is_static=l.get("is_static", False),
                )
                for l in DEPT_DHCP_DEFINITIONS[code]["initial_leases"]
            ]
            _RUNTIME_LEASES[code] = lease_objs
    else:
        _RUNTIME_LEASES.clear()
        _init_leases_if_needed()

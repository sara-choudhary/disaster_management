import random
from datetime import datetime
from typing import List, Dict, Optional, Any
from fastapi import HTTPException, status

from app.schemas.security_demos import (
    NATTranslationEntry,
    NATSimulationRequest,
    NATSimulationResponse,
)

NAT_DISCLAIMER = (
    "EDUCATIONAL SIMULATION NOTICE: This is a software demonstration of Cisco NAT/PAT (Port Address Translation / "
    "NAT Overload) on an external WAN perimeter router. It illustrates private-to-public header rewriting. "
    "Internal communication between emergency departments routes directly via OSPF without NAT."
)

EXTERNAL_SERVICES: Dict[str, Dict[str, Any]] = {
    "NDMA_CLOUD": {
        "name": "National Disaster Management Authority (NDMA) Cloud",
        "ip": "198.51.100.50",
        "port": 443,
        "protocol": "TCP (HTTPS)",
        "description": "Central National Disaster Reporting & Coordination Cloud Portal",
    },
    "WEATHER_SAT": {
        "name": "Geostationary Weather Satellite Downlink API",
        "ip": "198.51.100.88",
        "port": 8080,
        "protocol": "TCP (HTTP/REST)",
        "description": "Live Radar Imagery, Flood Modeling, and Hurricane Telemetry",
    },
    "CENTRAL_SUPPLY": {
        "name": "National Emergency Medical & Blood Supply Registry",
        "ip": "198.51.100.120",
        "port": 443,
        "protocol": "TCP (HTTPS)",
        "description": "National Inter-Hospital Pharmaceutical & Plasma Inventory Dispatch",
    },
}

PUBLIC_WAN_GATEWAY = "203.0.113.1"

# In-memory NAT translation table
_NAT_TABLE: List[NATTranslationEntry] = [
    NATTranslationEntry(
        id=1,
        protocol="TCP",
        inside_local_ip="192.168.10.10",
        inside_local_port=49210,
        inside_global_ip=PUBLIC_WAN_GATEWAY,
        inside_global_port=10210,
        outside_local_ip="198.51.100.50",
        outside_local_port=443,
        outside_global_ip="198.51.100.50",
        outside_global_port=443,
        description="ECC Incident Command -> NDMA National Cloud",
        created_at=datetime.utcnow().isoformat(),
    ),
    NATTranslationEntry(
        id=2,
        protocol="TCP",
        inside_local_ip="192.168.40.10",
        inside_local_port=51442,
        inside_global_ip=PUBLIC_WAN_GATEWAY,
        inside_global_port=40442,
        outside_local_ip="198.51.100.120",
        outside_local_port=443,
        outside_global_ip="198.51.100.120",
        outside_global_port=443,
        description="Hospital EHR -> National Medical Supply Registry",
        created_at=datetime.utcnow().isoformat(),
    ),
]


def get_nat_translation_table() -> List[NATTranslationEntry]:
    """Retrieve all active NAT/PAT translation entries."""
    return list(_NAT_TABLE)


def simulate_nat_flow(request: NATSimulationRequest) -> NATSimulationResponse:
    """
    Simulates private-to-public NAT translation on WAN edge.
    Clearly demonstrates that NAT is applied exclusively for outbound WAN traffic,
    while internal departmental communication routes directly via OSPF without NAT.
    """
    svc_key = request.external_destination_service.strip().upper()
    if svc_key not in EXTERNAL_SERVICES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"External service '{request.external_destination_service}' not found. Available: {list(EXTERNAL_SERVICES.keys())}",
        )

    service = EXTERNAL_SERVICES[svc_key]

    # Department default endpoint IP mapping
    dept_defaults = {
        "Emergency Control Center": "192.168.10.10",
        "Police Station": "192.168.20.10",
        "Fire Department": "192.168.30.10",
        "Hospital": "192.168.40.10",
        "Ambulance Services": "192.168.50.10",
        "Relief Camp": "192.168.60.10",
        "Backup Control Center": "192.168.70.10",
    }
    src_ip = request.source_local_ip or dept_defaults.get(request.source_department, "192.168.10.10")
    src_port = request.source_local_port or random.randint(49152, 65535)
    global_port = random.randint(10000, 30000)

    # Create new translation entry
    entry_id = len(_NAT_TABLE) + 1
    new_entry = NATTranslationEntry(
        id=entry_id,
        protocol="TCP",
        inside_local_ip=src_ip,
        inside_local_port=src_port,
        inside_global_ip=PUBLIC_WAN_GATEWAY,
        inside_global_port=global_port,
        outside_local_ip=service["ip"],
        outside_local_port=service["port"],
        outside_global_ip=service["ip"],
        outside_global_port=service["port"],
        description=f"{request.source_department} -> {service['name']}",
        created_at=datetime.utcnow().isoformat(),
    )
    _NAT_TABLE.append(new_entry)

    rewrite_summary = (
        f"OUTBOUND PACKET REWRITE: [Source: {src_ip}:{src_port}] ➔ [Rewritten Source: {PUBLIC_WAN_GATEWAY}:{global_port}]. "
        f"INBOUND RETURN PACKET: [Destination: {PUBLIC_WAN_GATEWAY}:{global_port}] ➔ [De-NAT Destination: {src_ip}:{src_port}]."
    )

    internal_notice = (
        "INTERNAL ROUTING DISTINCTION: NAT is NOT required for internal communication between departments. "
        "Intra-mesh flows (e.g., Hospital to Ambulance or Police to Fire) use private RFC 1918 subnets and route "
        "directly via OSPF shortest-path without address translation."
    )

    return NATSimulationResponse(
        translation_success=True,
        source_department=request.source_department,
        flow_type="OUTBOUND_WAN",
        nat_applied=True,
        inside_local=f"{src_ip}:{src_port}",
        inside_global=f"{PUBLIC_WAN_GATEWAY}:{global_port}",
        outside_global=f"{service['ip']}:{service['port']}",
        service_name=service["name"],
        header_rewrite_summary=rewrite_summary,
        internal_routing_notice=internal_notice,
        translation_entry=new_entry,
        disclaimer=NAT_DISCLAIMER,
    )

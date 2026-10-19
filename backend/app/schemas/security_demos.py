from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ---------------- DHCP Schemas ----------------

class DHCPLease(BaseModel):
    ip_address: str
    mac_address: str
    hostname: str
    leased_at: str
    expires_at: str
    is_static: bool = False


class DHCPSubnetConfig(BaseModel):
    department_code: str
    department_name: str
    vlan_id: int
    subnet: str
    subnet_mask: str
    gateway: str
    dns_servers: List[str]
    pool_start_ip: str
    pool_end_ip: str
    total_pool_addresses: int
    active_leases_count: int
    available_addresses_count: int
    utilization_pct: float
    leases: List[DHCPLease]


class DHCPLeaseRequest(BaseModel):
    department_code: str
    hostname: Optional[str] = None
    mac_address: Optional[str] = None


class DHCPLeaseResponse(BaseModel):
    success: bool
    assigned_ip: Optional[str] = None
    subnet: str
    subnet_mask: str
    gateway: str
    dns_servers: List[str]
    mac_address: str
    hostname: str
    lease_time_sec: int
    subnet_validation: str
    message: str
    pool_exhausted: bool = False


# ---------------- SSH Management Schemas ----------------

class SSHDeviceConfig(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    ip_address: str
    management_vlan: int
    allowed_management_subnets: List[str]
    ssh_version: str = "SSHv2"
    ciphers: List[str]
    rsa_key_bits: int = 2048
    simulated_ios_config: str


class SSHSimulationRequest(BaseModel):
    target_device_id: str = Field(..., example="ROUTER-01")
    source_ip: str = Field(..., example="192.168.10.15")
    username: str = Field(..., example="admin_ecc")
    auth_method: str = Field(default="SSH_KEY", example="SSH_KEY")  # SSH_KEY or PASSWORD
    password: Optional[str] = None


class SSHSimulationResponse(BaseModel):
    authenticated: bool
    target_device: str
    source_ip: str
    source_subnet_authorized: bool
    session_id: Optional[str] = None
    cipher_suite: Optional[str] = None
    terminal_prompt: Optional[str] = None
    device_summary: Optional[Dict[str, Any]] = None
    explanation: str
    security_event_logged: bool = False
    disclaimer: str


# ---------------- Port Security Schemas ----------------

class PortSecurityConfig(BaseModel):
    port_id: str
    switch_id: str
    department: str
    vlan_id: int
    allowed_mac: str
    max_mac_count: int = 1
    violation_action: str = "SHUTDOWN"  # SHUTDOWN, RESTRICT, PROTECT
    operational_status: str = "SECURE_UP"  # SECURE_UP, ERR_DISABLED, RESTRICTED
    violation_count: int = 0
    last_violation_mac: Optional[str] = None
    last_violation_time: Optional[str] = None


class PortSecurityTestRequest(BaseModel):
    port_id: str = Field(..., example="SW-HOSPITAL-Fa0/1")
    incoming_mac: str = Field(..., example="00:1A:2B:3C:4D:5E")
    frame_description: Optional[str] = "EHR Patient Admission Broadcast"


class PortSecurityTestResponse(BaseModel):
    port_id: str
    switch_id: str
    incoming_mac: str
    allowed_mac: str
    is_authorized: bool
    violation_action: str
    port_status_before: str
    port_status_after: str
    traffic_forwarded: bool
    violation_count: int
    explanation: str
    security_event_logged: bool = False
    disclaimer: str


# ---------------- NAT Schemas ----------------

class NATTranslationEntry(BaseModel):
    id: int
    protocol: str
    inside_local_ip: str
    inside_local_port: int
    inside_global_ip: str
    inside_global_port: int
    outside_local_ip: str
    outside_local_port: int
    outside_global_ip: str
    outside_global_port: int
    description: str
    created_at: str


class NATSimulationRequest(BaseModel):
    source_department: str = Field(..., example="Hospital")
    source_local_ip: Optional[str] = None
    source_local_port: Optional[int] = None
    external_destination_service: str = Field(default="NDMA_CLOUD", example="NDMA_CLOUD")


class NATSimulationResponse(BaseModel):
    translation_success: bool
    source_department: str
    flow_type: str  # "OUTBOUND_WAN" vs "INTERNAL_LAN"
    nat_applied: bool
    inside_local: str
    inside_global: str
    outside_global: str
    service_name: str
    header_rewrite_summary: str
    internal_routing_notice: str
    translation_entry: Optional[NATTranslationEntry] = None
    disclaimer: str

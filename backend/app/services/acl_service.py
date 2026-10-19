import uuid
import ipaddress
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.department import Department
from app.models.node import NetworkNode, NodeType
from app.models.access_rule import AccessRule
from app.models.event import NetworkEvent
from app.models.alert import Alert
from app.schemas.access_rule import (
    ACLEvaluationRequest,
    ACLEvaluationResponse,
    AccessRuleResponse,
)
from app.services.seed_data import seed_database_idempotent
from app.services.network_service import build_routing_engine


DISCLAIMER_TEXT = (
    "SIMULATION NOTICE: This ACL evaluation demonstrates software-modeled Layer 3/4 firewall policy "
    "and IEEE 802.1Q departmental VLAN segmentation. It is a simulation and does not configure "
    "physical switches, routers, or real-world security hardware."
)

DEPT_ENDPOINT_FALLBACKS: Dict[str, Tuple[str, str]] = {
    "ECC": ("HQ-COMMAND-01", "192.168.10.10"),
    "POLICE": ("POLICE-02", "192.168.20.10"),
    "FIRE": ("FIRE-03", "192.168.30.10"),
    "HOSPITAL": ("HOSPITAL-TRIAGE-03", "192.168.40.10"),
    "AMBULANCE": ("AMBULANCE-05", "192.168.50.10"),
    "RELIEF": ("SHELTER-SOUTH-05", "192.168.60.10"),
    "BACKUP_CC": ("BACKUP-CC-07", "192.168.70.10"),
}


def resolve_department(db: Session, identifier: Optional[str], ip_str: Optional[str] = None) -> Department:
    """
    Resolve a department by code, name, or matching subnet IP address.
    Raises HTTPException(400) if no department can be identified.
    """
    departments = db.query(Department).all()
    if not departments:
        seed_database_idempotent(db)
        departments = db.query(Department).all()

    # 1. Match by identifier (name or code)
    if identifier:
        id_clean = identifier.strip().lower()
        for d in departments:
            if d.code.lower() == id_clean or d.name.lower() == id_clean:
                return d
        # Loose/fuzzy matching
        for d in departments:
            if id_clean in d.name.lower() or id_clean in d.code.lower():
                return d

    # 2. Match by IP address in subnet
    if ip_str:
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
            for d in departments:
                if d.subnet:
                    net = ipaddress.ip_network(d.subnet, strict=False)
                    if ip_obj in net:
                        return d
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid IP address format: '{ip_str}'",
            )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unable to resolve department from identifier '{identifier}' or IP '{ip_str}'",
    )


def get_department_endpoint(db: Session, dept: Department, provided_ip: Optional[str] = None) -> Tuple[str, str]:
    """
    Find endpoint node ID and host IP address for a given department.
    """
    # Look for endpoint or server node belonging to this department
    node = (
        db.query(NetworkNode)
        .filter(
            NetworkNode.department == dept.name,
            NetworkNode.node_type.in_([NodeType.ENDPOINT.value, NodeType.SERVER.value]),
        )
        .first()
    )

    if node:
        endpoint_id = node.node_id
        host_ip = provided_ip or node.ip_address or dept.gateway
    else:
        fallback = DEPT_ENDPOINT_FALLBACKS.get(dept.code, (f"EP-{dept.code}", dept.gateway))
        endpoint_id = fallback[0]
        host_ip = provided_ip or fallback[1]

    if provided_ip:
        # Validate syntax
        try:
            ipaddress.ip_address(provided_ip.strip())
            host_ip = provided_ip.strip()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid IP address format: '{provided_ip}'",
            )

    return endpoint_id, host_ip


def matches_target(target_spec: str, dept: Department, ip_str: str) -> bool:
    """
    Check if a target specification in an AccessRule (source or destination)
    matches the target department or IP.
    """
    spec = target_spec.strip()
    spec_upper = spec.upper()

    if spec_upper in ["ANY", "ALL", "*"]:
        return True

    # Check department code or name
    if spec_upper == dept.code.upper() or spec.lower() == dept.name.lower():
        return True

    # Partial / alias match
    if spec.lower() in dept.name.lower() or spec.lower() in dept.code.lower():
        return True

    # Check CIDR subnet or explicit IP match
    if "." in spec:
        try:
            if "/" in spec:
                net = ipaddress.ip_network(spec, strict=False)
                return ipaddress.ip_address(ip_str) in net
            else:
                return ip_str == spec
        except ValueError:
            pass

    return False


def matches_protocol(rule_proto: str, req_proto: str) -> bool:
    """Check if protocol matches rule protocol."""
    r_proto = rule_proto.strip().upper()
    q_proto = req_proto.strip().upper()

    if r_proto in ["ANY", "ALL", "*"]:
        return True
    return r_proto == q_proto


def evaluate_connection(db: Session, request: ACLEvaluationRequest) -> ACLEvaluationResponse:
    """
    Evaluates an access connection request against configured access control rules
    and checks underlying Layer 3 topological reachability via OSPF SPF simulation.
    Records security violation events and alerts when traffic is denied.
    """
    seed_database_idempotent(db)

    # 1. Resolve source and destination departments
    if not request.source_department and not request.source_ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source department or source IP must be provided",
        )
    if not request.destination_department and not request.destination_ip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination department or destination IP must be provided",
        )

    src_dept = resolve_department(db, request.source_department, request.source_ip)
    dst_dept = resolve_department(db, request.destination_department, request.destination_ip)

    src_node_id, src_ip = get_department_endpoint(db, src_dept, request.source_ip)
    dst_node_id, dst_ip = get_department_endpoint(db, dst_dept, request.destination_ip)

    req_protocol = (request.protocol or "TCP").strip().upper()

    # 2. Layer 3 Topological Reachability Check (OSPF SPF Graph)
    routing_engine = build_routing_engine(db)
    path_result = routing_engine.calculate_shortest_path(src_node_id, dst_node_id)
    path_reachable = path_result.reachable
    path = path_result.selected_path if path_reachable else []

    if path_reachable:
        routing_status = f"Layer 3 path reachable via OSPF ({len(path)} hops, cost: {path_result.total_cost})"
    else:
        routing_status = "Layer 3 destination unreachable in topology graph"

    # 3. Access Control Policy Evaluation (Sequential Rule Matching)
    rules: List[AccessRule] = (
        db.query(AccessRule)
        .order_by(AccessRule.id.asc())
        .all()
    )

    matched_rule: Optional[AccessRule] = None
    action = "DENY"
    permitted = False
    explanation = ""

    for rule in rules:
        if not rule.enabled:
            continue  # Disabled rules are explicitly ignored

        src_matches = matches_target(rule.source, src_dept, src_ip)
        dst_matches = matches_target(rule.destination, dst_dept, dst_ip)
        proto_matches = matches_protocol(rule.protocol, req_protocol)

        if src_matches and dst_matches and proto_matches:
            matched_rule = rule
            action = rule.action.upper()
            permitted = (action == "PERMIT")

            if permitted:
                explanation = (
                    f"Permitted by rule '{rule.rule_id}': Allowed {req_protocol} traffic "
                    f"from {rule.source} (VLAN {src_dept.vlan_id}) to {rule.destination} (VLAN {dst_dept.vlan_id})."
                )
            else:
                explanation = (
                    f"Explicitly denied by rule '{rule.rule_id}': Blocked {req_protocol} traffic "
                    f"from {rule.source} (VLAN {src_dept.vlan_id}) to {rule.destination} (VLAN {dst_dept.vlan_id})."
                )
            break

    # If no rule matched, apply implicit zero-trust default DENY policy
    if matched_rule is None:
        action = "DENY"
        permitted = False
        explanation = (
            f"Blocked by implicit zero-trust default DENY policy: No matching access rule allows "
            f"{req_protocol} from {src_dept.name} (VLAN {src_dept.vlan_id}) to {dst_dept.name} (VLAN {dst_dept.vlan_id})."
        )

    # 4. Security Audit Logging on Denied Attempts
    security_event_logged = False
    if not permitted:
        event_id = f"EVT-SEC-{uuid.uuid4().hex[:8]}"
        alert_id = f"ALT-SEC-{uuid.uuid4().hex[:8]}"

        # Record security event
        event_msg = (
            f"Access Denied: [{req_protocol}] flow from {src_dept.name} ({src_ip}, VLAN {src_dept.vlan_id}) "
            f"to {dst_dept.name} ({dst_ip}, VLAN {dst_dept.vlan_id}) was dropped. Reason: {explanation}"
        )
        sec_event = NetworkEvent(
            event_id=event_id,
            timestamp=datetime.utcnow(),
            event_type="SECURITY_VIOLATION",
            severity="CRITICAL" if dst_dept.priority == 1 else "HIGH",
            message=event_msg,
            affected_resource=f"{src_dept.code} -> {dst_dept.code}",
            related_run=f"VLAN-{src_dept.vlan_id}-TO-{dst_dept.vlan_id}",
        )
        db.add(sec_event)

        # Record persistent alert
        sec_alert = Alert(
            alert_id=alert_id,
            severity="HIGH",
            category="SECURITY",
            title=f"Unauthorized Connection Dropped: {src_dept.code} to {dst_dept.code}",
            description=event_msg,
            status="ACTIVE",
            affected_resource=f"{src_dept.code} ➔ {dst_dept.code}",
            related_run=f"VLAN-{src_dept.vlan_id}-TO-{dst_dept.vlan_id}",
            timestamp=datetime.utcnow(),
        )
        db.add(sec_alert)
        db.commit()
        security_event_logged = True

    matched_rule_resp = AccessRuleResponse.model_validate(matched_rule) if matched_rule else None

    return ACLEvaluationResponse(
        permitted=permitted,
        action=action,
        matched_rule_id=matched_rule.rule_id if matched_rule else None,
        matched_rule=matched_rule_resp,
        explanation=explanation,
        source_department=src_dept.name,
        destination_department=dst_dept.name,
        source_vlan_id=src_dept.vlan_id,
        destination_vlan_id=dst_dept.vlan_id,
        source_ip=src_ip,
        destination_ip=dst_ip,
        protocol=req_protocol,
        path_reachable=path_reachable,
        path=path,
        routing_status=routing_status,
        security_event_logged=security_event_logged,
        disclaimer=DISCLAIMER_TEXT,
    )

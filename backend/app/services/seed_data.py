from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.traffic_class import TrafficClass
from app.models.node import NetworkNode, NodeStatus, NodeType
from app.models.link import NetworkLink
from app.models.scenario import Scenario
from app.models.access_rule import AccessRule
from app.models.alert import Alert


DEFAULT_DEPARTMENTS = [
    {
        "code": "ECC",
        "name": "Emergency Control Center",
        "department_type": "command",
        "subnet": "192.168.10.0/24",
        "gateway": "192.168.10.1",
        "vlan_id": 10,
        "priority": 1,
    },
    {
        "code": "POLICE",
        "name": "Police Station",
        "department_type": "public_safety",
        "subnet": "192.168.20.0/24",
        "gateway": "192.168.20.1",
        "vlan_id": 20,
        "priority": 2,
    },
    {
        "code": "FIRE",
        "name": "Fire Department",
        "department_type": "public_safety",
        "subnet": "192.168.30.0/24",
        "gateway": "192.168.30.1",
        "vlan_id": 30,
        "priority": 2,
    },
    {
        "code": "HOSPITAL",
        "name": "Hospital",
        "department_type": "medical",
        "subnet": "192.168.40.0/24",
        "gateway": "192.168.40.1",
        "vlan_id": 40,
        "priority": 1,
    },
    {
        "code": "AMBULANCE",
        "name": "Ambulance Services",
        "department_type": "medical",
        "subnet": "192.168.50.0/24",
        "gateway": "192.168.50.1",
        "vlan_id": 50,
        "priority": 1,
    },
    {
        "code": "RELIEF",
        "name": "Relief Camp",
        "department_type": "humanitarian",
        "subnet": "192.168.60.0/24",
        "gateway": "192.168.60.1",
        "vlan_id": 60,
        "priority": 3,
    },
    {
        "code": "BACKUP_CC",
        "name": "Backup Control Center",
        "department_type": "command",
        "subnet": "192.168.70.0/24",
        "gateway": "192.168.70.1",
        "vlan_id": 70,
        "priority": 1,
    },
]

DEFAULT_TRAFFIC_CLASSES = [
    {
        "code": "CRITICAL",
        "name": "Ambulance Dispatch and Hospital Coordination",
        "priority": 1,
        "bandwidth_req": 2.0,
        "latency_budget": 20.0,
    },
    {
        "code": "HIGH",
        "name": "Police and Fire Communication",
        "priority": 2,
        "bandwidth_req": 5.0,
        "latency_budget": 45.0,
    },
    {
        "code": "NORMAL",
        "name": "Ordinary Departmental Communication",
        "priority": 3,
        "bandwidth_req": 15.0,
        "latency_budget": 100.0,
    },
    {
        "code": "LOW",
        "name": "Administrative or Background Traffic",
        "priority": 4,
        "bandwidth_req": 30.0,
        "latency_budget": 250.0,
    },
    {
        "code": "CRITICAL_SOS",
        "name": "Life-Safety Emergency Broadcast",
        "priority": 1,
        "bandwidth_req": 0.5,
        "latency_budget": 25.0,
    },
    {
        "code": "HIGH_MEDICAL",
        "name": "Telemedicine & Urgent Triage",
        "priority": 2,
        "bandwidth_req": 2.0,
        "latency_budget": 50.0,
    },
    {
        "code": "NORMAL_LOGISTICS",
        "name": "Relief Logistics & Supplies",
        "priority": 3,
        "bandwidth_req": 10.0,
        "latency_budget": 150.0,
    },
    {
        "code": "LOW_ROUTINE",
        "name": "Routine Status & Telemetry",
        "priority": 4,
        "bandwidth_req": 1.0,
        "latency_budget": 300.0,
    },
]

DEFAULT_NODES = [
    # ---------------- 4 Core Routers (Redundant Ring + Cross Paths) ----------------
    {
        "device_id": "ROUTER-01",
        "node_id": "ROUTER-01",
        "name": "Core Router 1 (North)",
        "node_type": NodeType.ROUTER.value,
        "department": "Core Network",
        "ip_address": "10.0.0.1",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 420.0,
        "pos_y": 180.0,
        "extra_metadata": {
            "role": "Core Backbone Router",
            "loopback": "10.0.0.1/32",
            "zone": "North",
            "interfaces": ["10.0.12.1/30", "10.0.41.2/30", "10.0.13.1/30", "192.168.10.1/24", "192.168.20.1/24"],
        },
    },
    {
        "device_id": "ROUTER-02",
        "node_id": "ROUTER-02",
        "name": "Core Router 2 (East)",
        "node_type": NodeType.ROUTER.value,
        "department": "Core Network",
        "ip_address": "10.0.0.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 680.0,
        "pos_y": 180.0,
        "extra_metadata": {
            "role": "Core Backbone Router",
            "loopback": "10.0.0.2/32",
            "zone": "East",
            "interfaces": ["10.0.12.2/30", "10.0.23.1/30", "10.0.24.1/30", "192.168.40.1/24", "192.168.50.1/24"],
        },
    },
    {
        "device_id": "ROUTER-03",
        "node_id": "ROUTER-03",
        "name": "Core Router 3 (South)",
        "node_type": NodeType.ROUTER.value,
        "department": "Core Network",
        "ip_address": "10.0.0.3",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 680.0,
        "pos_y": 420.0,
        "extra_metadata": {
            "role": "Core Backbone Router",
            "loopback": "10.0.0.3/32",
            "zone": "South",
            "interfaces": ["10.0.23.2/30", "10.0.34.1/30", "10.0.13.2/30", "192.168.60.1/24"],
        },
    },
    {
        "device_id": "ROUTER-04",
        "node_id": "ROUTER-04",
        "name": "Core Router 4 (West)",
        "node_type": NodeType.ROUTER.value,
        "department": "Core Network",
        "ip_address": "10.0.0.4",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 420.0,
        "pos_y": 420.0,
        "extra_metadata": {
            "role": "Core Backbone Router",
            "loopback": "10.0.0.4/32",
            "zone": "West",
            "interfaces": ["10.0.34.2/30", "10.0.41.1/30", "10.0.24.2/30", "192.168.30.1/24", "192.168.70.1/24"],
        },
    },

    # ---------------- 7 Departmental Switches ----------------
    {
        "device_id": "SW-ECC",
        "node_id": "SW-ECC",
        "name": "ECC Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Emergency Control Center",
        "ip_address": "192.168.10.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 98.0,
        "pos_x": 240.0,
        "pos_y": 100.0,
        "extra_metadata": {"subnet": "192.168.10.0/24", "gateway": "192.168.10.1", "vlan": 10},
    },
    {
        "device_id": "SW-POLICE",
        "node_id": "SW-POLICE",
        "name": "Police Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Police Station",
        "ip_address": "192.168.20.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 96.0,
        "pos_x": 420.0,
        "pos_y": 40.0,
        "extra_metadata": {"subnet": "192.168.20.0/24", "gateway": "192.168.20.1", "vlan": 20},
    },
    {
        "device_id": "SW-FIRE",
        "node_id": "SW-FIRE",
        "name": "Fire Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Fire Department",
        "ip_address": "192.168.30.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 95.0,
        "pos_x": 240.0,
        "pos_y": 340.0,
        "extra_metadata": {"subnet": "192.168.30.0/24", "gateway": "192.168.30.1", "vlan": 30},
    },
    {
        "device_id": "SW-HOSPITAL",
        "node_id": "SW-HOSPITAL",
        "name": "Hospital Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Hospital",
        "ip_address": "192.168.40.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 99.0,
        "pos_x": 860.0,
        "pos_y": 100.0,
        "extra_metadata": {"subnet": "192.168.40.0/24", "gateway": "192.168.40.1", "vlan": 40},
    },
    {
        "device_id": "SW-AMBULANCE",
        "node_id": "SW-AMBULANCE",
        "name": "Ambulance Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Ambulance Services",
        "ip_address": "192.168.50.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 93.0,
        "pos_x": 860.0,
        "pos_y": 260.0,
        "extra_metadata": {"subnet": "192.168.50.0/24", "gateway": "192.168.50.1", "vlan": 50},
    },
    {
        "device_id": "SW-RELIEF",
        "node_id": "SW-RELIEF",
        "name": "Relief Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Relief Camp",
        "ip_address": "192.168.60.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 90.0,
        "pos_x": 860.0,
        "pos_y": 480.0,
        "extra_metadata": {"subnet": "192.168.60.0/24", "gateway": "192.168.60.1", "vlan": 60},
    },
    {
        "device_id": "SW-BACKUP",
        "node_id": "SW-BACKUP",
        "name": "Backup CC Switch",
        "node_type": NodeType.SWITCH.value,
        "department": "Backup Control Center",
        "ip_address": "192.168.70.2",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 99.0,
        "pos_x": 240.0,
        "pos_y": 480.0,
        "extra_metadata": {"subnet": "192.168.70.0/24", "gateway": "192.168.70.1", "vlan": 70},
    },

    # ---------------- 7 Departmental Endpoints / Servers ----------------
    {
        "device_id": "HQ-COMMAND-01",
        "node_id": "HQ-COMMAND-01",
        "name": "Emergency Control Center",
        "node_type": NodeType.SERVER.value,
        "department": "Emergency Control Center",
        "ip_address": "192.168.10.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 40.0,
        "pos_y": 100.0,
        "extra_metadata": {
            "role": "Primary Incident Command Server",
            "subnet": "192.168.10.0/24",
            "gateway": "192.168.10.1",
            "dns": "192.168.10.1",
        },
    },
    {
        "device_id": "POLICE-02",
        "node_id": "POLICE-02",
        "name": "Police Station",
        "node_type": NodeType.ENDPOINT.value,
        "department": "Police Station",
        "ip_address": "192.168.20.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 94.0,
        "pos_x": 600.0,
        "pos_y": 40.0,
        "extra_metadata": {
            "role": "Law Enforcement CAD Terminal",
            "subnet": "192.168.20.0/24",
            "gateway": "192.168.20.1",
        },
    },
    {
        "device_id": "FIRE-03",
        "node_id": "FIRE-03",
        "name": "Fire Department",
        "node_type": NodeType.ENDPOINT.value,
        "department": "Fire Department",
        "ip_address": "192.168.30.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 95.0,
        "pos_x": 40.0,
        "pos_y": 340.0,
        "extra_metadata": {
            "role": "Fire & Rescue Dispatch Terminal",
            "subnet": "192.168.30.0/24",
            "gateway": "192.168.30.1",
        },
    },
    {
        "device_id": "HOSPITAL-TRIAGE-03",
        "node_id": "HOSPITAL-TRIAGE-03",
        "name": "Hospital",
        "node_type": NodeType.SERVER.value,
        "department": "Hospital",
        "ip_address": "192.168.40.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 98.0,
        "pos_x": 1060.0,
        "pos_y": 100.0,
        "extra_metadata": {
            "role": "Trauma & Intensive Care EHR Server",
            "subnet": "192.168.40.0/24",
            "gateway": "192.168.40.1",
        },
    },
    {
        "device_id": "AMBULANCE-05",
        "node_id": "AMBULANCE-05",
        "name": "Ambulance Services",
        "node_type": NodeType.ENDPOINT.value,
        "department": "Ambulance Services",
        "ip_address": "192.168.50.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 90.0,
        "pos_x": 1060.0,
        "pos_y": 260.0,
        "extra_metadata": {
            "role": "Mobile Paramedic Fleet Console",
            "subnet": "192.168.50.0/24",
            "gateway": "192.168.50.1",
        },
    },
    {
        "device_id": "SHELTER-SOUTH-05",
        "node_id": "SHELTER-SOUTH-05",
        "name": "Relief Camp",
        "node_type": NodeType.ENDPOINT.value,
        "department": "Relief Camp",
        "ip_address": "192.168.60.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 86.0,
        "pos_x": 1060.0,
        "pos_y": 480.0,
        "extra_metadata": {
            "role": "Evacuation Shelter Logistics Terminal",
            "subnet": "192.168.60.0/24",
            "gateway": "192.168.60.1",
        },
    },
    {
        "device_id": "BACKUP-CC-07",
        "node_id": "BACKUP-CC-07",
        "name": "Backup Control Center",
        "node_type": NodeType.SERVER.value,
        "department": "Backup Control Center",
        "ip_address": "192.168.70.10",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 40.0,
        "pos_y": 480.0,
        "extra_metadata": {
            "role": "Hot-Standby Incident Command Server",
            "subnet": "192.168.70.0/24",
            "gateway": "192.168.70.1",
        },
    },

    # ---------------- Microwave Relays ----------------
    {
        "device_id": "RELAY-NORTH-02",
        "node_id": "RELAY-NORTH-02",
        "name": "Northern Hill Mesh Relay",
        "node_type": NodeType.RELAY.value,
        "department": "Core Network",
        "ip_address": "10.0.100.1",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 85.0,
        "pos_x": 550.0,
        "pos_y": 180.0,
        "extra_metadata": {"role": "High-Altitude Microwave Relay"},
    },
    {
        "device_id": "RELAY-VALLEY-04",
        "node_id": "RELAY-VALLEY-04",
        "name": "Valley Mobile Transceiver",
        "node_type": NodeType.RELAY.value,
        "department": "Core Network",
        "ip_address": "10.0.100.2",
        "status": NodeStatus.DEGRADED.value,
        "battery_level": 45.0,
        "pos_x": 550.0,
        "pos_y": 420.0,
        "extra_metadata": {"role": "Valley Gap Coverage", "fault": "Battery degraded"},
    },
]

DEFAULT_LINKS = [
    # ---------------- 1. Redundant Core Router Ring (Backbone Links) ----------------
    {
        "link_id": "LINK-R1-R2",
        "source_node_id": "ROUTER-01",
        "destination_node_id": "ROUTER-02",
        "bandwidth": 1000.0,
        "latency": 1.5,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "backbone",
        "extra_metadata": {"subnet": "10.0.12.0/30", "r1_ip": "10.0.12.1", "r2_ip": "10.0.12.2", "role": "Primary Ring Link North-East"},
    },
    {
        "link_id": "LINK-R2-R3",
        "source_node_id": "ROUTER-02",
        "destination_node_id": "ROUTER-03",
        "bandwidth": 1000.0,
        "latency": 1.8,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "backbone",
        "extra_metadata": {"subnet": "10.0.23.0/30", "r2_ip": "10.0.23.1", "r3_ip": "10.0.23.2", "role": "Primary Ring Link East-South"},
    },
    {
        "link_id": "LINK-R3-R4",
        "source_node_id": "ROUTER-03",
        "destination_node_id": "ROUTER-04",
        "bandwidth": 1000.0,
        "latency": 1.6,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "backbone",
        "extra_metadata": {"subnet": "10.0.34.0/30", "r3_ip": "10.0.34.1", "r4_ip": "10.0.34.2", "role": "Primary Ring Link South-West"},
    },
    {
        "link_id": "LINK-R4-R1",
        "source_node_id": "ROUTER-04",
        "destination_node_id": "ROUTER-01",
        "bandwidth": 1000.0,
        "latency": 1.5,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "backbone",
        "extra_metadata": {"subnet": "10.0.41.0/30", "r4_ip": "10.0.41.1", "r1_ip": "10.0.41.2", "role": "Primary Ring Link West-North"},
    },

    # ---------------- 2. Core Cross Alternate Paths ----------------
    {
        "link_id": "LINK-R1-R3",
        "source_node_id": "ROUTER-01",
        "destination_node_id": "ROUTER-03",
        "bandwidth": 500.0,
        "latency": 3.2,
        "operational_state": "UP",
        "link_cost": 1.6,
        "link_type": "secondary",
        "extra_metadata": {"subnet": "10.0.13.0/30", "is_secondary": True, "r1_ip": "10.0.13.1", "r3_ip": "10.0.13.2", "role": "Diagonal Alternate Path North-South"},
    },
    {
        "link_id": "LINK-R2-R4",
        "source_node_id": "ROUTER-02",
        "destination_node_id": "ROUTER-04",
        "bandwidth": 500.0,
        "latency": 3.5,
        "operational_state": "UP",
        "link_cost": 1.7,
        "link_type": "secondary",
        "extra_metadata": {"subnet": "10.0.24.0/30", "is_secondary": True, "r2_ip": "10.0.24.1", "r4_ip": "10.0.24.2", "role": "Diagonal Alternate Path East-West"},
    },

    # ---------------- 3. Router to Departmental Switches (Distribution Links) ----------------
    {
        "link_id": "LINK-R1-SW-ECC",
        "source_node_id": "ROUTER-01",
        "destination_node_id": "SW-ECC",
        "bandwidth": 100.0,
        "latency": 1.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.10.0/24", "gateway": "192.168.10.1"},
    },
    {
        "link_id": "LINK-R1-SW-POLICE",
        "source_node_id": "ROUTER-01",
        "destination_node_id": "SW-POLICE",
        "bandwidth": 100.0,
        "latency": 1.2,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.20.0/24", "gateway": "192.168.20.1"},
    },
    {
        "link_id": "LINK-R4-SW-FIRE",
        "source_node_id": "ROUTER-04",
        "destination_node_id": "SW-FIRE",
        "bandwidth": 100.0,
        "latency": 1.1,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.30.0/24", "gateway": "192.168.30.1"},
    },
    {
        "link_id": "LINK-R2-SW-HOSPITAL",
        "source_node_id": "ROUTER-02",
        "destination_node_id": "SW-HOSPITAL",
        "bandwidth": 100.0,
        "latency": 1.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.40.0/24", "gateway": "192.168.40.1"},
    },
    {
        "link_id": "LINK-R2-SW-AMBULANCE",
        "source_node_id": "ROUTER-02",
        "destination_node_id": "SW-AMBULANCE",
        "bandwidth": 100.0,
        "latency": 1.3,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.50.0/24", "gateway": "192.168.50.1"},
    },
    {
        "link_id": "LINK-R3-SW-RELIEF",
        "source_node_id": "ROUTER-03",
        "destination_node_id": "SW-RELIEF",
        "bandwidth": 100.0,
        "latency": 1.4,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.60.0/24", "gateway": "192.168.60.1"},
    },
    {
        "link_id": "LINK-R4-SW-BACKUP",
        "source_node_id": "ROUTER-04",
        "destination_node_id": "SW-BACKUP",
        "bandwidth": 100.0,
        "latency": 1.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "distribution",
        "extra_metadata": {"subnet": "192.168.70.0/24", "gateway": "192.168.70.1"},
    },

    # ---------------- 4. Switch to Departmental Endpoints (Access Links) ----------------
    {
        "link_id": "LINK-SW-ECC-HQ",
        "source_node_id": "SW-ECC",
        "destination_node_id": "HQ-COMMAND-01",
        "bandwidth": 100.0,
        "latency": 0.5,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.10.0/24"},
    },
    {
        "link_id": "LINK-SW-POLICE-UNIT",
        "source_node_id": "SW-POLICE",
        "destination_node_id": "POLICE-02",
        "bandwidth": 100.0,
        "latency": 0.6,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.20.0/24"},
    },
    {
        "link_id": "LINK-SW-FIRE-UNIT",
        "source_node_id": "SW-FIRE",
        "destination_node_id": "FIRE-03",
        "bandwidth": 100.0,
        "latency": 0.5,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.30.0/24"},
    },
    {
        "link_id": "LINK-SW-HOSPITAL-TRIAGE",
        "source_node_id": "SW-HOSPITAL",
        "destination_node_id": "HOSPITAL-TRIAGE-03",
        "bandwidth": 100.0,
        "latency": 0.4,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.40.0/24"},
    },
    {
        "link_id": "LINK-SW-AMBULANCE-UNIT",
        "source_node_id": "SW-AMBULANCE",
        "destination_node_id": "AMBULANCE-05",
        "bandwidth": 100.0,
        "latency": 0.6,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.50.0/24"},
    },
    {
        "link_id": "LINK-SW-RELIEF-SHELTER",
        "source_node_id": "SW-RELIEF",
        "destination_node_id": "SHELTER-SOUTH-05",
        "bandwidth": 100.0,
        "latency": 0.8,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.60.0/24"},
    },
    {
        "link_id": "LINK-SW-BACKUP-CTRL",
        "source_node_id": "SW-BACKUP",
        "destination_node_id": "BACKUP-CC-07",
        "bandwidth": 100.0,
        "latency": 0.5,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "access",
        "extra_metadata": {"subnet": "192.168.70.0/24"},
    },

    # ---------------- 5. Direct Peer & Relay Links (Preserved for compatibility & secondary microwave paths) ----------------
    {
        "link_id": "LINK-ECC-POLICE",
        "source_node_id": "HQ-COMMAND-01",
        "destination_node_id": "POLICE-02",
        "bandwidth": 100.0,
        "latency": 5.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True, "technology": "VHF Microwave Backup"},
    },
    {
        "link_id": "LINK-ECC-FIRE",
        "source_node_id": "HQ-COMMAND-01",
        "destination_node_id": "FIRE-03",
        "bandwidth": 100.0,
        "latency": 6.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-POLICE-HOSPITAL",
        "source_node_id": "POLICE-02",
        "destination_node_id": "HOSPITAL-TRIAGE-03",
        "bandwidth": 54.0,
        "latency": 12.0,
        "operational_state": "UP",
        "link_cost": 1.2,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-FIRE-AMBULANCE",
        "source_node_id": "FIRE-03",
        "destination_node_id": "AMBULANCE-05",
        "bandwidth": 54.0,
        "latency": 9.0,
        "operational_state": "UP",
        "link_cost": 1.1,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-AMBULANCE-HOSPITAL",
        "source_node_id": "AMBULANCE-05",
        "destination_node_id": "HOSPITAL-TRIAGE-03",
        "bandwidth": 54.0,
        "latency": 8.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-FIRE-RELIEF",
        "source_node_id": "FIRE-03",
        "destination_node_id": "SHELTER-SOUTH-05",
        "bandwidth": 54.0,
        "latency": 14.0,
        "operational_state": "UP",
        "link_cost": 1.3,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-RELIEF-BACKUP",
        "source_node_id": "SHELTER-SOUTH-05",
        "destination_node_id": "BACKUP-CC-07",
        "bandwidth": 100.0,
        "latency": 7.0,
        "operational_state": "UP",
        "link_cost": 1.0,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-ECC-RELAY-N",
        "source_node_id": "HQ-COMMAND-01",
        "destination_node_id": "RELAY-NORTH-02",
        "bandwidth": 54.0,
        "latency": 8.0,
        "operational_state": "UP",
        "link_cost": 1.1,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-RELAY-N-HOSPITAL",
        "source_node_id": "RELAY-NORTH-02",
        "destination_node_id": "HOSPITAL-TRIAGE-03",
        "bandwidth": 54.0,
        "latency": 10.0,
        "operational_state": "UP",
        "link_cost": 1.1,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-ECC-RELAY-V",
        "source_node_id": "HQ-COMMAND-01",
        "destination_node_id": "RELAY-VALLEY-04",
        "bandwidth": 54.0,
        "latency": 15.0,
        "operational_state": "DEGRADED",
        "link_cost": 2.0,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
    {
        "link_id": "LINK-RELAY-V-RELIEF",
        "source_node_id": "RELAY-VALLEY-04",
        "destination_node_id": "SHELTER-SOUTH-05",
        "bandwidth": 54.0,
        "latency": 13.0,
        "operational_state": "UP",
        "link_cost": 1.2,
        "link_type": "secondary",
        "extra_metadata": {"is_secondary": True},
    },
]

DEFAULT_SCENARIOS = [
    {
        "scenario_id": "SCEN-QUAKE-01",
        "name": "Earthquake Fault Severance",
        "description": "Seismic event isolates the southern valley corridor, severing primary relay lines.",
        "scenario_type": "earthquake",
        "configuration": {"disabled_nodes": ["RELAY-VALLEY-04"], "link_penalties": {"LINK-FIRE-RELIEF": 3.0}},
    },
    {
        "scenario_id": "SCEN-FLOOD-02",
        "name": "Coastal Inundation Surge",
        "description": "Flash flooding knocks out northern high-ground microwave relay.",
        "scenario_type": "flood",
        "configuration": {"disabled_nodes": ["RELAY-NORTH-02"]},
    },
    {
        "scenario_id": "SCEN-TRIAGE-03",
        "name": "Mass Casualty Emergency",
        "description": "Hospital triage overload triggers highest-priority life-safety telemetry burst.",
        "scenario_type": "casualty_surge",
        "configuration": {"traffic_multiplier": 3.0, "preempt_non_critical": True},
    },
]

DEFAULT_ACCESS_RULES = [
    {
        "rule_id": "RULE-ALL-EMERGENCY",
        "source": "Emergency Control Center",
        "destination": "ALL",
        "protocol": "ANY",
        "action": "PERMIT",
        "enabled": True,
    },
    {
        "rule_id": "RULE-MED-TRIAGE",
        "source": "Ambulance Services",
        "destination": "Hospital",
        "protocol": "TCP",
        "action": "PERMIT",
        "enabled": True,
    },
    {
        "rule_id": "RULE-SAFETY-COORD",
        "source": "Police Station",
        "destination": "Fire Department",
        "protocol": "ANY",
        "action": "PERMIT",
        "enabled": True,
    },
    {
        "rule_id": "RULE-POLICE-HOSPITAL",
        "source": "Police Station",
        "destination": "Hospital",
        "protocol": "TCP",
        "action": "PERMIT",
        "enabled": True,
    },
    {
        "rule_id": "RULE-PUBLIC-ISOLATION",
        "source": "Relief Camp",
        "destination": "Backup Control Center",
        "protocol": "ANY",
        "action": "DENY",
        "enabled": True,
    },
    {
        "rule_id": "RULE-RELIEF-POLICE",
        "source": "Relief Camp",
        "destination": "Police Station",
        "protocol": "UDP",
        "action": "PERMIT",
        "enabled": True,
    },
]

DEFAULT_ALERTS = [
    {
        "alert_id": "ALT-INIT-01",
        "severity": "LOW",
        "category": "CONNECTIVITY",
        "title": "Mesh Infrastructure Online",
        "description": "All 4 core routers, 7 departmental switches, and 7 station endpoints online.",
        "status": "ACTIVE",
    }
]


def validate_ip_addressing_plan() -> Dict[str, Any]:
    """Validate that subnets, gateways, and router links adhere to the addressing plan."""
    expected_subnets = {
        "Emergency Control Center": "192.168.10.0/24",
        "Police Station": "192.168.20.0/24",
        "Fire Department": "192.168.30.0/24",
        "Hospital": "192.168.40.0/24",
        "Ambulance Services": "192.168.50.0/24",
        "Relief Camp": "192.168.60.0/24",
        "Backup Control Center": "192.168.70.0/24",
    }

    results = {
        "departments_checked": len(expected_subnets),
        "valid": True,
        "details": [],
    }

    dept_by_name = {d["name"]: d for d in DEFAULT_DEPARTMENTS}
    for dept_name, subnet in expected_subnets.items():
        dept = dept_by_name.get(dept_name)
        if not dept or dept["subnet"] != subnet:
            results["valid"] = False
            results["details"].append(f"Subnet mismatch for {dept_name}: expected {subnet}")

    return results


def seed_database_idempotent(db: Session):
    """
    Idempotently seeds all baseline entities into SQLite.
    Checks existing records by unique IDs to avoid duplication or erasing history.
    """
    # 1. Departments
    for dept_data in DEFAULT_DEPARTMENTS:
        exists = db.query(Department).filter(Department.code == dept_data["code"]).first()
        if not exists:
            db.add(Department(**dept_data))
        else:
            for field in ["subnet", "gateway", "vlan_id", "priority", "department_type", "name"]:
                if hasattr(exists, field) and field in dept_data:
                    setattr(exists, field, dept_data[field])

    # 2. Traffic Classes
    for tc_data in DEFAULT_TRAFFIC_CLASSES:
        exists = db.query(TrafficClass).filter(TrafficClass.code == tc_data["code"]).first()
        if not exists:
            db.add(TrafficClass(**tc_data))

    # 3. Network Nodes (4 Routers + 7 Switches + 7 Endpoints + Relays)
    for node_data in DEFAULT_NODES:
        exists = db.query(NetworkNode).filter(NetworkNode.node_id == node_data["node_id"]).first()
        if not exists:
            db.add(NetworkNode(**node_data))
        else:
            # Update fields while preserving status and battery
            for field in ["name", "node_type", "department", "ip_address", "device_id", "pos_x", "pos_y", "extra_metadata"]:
                if hasattr(exists, field) and field in node_data:
                    setattr(exists, field, node_data[field])

    db.commit()

    # 4. Network Links
    for link_data in DEFAULT_LINKS:
        exists = db.query(NetworkLink).filter(NetworkLink.link_id == link_data["link_id"]).first()
        if not exists:
            db.add(NetworkLink(**link_data))
        else:
            for field in ["link_type", "extra_metadata", "bandwidth", "latency", "link_cost", "source_node_id", "destination_node_id"]:
                if hasattr(exists, field) and field in link_data:
                    setattr(exists, field, link_data[field])

    # 5. Scenarios
    for scen_data in DEFAULT_SCENARIOS:
        exists = db.query(Scenario).filter(Scenario.scenario_id == scen_data["scenario_id"]).first()
        if not exists:
            db.add(Scenario(**scen_data))

    # 6. Access Rules
    for rule_data in DEFAULT_ACCESS_RULES:
        exists = db.query(AccessRule).filter(AccessRule.rule_id == rule_data["rule_id"]).first()
        if not exists:
            db.add(AccessRule(**rule_data))

    # 7. Initial Baseline Alert
    for alert_data in DEFAULT_ALERTS:
        exists = db.query(Alert).filter(Alert.alert_id == alert_data["alert_id"]).first()
        if not exists:
            db.add(Alert(**alert_data))

    db.commit()

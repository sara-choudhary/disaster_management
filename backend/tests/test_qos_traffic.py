import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services import qos_service
from app.schemas.traffic_class import QoSSimulationRequest


def test_uncongested_traffic_performance_across_classes(db_session: Session):
    """
    When total offered traffic is below link capacity, all classes experience
    uncongested transmission with 100% delivery and minimal queue delay.
    """
    req = QoSSimulationRequest(
        source_department="Emergency Control Center",
        destination_department="Hospital",
        traffic_class="LOW",
        packet_count=100,
        offered_load_mbps=20.0,
        competing_traffic=False,
    )
    res = qos_service.simulate_traffic_qos(db=db_session, request=req)

    assert not res.is_congested
    assert res.delivery_ratio_pct == 100.0
    assert res.packets_lost == 0
    assert res.packets_delivered == 100
    assert res.queue_delay_ms < 2.0
    assert res.link_utilization_pct <= 100.0


def test_congested_traffic_critical_preferential_treatment(db_session: Session):
    """
    When competing traffic exceeds link capacity, Critical traffic receives preferential
    scheduling (100% delivery ratio, minimal queue delay), while Normal and Low traffic
    experience queue delay and packet drops.
    """
    # Simulate Critical flow under high competing congestion
    req_crit = QoSSimulationRequest(
        source_department="Ambulance Services",
        destination_department="Hospital",
        traffic_class="CRITICAL",
        packet_count=200,
        offered_load_mbps=40.0,
        competing_traffic=True,  # competing classes add ~95 Mbps, total offered ~135 Mbps > 100 Mbps bottleneck
    )
    res_crit = qos_service.simulate_traffic_qos(db=db_session, request=req_crit)

    assert res_crit.is_congested
    assert res_crit.link_utilization_pct == 100.0
    # Critical gets top priority: 100% delivery ratio
    assert res_crit.delivery_ratio_pct == 100.0
    assert res_crit.packets_delivered == 200
    assert res_crit.packets_lost == 0
    assert res_crit.queue_delay_ms < 5.0

    # Inspect results by class:
    class_map = {c.traffic_class: c for c in res_crit.results_by_class}

    assert "CRITICAL" in class_map
    assert "HIGH" in class_map
    assert "NORMAL" in class_map
    assert "LOW" in class_map

    # Critical delivery ratio is strictly higher than or equal to Normal and Low
    assert class_map["CRITICAL"].delivery_ratio_pct >= class_map["NORMAL"].delivery_ratio_pct
    assert class_map["CRITICAL"].delivery_ratio_pct >= class_map["LOW"].delivery_ratio_pct
    # Lower classes suffer packet loss and elevated queue delay under congestion
    assert class_map["NORMAL"].packets_lost > 0 or class_map["LOW"].packets_lost > 0
    assert class_map["LOW"].queue_delay_ms > class_map["CRITICAL"].queue_delay_ms


def test_scheduler_respects_link_capacity_constraint(db_session: Session):
    """
    The scheduler must strictly respect bottleneck link capacity constraint:
    sum of allocated bandwidth across all 4 priority classes <= bottleneck capacity.
    """
    req = QoSSimulationRequest(
        source_department="Police Station",
        destination_department="Fire Department",
        traffic_class="NORMAL",
        packet_count=500,
        offered_load_mbps=150.0,  # heavily congested
        competing_traffic=True,
    )
    res = qos_service.simulate_traffic_qos(db=db_session, request=req)

    total_allocated = sum(c.allocated_mbps for c in res.results_by_class)
    assert total_allocated <= res.bottleneck_capacity_mbps + 0.01
    assert res.link_utilization_pct == 100.0


def test_starvation_safeguard_allocates_bandwidth_to_low_class(db_session: Session):
    """
    Strict priority with starvation safeguard ensures Low-priority background traffic
    is allocated reserved bandwidth safeguard rather than being 100% starved.
    """
    req = QoSSimulationRequest(
        source_department="Emergency Control Center",
        destination_department="Relief Camp",
        traffic_class="LOW",
        packet_count=200,
        offered_load_mbps=40.0,
        competing_traffic=True,
    )
    res = qos_service.simulate_traffic_qos(db=db_session, request=req)

    low_result = next(c for c in res.results_by_class if c.traffic_class == "LOW")
    # Low class receives non-zero allocated bandwidth via safeguard
    assert low_result.allocated_mbps > 0.0
    assert low_result.packets_delivered > 0


def test_traffic_api_simulate_endpoint(client: TestClient):
    """
    API integration test for POST /api/v1/traffic/simulate.
    """
    payload = {
        "source_department": "Emergency Control Center",
        "destination_department": "Hospital",
        "traffic_class": "CRITICAL",
        "packet_count": 100,
        "offered_load_mbps": 50.0,
        "test_duration_sec": 10.0,
        "competing_traffic": True,
    }
    response = client.post("/api/v1/traffic/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "simulation_id" in data
    assert data["selected_class"] == "CRITICAL"
    assert data["packets_sent"] == 100
    assert "delivery_ratio_pct" in data
    assert "estimated_latency_ms" in data
    assert "queue_delay_ms" in data
    assert "link_utilization_pct" in data
    assert len(data["results_by_class"]) == 4

    # Check that results are clearly identified as simulated estimates
    assert "SIMULATED ESTIMATE" in data["simulated_estimate_notice"].upper()

    # Check routing vs QoS explanation
    assert "ROUTING VS. QOS" in data["qos_vs_routing_explanation"].upper()
    assert "OSPF" in data["qos_vs_routing_explanation"]


def test_traffic_api_classes_and_architecture(client: TestClient):
    """
    API integration tests for GET /api/v1/traffic/classes and GET /api/v1/traffic/architecture.
    """
    res_classes = client.get("/api/v1/traffic/classes")
    assert res_classes.status_code == 200
    classes = res_classes.json()
    assert len(classes) >= 4
    class_codes = [c["code"] for c in classes]
    assert "CRITICAL" in class_codes
    assert "HIGH" in class_codes
    assert "NORMAL" in class_codes
    assert "LOW" in class_codes

    res_arch = client.get("/api/v1/traffic/architecture")
    assert res_arch.status_code == 200
    arch = res_arch.json()
    assert "routing_role" in arch
    assert "qos_role" in arch
    assert "scheduling_policy" in arch
    assert "SP-SS" in arch["scheduling_policy"]

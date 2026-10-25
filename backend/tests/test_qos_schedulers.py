import pytest
from app.schemas.traffic_class import QoSSimulationRequest
from app.services.qos_service import (
    calculate_bandwidth_allocation,
    compare_qos_schedulers,
    simulate_traffic_qos,
)


def test_strict_priority_starvation_demonstration():
    # Bottleneck 100 Mbps, Offered: Critical=60, High=45, Normal=30, Low=25 -> Total=160 Mbps
    offered = {"CRITICAL": 60.0, "HIGH": 45.0, "NORMAL": 30.0, "LOW": 25.0}

    # 1. Pure Strict Priority
    sp_alloc = calculate_bandwidth_allocation(
        policy="strict_priority",
        offered_loads=offered,
        bottleneck_capacity=100.0,
        is_congested=True,
    )
    # Critical takes 60 Mbps, High takes remaining 40 Mbps (total 100 Mbps)
    assert sp_alloc["CRITICAL"] == 60.0
    assert sp_alloc["HIGH"] == 40.0
    # Normal and Low must be starved to 0 Mbps
    assert sp_alloc["NORMAL"] == 0.0
    assert sp_alloc["LOW"] == 0.0


def test_weighted_fair_queueing_prevents_starvation():
    # Bottleneck 100 Mbps, Overloaded
    offered = {"CRITICAL": 60.0, "HIGH": 45.0, "NORMAL": 30.0, "LOW": 25.0}

    wfq_alloc = calculate_bandwidth_allocation(
        policy="weighted_fair_queueing",
        offered_loads=offered,
        bottleneck_capacity=100.0,
        is_congested=True,
    )
    # Under WFQ, all active classes must receive > 0 Mbps (no starvation)
    assert wfq_alloc["CRITICAL"] > 0.0
    assert wfq_alloc["HIGH"] > 0.0
    assert wfq_alloc["NORMAL"] > 0.0
    assert wfq_alloc["LOW"] > 0.0
    assert sum(wfq_alloc.values()) <= 100.01


def test_round_robin_fair_share():
    # Bottleneck 100 Mbps, 4 classes with 30 Mbps each = 120 Mbps total
    offered = {"CRITICAL": 30.0, "HIGH": 30.0, "NORMAL": 30.0, "LOW": 30.0}

    rr_alloc = calculate_bandwidth_allocation(
        policy="round_robin",
        offered_loads=offered,
        bottleneck_capacity=100.0,
        is_congested=True,
    )
    # Round robin divides 100 Mbps equally among 4 active classes -> 25 Mbps each
    assert rr_alloc["CRITICAL"] == 25.0
    assert rr_alloc["HIGH"] == 25.0
    assert rr_alloc["NORMAL"] == 25.0
    assert rr_alloc["LOW"] == 25.0


def test_compare_qos_schedulers_api(client):
    req_payload = {
        "source_department": "Emergency Control Center",
        "destination_department": "Hospital",
        "traffic_class": "CRITICAL",
        "packet_count": 100,
        "offered_load_mbps": 75.0,
        "test_duration_sec": 10.0,
        "competing_traffic": True,
        "scheduler_policy": "strict_priority",
    }

    response = client.post("/api/v1/traffic/compare-schedulers", json=req_payload)
    assert response.status_code == 200
    data = response.json()

    assert data["source_department"] == "Emergency Control Center"
    assert data["destination_department"] == "Hospital"
    assert len(data["schedulers"]) == 4

    keys = [s["policy_key"] for s in data["schedulers"]]
    assert "strict_priority" in keys
    assert "strict_priority_with_safeguards" in keys
    assert "weighted_fair_queueing" in keys
    assert "round_robin" in keys

    # Find Pure Strict Priority
    sp = next(s for s in data["schedulers"] if s["policy_key"] == "strict_priority")
    assert sp["starvation_observed"] is True
    assert sp["low_delivery_pct"] == 0.0

    # Find WFQ
    wfq = next(s for s in data["schedulers"] if s["policy_key"] == "weighted_fair_queueing")
    assert wfq["starvation_observed"] is False
    assert wfq["low_delivery_pct"] > 0.0

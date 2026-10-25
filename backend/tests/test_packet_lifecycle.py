import pytest
from app.services.packet_simulation import (
    simulate_discrete_packet_flow,
    PacketState,
)
from app.services.routing_engine import OSPFRoutingEngine


def test_packet_lifecycle_normal_delivery():
    from collections import namedtuple
    NodeMock = namedtuple("NodeMock", ["status", "name", "node_type"])
    LinkMock = namedtuple("LinkMock", ["link_id", "source_node_id", "destination_node_id", "link_cost", "operational_state", "bandwidth", "latency", "link_type"])

    nodes = {
        "N1": NodeMock("active", "Node 1", "router"),
        "N2": NodeMock("active", "Node 2", "router"),
        "N3": NodeMock("active", "Node 3", "endpoint"),
    }
    links = {
        "L12": LinkMock("L12", "N1", "N2", 1.0, "UP", 100.0, 5.0, "ordinary"),
        "L23": LinkMock("L23", "N2", "N3", 1.0, "UP", 100.0, 5.0, "ordinary"),
    }

    res = simulate_discrete_packet_flow(
        source_id="N1",
        target_id="N3",
        priority="CRITICAL_SOS",
        packet_count=10,
        nodes_dict=nodes,
        links_dict=links,
    )

    assert res.total_packets_generated == 10
    assert res.delivered_count == 10
    assert res.dropped_count == 0
    assert res.delivery_ratio_pct == 100.0
    assert res.accounting_reconciled is True
    assert len(res.packets) == 10

    for pkt in res.packets:
        assert pkt.current_state == PacketState.DELIVERED
        assert pkt.acknowledged is True
        assert pkt.route_taken == ["N1", "N2", "N3"]
        assert pkt.end_to_end_latency_ms > 0.0


def test_packet_lifecycle_rerouting_after_link_failure():
    from collections import namedtuple
    NodeMock = namedtuple("NodeMock", ["status", "name", "node_type"])
    LinkMock = namedtuple("LinkMock", ["link_id", "source_node_id", "destination_node_id", "link_cost", "operational_state", "bandwidth", "latency", "link_type"])

    # Diamond topology: N1 -> N2 -> N4 (primary, cost 2), N1 -> N3 -> N4 (backup, cost 4)
    nodes = {
        "N1": NodeMock("active", "N1", "router"),
        "N2": NodeMock("active", "N2", "router"),
        "N3": NodeMock("active", "N3", "router"),
        "N4": NodeMock("active", "N4", "router"),
    }
    links = {
        "L12": LinkMock("L12", "N1", "N2", 1.0, "UP", 100.0, 5.0, "backbone"),
        "L24": LinkMock("L24", "N2", "N4", 1.0, "UP", 100.0, 5.0, "backbone"),
        "L13": LinkMock("L13", "N1", "N3", 2.0, "UP", 100.0, 10.0, "secondary"),
        "L34": LinkMock("L34", "N3", "N4", 2.0, "UP", 100.0, 10.0, "secondary"),
    }

    # Inject failure on primary link L12 at packet 4
    res = simulate_discrete_packet_flow(
        source_id="N1",
        target_id="N4",
        packet_count=10,
        nodes_dict=nodes,
        links_dict=links,
        inject_failure_at_packet=4,
        inject_failed_link="L12",
    )

    assert res.total_packets_generated == 10
    assert res.delivered_count == 10
    assert res.accounting_reconciled is True
    assert res.failure_encountered is True
    assert res.alternate_path_used is True

    # Packets before failure used primary path N1-N2-N4
    assert res.packets[0].route_taken == ["N1", "N2", "N4"]
    # Packets after failure used alternate backup path N1-N3-N4
    assert res.packets[-1].route_taken == ["N1", "N3", "N4"]


def test_packet_lifecycle_permanent_partition():
    from collections import namedtuple
    NodeMock = namedtuple("NodeMock", ["status", "name", "node_type"])
    LinkMock = namedtuple("LinkMock", ["link_id", "source_node_id", "destination_node_id", "link_cost", "operational_state", "bandwidth", "latency", "link_type"])

    # Disconnected graph: Isolated N1 and N2
    nodes = {
        "N1": NodeMock("active", "N1", "router"),
        "N2": NodeMock("active", "N2", "router"),
    }
    links = {}

    res = simulate_discrete_packet_flow(
        source_id="N1",
        target_id="N2",
        packet_count=5,
        nodes_dict=nodes,
        links_dict=links,
        retry_limit=3,
    )

    assert res.total_packets_generated == 5
    assert res.delivered_count == 0
    assert res.dropped_count == 5
    assert res.delivery_ratio_pct == 0.0
    assert res.accounting_reconciled is True

    for pkt in res.packets:
        assert pkt.current_state == PacketState.FAILED_UNRECOVERABLE
        assert "DESTINATION_PARTITIONED" in (pkt.drop_reason or "")
        assert pkt.retransmissions == 3


def test_packet_queue_overflow():
    from collections import namedtuple
    NodeMock = namedtuple("NodeMock", ["status", "name", "node_type"])
    LinkMock = namedtuple("LinkMock", ["link_id", "source_node_id", "destination_node_id", "link_cost", "operational_state", "bandwidth", "latency", "link_type"])

    nodes = {
        "N1": NodeMock("active", "N1", "router"),
        "N2": NodeMock("active", "N2", "router"),
    }
    links = {}

    # Low capacity queue of 3 packets, send 6 packets into a partitioned destination
    res = simulate_discrete_packet_flow(
        source_id="N1",
        target_id="N2",
        packet_count=6,
        nodes_dict=nodes,
        links_dict=links,
        max_queue_capacity=3,
    )

    assert res.accounting_reconciled is True
    # At least some packets should have dropped with QUEUE_BUFFER_OVERFLOW
    overflow_pkts = [p for p in res.packets if "QUEUE_BUFFER_OVERFLOW" in (p.drop_reason or "")]
    assert len(overflow_pkts) > 0

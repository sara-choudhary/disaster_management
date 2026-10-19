import pytest
from app.services.routing_engine import OSPFRoutingEngine


@pytest.fixture
def sample_engine():
    """Build a test OSPF-inspired topology graph."""
    engine = OSPFRoutingEngine()
    # 4 Routers in a redundant ring with cross links
    engine.add_node("R1", node_type="router", status="active")
    engine.add_node("R2", node_type="router", status="active")
    engine.add_node("R3", node_type="router", status="active")
    engine.add_node("R4", node_type="router", status="active")

    # Ring links (cost = 1.0 each)
    engine.add_link("LINK-R1-R2", "R1", "R2", cost=1.0, operational_state="UP")
    engine.add_link("LINK-R2-R3", "R2", "R3", cost=1.0, operational_state="UP")
    engine.add_link("LINK-R3-R4", "R3", "R4", cost=1.0, operational_state="UP")
    engine.add_link("LINK-R4-R1", "R4", "R1", cost=1.0, operational_state="UP")

    # Cross alternate links (cost = 2.5 each)
    engine.add_link("LINK-R1-R3", "R1", "R3", cost=2.5, operational_state="UP", link_type="secondary")
    engine.add_link("LINK-R2-R4", "R2", "R4", cost=2.5, operational_state="UP", link_type="secondary")

    # Endpoints connected to routers
    engine.add_node("ECC-SERVER", node_type="server", status="active")
    engine.add_link("LINK-ECC", "R1", "ECC-SERVER", cost=0.5, operational_state="UP")

    engine.add_node("HOSPITAL-SERVER", node_type="server", status="active")
    engine.add_link("LINK-HOSP", "R2", "HOSPITAL-SERVER", cost=0.5, operational_state="UP")

    engine.add_node("ISOLATED-CAMP", node_type="endpoint", status="active")

    return engine


def test_shortest_path_calculation(sample_engine: OSPFRoutingEngine):
    """Test standard shortest-path calculation between routers and endpoints."""
    res = sample_engine.calculate_shortest_path("ECC-SERVER", "HOSPITAL-SERVER")
    assert res.reachable is True
    # Path: ECC-SERVER -> R1 -> R2 -> HOSPITAL-SERVER
    assert res.selected_path == ["ECC-SERVER", "R1", "R2", "HOSPITAL-SERVER"]
    assert res.total_cost == 2.0  # 0.5 + 1.0 + 0.5
    assert res.next_hop == "R1"
    assert len(res.hop_list) == 3
    assert res.alternate_path_selected is False


def test_positive_link_cost_enforcement():
    """Ensure non-positive link costs are rejected."""
    engine = OSPFRoutingEngine()
    with pytest.raises(ValueError):
        engine.add_link("L1", "A", "B", cost=0.0)
    with pytest.raises(ValueError):
        engine.add_link("L2", "A", "B", cost=-5.0)


def test_failed_link_alternate_path_selection(sample_engine: OSPFRoutingEngine):
    """When primary link R1-R2 fails, router should recalculate via alternate path."""
    # Fail primary link
    res = sample_engine.calculate_shortest_path(
        "ECC-SERVER",
        "HOSPITAL-SERVER",
        failed_link_ids=["LINK-R1-R2"],
    )
    assert res.reachable is True
    assert "LINK-R1-R2" not in [h.link_id for h in res.hop_list]
    assert res.alternate_path_selected is True
    # Can go via R1 -> R4 -> R3 -> R2 (cost 1+1+1 = 3.0) or R1 -> R3 -> R2 (cost 2.5 + 1.0 = 3.5)
    # R1 -> R4 -> R3 -> R2 has cost 0.5 + 1.0 + 1.0 + 1.0 + 0.5 = 4.0
    # R1 -> R3 -> R2 has cost 0.5 + 2.5 + 1.0 + 0.5 = 4.5
    assert "R2" in res.selected_path
    assert res.total_cost > 2.0  # Higher cost alternate path


def test_failed_node_rerouting(sample_engine: OSPFRoutingEngine):
    """When an intermediate transit router fails, traffic detours around it."""
    # Fail R2
    res = sample_engine.calculate_shortest_path(
        "R1",
        "R3",
        failed_node_ids=["R2"],
    )
    assert res.reachable is True
    assert "R2" not in res.selected_path
    # Alternate path should be direct R1-R3 or R1-R4-R3
    assert res.selected_path[0] == "R1"
    assert res.selected_path[-1] == "R3"


def test_disconnected_destination_unreachable(sample_engine: OSPFRoutingEngine):
    """When destination is disconnected, return unreachable status."""
    res = sample_engine.calculate_shortest_path("ECC-SERVER", "ISOLATED-CAMP")
    assert res.reachable is False
    assert res.selected_path == []
    assert res.total_cost == float("inf")
    assert res.next_hop is None
    assert len(res.route_changes) > 0


def test_routing_table_generation(sample_engine: OSPFRoutingEngine):
    """Generate complete converged OSPF-style routing table for router R1."""
    table = sample_engine.generate_routing_table("R1")
    assert "R2" in table
    assert table["R2"].next_hop == "R2"
    assert table["R2"].cost == 1.0
    assert table["R2"].reachable is True

    assert "HOSPITAL-SERVER" in table
    assert table["HOSPITAL-SERVER"].next_hop == "R2"
    assert table["HOSPITAL-SERVER"].cost == 1.5

    assert "ISOLATED-CAMP" in table
    assert table["ISOLATED-CAMP"].reachable is False


def test_route_recalculation_after_topology_change(sample_engine: OSPFRoutingEngine):
    """Changing link cost dynamically updates shortest path."""
    # Initially R1 -> R3 is 2.5 (direct) vs R1 -> R2 -> R3 is 2.0 (via R2)
    initial = sample_engine.calculate_shortest_path("R1", "R3")
    assert initial.selected_path == ["R1", "R2", "R3"]

    # Lower direct link cost
    sample_engine.set_link_cost("LINK-R1-R3", 0.8)
    updated = sample_engine.calculate_shortest_path("R1", "R3")
    assert updated.selected_path == ["R1", "R3"]
    assert updated.total_cost == 0.8

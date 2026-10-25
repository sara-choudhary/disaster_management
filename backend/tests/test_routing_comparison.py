import pytest
from app.services.routing_engine import OSPFRoutingEngine


def test_routing_engine_algorithms_comparison():
    engine = OSPFRoutingEngine()
    # Build diamond topology: A -> B (cost 1), A -> C (cost 2), B -> D (cost 2), C -> D (cost 1)
    # Plus alternative path: A -> E (cost 3), E -> D (cost 3)
    engine.add_node("A", "Node A")
    engine.add_node("B", "Node B")
    engine.add_node("C", "Node C")
    engine.add_node("D", "Node D")
    engine.add_node("E", "Node E")

    engine.add_link("L_AB", "A", "B", cost=1.0)
    engine.add_link("L_AC", "A", "C", cost=2.0)
    engine.add_link("L_BD", "B", "D", cost=2.0)
    engine.add_link("L_CD", "C", "D", cost=1.0)
    engine.add_link("L_AE", "A", "E", cost=3.0)
    engine.add_link("L_ED", "E", "D", cost=3.0)

    # 1. Compare algorithms from A to D
    res = engine.compare_algorithms("A", "D", K=3)
    assert res["source"] == "A"
    assert res["destination"] == "D"
    assert len(res["algorithms"]) == 4

    # Dijkstra
    dijkstra = next(a for a in res["algorithms"] if a["algorithm_key"] == "dijkstra")
    assert dijkstra["reachable"] is True
    assert dijkstra["total_cost"] == 3.0
    assert dijkstra["hop_count"] == 2

    # Bellman-Ford
    bf = next(a for a in res["algorithms"] if a["algorithm_key"] == "bellman_ford")
    assert bf["reachable"] is True
    assert bf["total_cost"] == 3.0
    assert bf["path"] in (["A", "B", "D"], ["A", "C", "D"])

    # Floyd-Warshall
    fw = next(a for a in res["algorithms"] if a["algorithm_key"] == "floyd_warshall")
    assert fw["reachable"] is True
    assert fw["total_cost"] == 3.0
    assert res["all_pairs_matrix_summary"] is not None
    assert res["all_pairs_matrix_summary"]["active_nodes_count"] == 5

    # Yen's K-Shortest
    yen = next(a for a in res["algorithms"] if a["algorithm_key"] == "yen_k_shortest")
    assert yen["reachable"] is True
    assert len(yen["ranked_alternatives"]) >= 2
    # Rank 1 and Rank 2 should both have cost 3.0 (two equal shortest paths A-B-D and A-C-D)
    assert yen["ranked_alternatives"][0]["total_cost"] == 3.0
    assert yen["ranked_alternatives"][1]["total_cost"] == 3.0
    # Rank 3 should be through E with cost 6.0
    if len(yen["ranked_alternatives"]) >= 3:
        assert yen["ranked_alternatives"][2]["total_cost"] == 6.0
        assert yen["ranked_alternatives"][2]["path"] == ["A", "E", "D"]


def test_bellman_ford_rejects_negative_costs():
    engine = OSPFRoutingEngine()
    engine.add_node("X")
    engine.add_node("Y")
    # Manually insert negative edge for verification of safety check
    engine.nodes["X"] = {"status": "active"}
    engine.nodes["Y"] = {"status": "active"}
    from app.services.routing_engine import LinkEdge
    neg_edge = LinkEdge(link_id="L_NEG", source="X", destination="Y", cost=-5.0, operational_state="UP")
    engine.adjacency["X"] = {"Y": [neg_edge]}
    engine.adjacency["Y"] = {}

    reachable, cost, path, elapsed, note = engine.bellman_ford("X", "Y")
    assert reachable is False
    assert "Negative link cost" in note


def test_yen_k_shortest_paths_after_failure():
    engine = OSPFRoutingEngine()
    engine.add_node("R1")
    engine.add_node("R2")
    engine.add_node("R3")
    engine.add_node("R4")

    # Primary: R1 -> R2 (cost 1) -> R4 (cost 1) = 2
    # Backup: R1 -> R3 (cost 2) -> R4 (cost 2) = 4
    engine.add_link("L12", "R1", "R2", cost=1.0)
    engine.add_link("L24", "R2", "R4", cost=1.0)
    engine.add_link("L13", "R1", "R3", cost=2.0)
    engine.add_link("L34", "R3", "R4", cost=2.0)

    # Initial state
    ranked_initial, _ = engine.yen_k_shortest_paths("R1", "R4", K=2)
    assert len(ranked_initial) == 2
    assert ranked_initial[0]["path"] == ["R1", "R2", "R4"]
    assert ranked_initial[1]["path"] == ["R1", "R3", "R4"]

    # Sever link L12
    engine.set_link_state("L12", "DOWN")
    ranked_after, _ = engine.yen_k_shortest_paths("R1", "R4", K=2)
    assert len(ranked_after) == 1
    assert ranked_after[0]["path"] == ["R1", "R3", "R4"]
    assert ranked_after[0]["total_cost"] == 4.0


def test_compare_algorithms_api_endpoint(client):
    response = client.get("/api/v1/network/routes/compare-algorithms?source=HQ-COMMAND-01&destination=HOSPITAL-TRIAGE-03&k_paths=3")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "HQ-COMMAND-01"
    assert data["destination"] == "HOSPITAL-TRIAGE-03"
    assert len(data["algorithms"]) == 4

    keys = [a["algorithm_key"] for a in data["algorithms"]]
    assert "dijkstra" in keys
    assert "bellman_ford" in keys
    assert "floyd_warshall" in keys
    assert "yen_k_shortest" in keys

    # Verify educational notes emphasize difference between computation time and recovery
    assert "convergence" in data["educational_notes"].lower()
    assert "bfd" in data["educational_notes"].lower()

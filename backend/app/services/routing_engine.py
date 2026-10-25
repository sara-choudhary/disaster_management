"""
OSPF-Inspired Routing Simulation Engine.

NOTE: This is an OSPF-inspired routing simulation that utilizes Dijkstra's
Shortest Path First (SPF) algorithm with cumulative link costs to calculate
deterministic routes and next-hop selections across a graph representation
of routers, switches, and departmental endpoints.
It does NOT exchange actual OSPF protocol packets (Hello/LSA/LSU) or emulate
socket-level OSPF neighbor adjacencies.
"""

import heapq
import time
import copy
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set, Any
from pydantic import BaseModel, Field


class LinkEdge(BaseModel):
    link_id: str
    source: str
    destination: str
    cost: float = 1.0
    operational_state: str = "UP"  # UP, DEGRADED, DOWN
    bandwidth: float = 100.0       # in Mbps
    latency: float = 10.0          # in ms
    link_type: str = "ordinary"    # backbone, secondary, distribution, access
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class RouteHop(BaseModel):
    step: int
    from_node: str
    to_node: str
    link_id: Optional[str] = None
    cost: float = 1.0
    cumulative_cost: float = 1.0
    latency_ms: float = 0.0
    link_type: str = "ordinary"


class RoutingTableEntry(BaseModel):
    destination: str
    next_hop: Optional[str] = None
    cost: Optional[float] = None
    total_hops: int = 0
    path: List[str] = Field(default_factory=list)
    reachable: bool = False


class RouteCalculationResult(BaseModel):
    source: str
    destination: str
    reachable: bool
    total_cost: float
    selected_path: List[str]
    hop_list: List[RouteHop]
    next_hop: Optional[str] = None
    primary_path: Optional[List[str]] = None
    alternate_path_selected: bool = False
    route_changes: List[str] = Field(default_factory=list)
    algorithm: str = "OSPF-Inspired SPF (Dijkstra)"
    active_nodes_count: int = 0
    active_links_count: int = 0


class OSPFRoutingEngine:
    """
    Deterministic Graph-based OSPF-inspired Shortest Path First (SPF) routing engine.
    Independent of FastAPI and frontend components.
    """

    def __init__(self):
        self.nodes: Dict[str, Dict[str, Any]] = {}
        # adjacency: node_id -> dict of neighbor_id -> List[LinkEdge]
        self.adjacency: Dict[str, Dict[str, List[LinkEdge]]] = {}
        self.links_by_id: Dict[str, LinkEdge] = {}

    def add_node(
        self,
        node_id: str,
        name: Optional[str] = None,
        node_type: str = "router",
        status: str = "active",
        ip_address: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ):
        """Add or update a node in the graph topology."""
        self.nodes[node_id] = {
            "node_id": node_id,
            "name": name or node_id,
            "node_type": node_type,
            "status": status.lower(),
            "ip_address": ip_address,
            "extra_metadata": extra_metadata or {},
        }
        if node_id not in self.adjacency:
            self.adjacency[node_id] = {}

    def add_link(
        self,
        link_id: str,
        source: str,
        destination: str,
        cost: float = 1.0,
        operational_state: str = "UP",
        bandwidth: float = 100.0,
        latency: float = 10.0,
        link_type: str = "ordinary",
        bidirectional: bool = True,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ):
        """Add an edge with positive link cost into the topology graph."""
        if cost <= 0:
            raise ValueError(f"Link cost must be positive, got {cost}")

        if source not in self.nodes:
            self.add_node(source)
        if destination not in self.nodes:
            self.add_node(destination)

        edge = LinkEdge(
            link_id=link_id,
            source=source,
            destination=destination,
            cost=float(cost),
            operational_state=operational_state.upper(),
            bandwidth=bandwidth,
            latency=latency,
            link_type=link_type,
            extra_metadata=extra_metadata or {},
        )
        self.links_by_id[link_id] = edge

        # Forward link
        if destination not in self.adjacency[source]:
            self.adjacency[source][destination] = []
        self.adjacency[source][destination].append(edge)

        # Bidirectional link
        if bidirectional:
            if source not in self.adjacency[destination]:
                self.adjacency[destination][source] = []
            rev_edge = LinkEdge(
                link_id=link_id,
                source=destination,
                destination=source,
                cost=float(cost),
                operational_state=operational_state.upper(),
                bandwidth=bandwidth,
                latency=latency,
                link_type=link_type,
                extra_metadata=extra_metadata or {},
            )
            self.adjacency[destination][source].append(rev_edge)

    def set_link_cost(self, link_id: str, new_cost: float):
        """Update the positive link cost (metric)."""
        if new_cost <= 0:
            raise ValueError(f"Link cost must be positive, got {new_cost}")
        if link_id in self.links_by_id:
            self.links_by_id[link_id].cost = float(new_cost)
            # Update in adjacency maps
            src = self.links_by_id[link_id].source
            dst = self.links_by_id[link_id].destination
            for e in self.adjacency.get(src, {}).get(dst, []):
                if e.link_id == link_id:
                    e.cost = float(new_cost)
            for e in self.adjacency.get(dst, {}).get(src, []):
                if e.link_id == link_id:
                    e.cost = float(new_cost)

    def set_link_state(self, link_id: str, state: str):
        """Set link operational state (UP, DEGRADED, DOWN)."""
        st = state.upper()
        if link_id in self.links_by_id:
            self.links_by_id[link_id].operational_state = st
            src = self.links_by_id[link_id].source
            dst = self.links_by_id[link_id].destination
            for e in self.adjacency.get(src, {}).get(dst, []):
                if e.link_id == link_id:
                    e.operational_state = st
            for e in self.adjacency.get(dst, {}).get(src, []):
                if e.link_id == link_id:
                    e.operational_state = st

    def set_node_status(self, node_id: str, status: str):
        """Set node operational status (active, degraded, offline)."""
        if node_id in self.nodes:
            self.nodes[node_id]["status"] = status.lower()

    def _dijkstra(
        self,
        source: str,
        failed_node_ids: Set[str],
        failed_link_ids: Set[str],
        ignore_states: bool = False,
    ) -> Tuple[Dict[str, float], Dict[str, Optional[str]], Dict[str, Optional[LinkEdge]]]:
        """
        Core Dijkstra shortest-path implementation.
        Computes shortest distances, previous node pointers, and edges used.
        """
        distances: Dict[str, float] = {n: float("inf") for n in self.nodes}
        previous: Dict[str, Optional[str]] = {n: None for n in self.nodes}
        previous_edge: Dict[str, Optional[LinkEdge]] = {n: None for n in self.nodes}

        if source not in self.nodes or (not ignore_states and source in failed_node_ids):
            return distances, previous, previous_edge

        distances[source] = 0.0
        # Priority queue item: (cumulative_cost, node_id)
        pq: List[Tuple[float, str]] = [(0.0, source)]

        while pq:
            current_cost, u = heapq.heappop(pq)

            if current_cost > distances[u]:
                continue

            for v, edges in self.adjacency.get(u, {}).items():
                if not ignore_states:
                    if v in failed_node_ids:
                        continue
                    v_node = self.nodes.get(v, {})
                    if v_node.get("status") == "offline":
                        continue

                # Find lowest-cost operational edge between u and v
                for edge in edges:
                    if not ignore_states:
                        if edge.link_id in failed_link_ids:
                            continue
                        if edge.operational_state == "DOWN":
                            continue

                    # Penalty if degraded
                    edge_cost = edge.cost
                    if not ignore_states and edge.operational_state == "DEGRADED":
                        edge_cost *= 2.0

                    candidate = current_cost + edge_cost
                    if candidate < distances[v]:
                        distances[v] = candidate
                        previous[v] = u
                        previous_edge[v] = edge
                        heapq.heappush(pq, (candidate, v))

        return distances, previous, previous_edge

    def calculate_shortest_path(
        self,
        source: str,
        destination: str,
        failed_node_ids: Optional[List[str]] = None,
        failed_link_ids: Optional[List[str]] = None,
    ) -> RouteCalculationResult:
        """
        Calculate deterministic shortest route between source and destination.
        Handles alternate-path selection when primary components fail.
        """
        failed_nodes = set(failed_node_ids or [])
        failed_links = set(failed_link_ids or [])

        # Include nodes that are natively offline
        for nid, node in self.nodes.items():
            if node.get("status") == "offline":
                failed_nodes.add(nid)

        # Include links that are natively DOWN
        for lid, link in self.links_by_id.items():
            if link.operational_state == "DOWN":
                failed_links.add(lid)

        active_nodes_count = len(self.nodes) - len([n for n in self.nodes if n in failed_nodes])
        active_links_count = len(self.links_by_id) - len([l for l in self.links_by_id if l in failed_links])

        # 1. Calculate baseline primary path on fully operational topology
        base_dist, base_prev, _ = self._dijkstra(source, set(), set(), ignore_states=True)
        primary_path: Optional[List[str]] = None
        if base_dist.get(destination, float("inf")) < float("inf"):
            curr: Optional[str] = destination
            p_list: List[str] = []
            while curr is not None:
                p_list.append(curr)
                curr = base_prev.get(curr)
            p_list.reverse()
            primary_path = p_list

        # 2. Calculate active operational path taking into account failures
        distances, previous, previous_edge = self._dijkstra(source, failed_nodes, failed_links)

        route_changes: List[str] = []
        if source in failed_nodes:
            route_changes.append(f"Source node '{source}' is currently offline/failed.")
            return RouteCalculationResult(
                source=source,
                destination=destination,
                reachable=False,
                total_cost=float("inf"),
                selected_path=[],
                hop_list=[],
                next_hop=None,
                primary_path=primary_path,
                alternate_path_selected=False,
                route_changes=route_changes,
                active_nodes_count=active_nodes_count,
                active_links_count=active_links_count,
            )

        if destination in failed_nodes:
            route_changes.append(f"Destination node '{destination}' is offline/failed.")
            return RouteCalculationResult(
                source=source,
                destination=destination,
                reachable=False,
                total_cost=float("inf"),
                selected_path=[],
                hop_list=[],
                next_hop=None,
                primary_path=primary_path,
                alternate_path_selected=False,
                route_changes=route_changes,
                active_nodes_count=active_nodes_count,
                active_links_count=active_links_count,
            )

        if distances.get(destination, float("inf")) == float("inf"):
            route_changes.append(f"Destination '{destination}' is completely UNREACHABLE from '{source}'.")
            return RouteCalculationResult(
                source=source,
                destination=destination,
                reachable=False,
                total_cost=float("inf"),
                selected_path=[],
                hop_list=[],
                next_hop=None,
                primary_path=primary_path,
                alternate_path_selected=False,
                route_changes=route_changes,
                active_nodes_count=active_nodes_count,
                active_links_count=active_links_count,
            )

        # Reconstruct path from destination to source
        selected_path: List[str] = []
        curr = destination
        while curr is not None:
            selected_path.append(curr)
            curr = previous.get(curr)
        selected_path.reverse()

        # Build hop breakdown
        hop_list: List[RouteHop] = []
        cum_cost = 0.0
        for i in range(len(selected_path) - 1):
            u_node = selected_path[i]
            v_node = selected_path[i + 1]
            edge = previous_edge.get(v_node)
            hop_cost = edge.cost if edge else 1.0
            cum_cost += hop_cost
            hop_list.append(
                RouteHop(
                    step=i + 1,
                    from_node=u_node,
                    to_node=v_node,
                    link_id=edge.link_id if edge else None,
                    cost=hop_cost,
                    cumulative_cost=cum_cost,
                    latency_ms=edge.latency if edge else 0.0,
                    link_type=edge.link_type if edge else "ordinary",
                )
            )

        # Determine next-hop
        next_hop = selected_path[1] if len(selected_path) > 1 else None

        # Check if alternate path was selected due to failures
        alternate_path_selected = False
        if primary_path and selected_path != primary_path:
            alternate_path_selected = True
            divergence = set(primary_path) - set(selected_path)
            route_changes.append(
                f"Primary path disrupted due to offline components {list(divergence)}; "
                f"dynamic recalculation established alternate route via {len(selected_path) - 1} hops."
            )

        return RouteCalculationResult(
            source=source,
            destination=destination,
            reachable=True,
            total_cost=round(distances[destination], 2),
            selected_path=selected_path,
            hop_list=hop_list,
            next_hop=next_hop,
            primary_path=primary_path,
            alternate_path_selected=alternate_path_selected,
            route_changes=route_changes,
            active_nodes_count=active_nodes_count,
            active_links_count=active_links_count,
        )

    def generate_routing_table(self, source_node_id: str) -> Dict[str, RoutingTableEntry]:
        """
        Generate full OSPF-style routing table for a given router or endpoint.
        Returns next-hop and cost to all destinations in the topology.
        """
        failed_nodes = {n for n, d in self.nodes.items() if d.get("status") == "offline"}
        failed_links = {l for l, d in self.links_by_id.items() if d.operational_state == "DOWN"}

        distances, previous, _ = self._dijkstra(source_node_id, failed_nodes, failed_links)

        table: Dict[str, RoutingTableEntry] = {}
        for dest in self.nodes:
            if dest == source_node_id:
                table[dest] = RoutingTableEntry(
                    destination=dest,
                    next_hop="DIRECT",
                    cost=0.0,
                    total_hops=0,
                    path=[dest],
                    reachable=True,
                )
                continue

            if distances.get(dest, float("inf")) == float("inf"):
                table[dest] = RoutingTableEntry(
                    destination=dest,
                    next_hop=None,
                    cost=None,
                    total_hops=0,
                    path=[],
                    reachable=False,
                )
                continue

            # Trace path
            path: List[str] = []
            curr: Optional[str] = dest
            while curr is not None:
                path.append(curr)
                curr = previous.get(curr)
            path.reverse()

            next_hop = path[1] if len(path) > 1 else None
            table[dest] = RoutingTableEntry(
                destination=dest,
                next_hop=next_hop,
                cost=round(distances[dest], 2),
                total_hops=len(path) - 1,
                path=path,
                reachable=True,
            )

        return table

    def check_reachability(self, source: str, destination: str) -> bool:
        """Verify reachability between two points in the network."""
        res = self.calculate_shortest_path(source, destination)
        return res.reachable

    # -------------------------------------------------------------
    # PHASE 4: Multi-Algorithm Routing & Comparative Analysis Suite
    # -------------------------------------------------------------

    def _get_active_graph(
        self,
        failed_node_ids: Set[str],
        failed_link_ids: Set[str],
    ) -> Tuple[List[str], List[Tuple[str, str, float, LinkEdge]]]:
        """
        Extract active operational nodes and directed edges.
        """
        active_nodes = [
            n for n, d in self.nodes.items()
            if n not in failed_node_ids and d.get("status") != "offline"
        ]
        active_edges: List[Tuple[str, str, float, LinkEdge]] = []

        for u in active_nodes:
            for v, edges in self.adjacency.get(u, {}).items():
                if v not in active_nodes:
                    continue
                for edge in edges:
                    if edge.link_id in failed_link_ids or edge.operational_state == "DOWN":
                        continue
                    cost = edge.cost * (2.0 if edge.operational_state == "DEGRADED" else 1.0)
                    active_edges.append((u, v, cost, edge))

        return active_nodes, active_edges

    def bellman_ford(
        self,
        source: str,
        destination: str,
        failed_node_ids: Optional[Set[str]] = None,
        failed_link_ids: Optional[Set[str]] = None,
    ) -> Tuple[bool, float, List[str], float, str]:
        """
        Bellman-Ford single-source shortest path algorithm.
        Relaxes all |E| edges |V|-1 times, detects negative cycles,
        and validates that non-negative link costs are maintained.
        Returns: (reachable, total_cost, path, execution_time_ms, notes)
        """
        t0 = time.perf_counter_ns()
        failed_nodes = set(failed_node_ids or [])
        failed_links = set(failed_link_ids or [])

        active_nodes, active_edges = self._get_active_graph(failed_nodes, failed_links)

        if source not in active_nodes or destination not in active_nodes:
            elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0
            return False, float("inf"), [], elapsed, "Source or destination is inactive/failed."

        # Verify non-negative weights
        for u, v, cost, _ in active_edges:
            if cost < 0:
                elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0
                return False, float("inf"), [], elapsed, f"Negative link cost ({cost}) rejected in network simulation."

        distances: Dict[str, float] = {n: float("inf") for n in active_nodes}
        previous: Dict[str, Optional[str]] = {n: None for n in active_nodes}
        distances[source] = 0.0

        v_count = len(active_nodes)
        early_terminated = False
        passes_performed = 0

        # Relax edges up to |V| - 1 times
        for pass_idx in range(v_count - 1):
            changed = False
            passes_performed += 1
            for u, v, cost, _ in active_edges:
                if distances[u] != float("inf") and distances[u] + cost < distances[v]:
                    distances[v] = distances[u] + cost
                    previous[v] = u
                    changed = True
            if not changed:
                early_terminated = True
                break

        # Negative-cycle check pass
        negative_cycle = False
        for u, v, cost, _ in active_edges:
            if distances[u] != float("inf") and distances[u] + cost < distances[v]:
                negative_cycle = True
                break

        elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0

        if negative_cycle:
            return False, float("inf"), [], elapsed, "Negative cycle detected in graph."

        if distances.get(destination, float("inf")) == float("inf"):
            return False, float("inf"), [], elapsed, "Destination unreachable."

        # Reconstruct path
        path: List[str] = []
        curr: Optional[str] = destination
        while curr is not None:
            path.append(curr)
            curr = previous.get(curr)
        path.reverse()

        note = f"Converged in {passes_performed} pass(es) over {len(active_edges)} directed edges"
        if early_terminated:
            note += " (early termination via distance stability)."
        else:
            note += f" (full {v_count - 1} relaxation passes completed)."

        return True, round(distances[destination], 3), path, round(elapsed, 4), note

    def floyd_warshall(
        self,
        failed_node_ids: Optional[Set[str]] = None,
        failed_link_ids: Optional[Set[str]] = None,
    ) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, Optional[str]]], float, str, Dict[str, Any]]:
        """
        Floyd-Warshall all-pairs shortest path dynamic programming algorithm.
        Computes all-pairs distances and path reconstruction matrices.
        Returns: (dist_matrix, next_hop_matrix, execution_time_ms, scalability_warning, summary)
        """
        t0 = time.perf_counter_ns()
        failed_nodes = set(failed_node_ids or [])
        failed_links = set(failed_link_ids or [])

        active_nodes, active_edges = self._get_active_graph(failed_nodes, failed_links)

        dist: Dict[str, Dict[str, float]] = {u: {v: float("inf") for v in active_nodes} for u in active_nodes}
        next_hop: Dict[str, Dict[str, Optional[str]]] = {u: {v: None for v in active_nodes} for u in active_nodes}

        for u in active_nodes:
            dist[u][u] = 0.0

        for u, v, cost, _ in active_edges:
            if cost < dist[u][v]:
                dist[u][v] = cost
                next_hop[u][v] = v

        # Triple loop: O(V^3)
        for k in active_nodes:
            d_k = dist[k]
            for i in active_nodes:
                d_i_k = dist[i][k]
                if d_i_k == float("inf"):
                    continue
                d_i = dist[i]
                next_i = next_hop[i]
                for j in active_nodes:
                    cand = d_i_k + d_k[j]
                    if cand < d_i[j]:
                        d_i[j] = cand
                        next_i[j] = next_i[k]

        elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0

        # Compute summary statistics
        connected_pairs = 0
        max_dist = 0.0
        total_possible = len(active_nodes) * (len(active_nodes) - 1) if len(active_nodes) > 1 else 1
        for u in active_nodes:
            for v in active_nodes:
                if u != v and dist[u][v] < float("inf"):
                    connected_pairs += 1
                    if dist[u][v] > max_dist:
                        max_dist = dist[u][v]

        summary = {
            "active_nodes_count": len(active_nodes),
            "connected_directed_pairs": connected_pairs,
            "total_possible_pairs": total_possible,
            "network_diameter_hops_cost": max_dist,
            "connectivity_ratio_pct": round((connected_pairs / total_possible) * 100.0, 2) if total_possible > 0 else 100.0,
        }

        scalability_warning = (
            f"O(|V|^3) computational growth ({len(active_nodes)}^3 = {len(active_nodes)**3:,} inner-loop iterations). "
            "Ideal for centralized topological audit, routing-matrix validation, and network diameter extraction, "
            "but computationally unsuited for high-churn distributed router CPU engines."
        )

        return dist, next_hop, round(elapsed, 4), scalability_warning, summary

    def reconstruct_floyd_warshall_path(
        self,
        u: str,
        v: str,
        dist: Dict[str, Dict[str, float]],
        next_hop: Dict[str, Dict[str, Optional[str]]],
    ) -> List[str]:
        """Reconstruct path from u to v using Floyd-Warshall next-hop matrix."""
        if u not in dist or v not in dist:
            return []
        if dist[u].get(v, float("inf")) == float("inf"):
            return []
        if u == v:
            return [u]

        path = [u]
        curr = u
        visited = {u}
        while curr != v:
            nxt = next_hop.get(curr, {}).get(v)
            if not nxt or nxt in visited:
                break
            visited.add(nxt)
            path.append(nxt)
            curr = nxt

        return path if path[-1] == v else []

    def yen_k_shortest_paths(
        self,
        source: str,
        destination: str,
        K: int = 3,
        failed_node_ids: Optional[Set[str]] = None,
        failed_link_ids: Optional[Set[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Yen's algorithm for finding the top K shortest loopless paths.
        Enables deterministic discovery of primary and alternative backup routes.
        Returns: (ranked_paths, execution_time_ms)
        """
        t0 = time.perf_counter_ns()
        failed_nodes = set(failed_node_ids or [])
        failed_links = set(failed_link_ids or [])

        for nid, node in self.nodes.items():
            if node.get("status") == "offline":
                failed_nodes.add(nid)
        for lid, link in self.links_by_id.items():
            if link.operational_state == "DOWN":
                failed_links.add(lid)

        # Helper Dijkstra on specific graph subset
        def run_custom_dijkstra(
            src: str,
            dst: str,
            temp_banned_nodes: Set[str],
            temp_banned_links: Set[Tuple[str, str]],
        ) -> Tuple[Optional[List[str]], float]:
            dists: Dict[str, float] = {n: float("inf") for n in self.nodes}
            prev: Dict[str, Optional[str]] = {n: None for n in self.nodes}

            if src in temp_banned_nodes or dst in temp_banned_nodes:
                return None, float("inf")

            dists[src] = 0.0
            pq = [(0.0, src)]

            while pq:
                d, u = heapq.heappop(pq)
                if d > dists[u]:
                    continue
                if u == dst:
                    break

                for v, edges in self.adjacency.get(u, {}).items():
                    if v in temp_banned_nodes or self.nodes.get(v, {}).get("status") == "offline":
                        continue
                    if (u, v) in temp_banned_links:
                        continue

                    # Best valid edge between u and v
                    best_edge_cost = float("inf")
                    for e in edges:
                        if e.link_id in failed_links or e.operational_state == "DOWN":
                            continue
                        c = e.cost * (2.0 if e.operational_state == "DEGRADED" else 1.0)
                        if c < best_edge_cost:
                            best_edge_cost = c

                    if best_edge_cost == float("inf"):
                        continue

                    cand = d + best_edge_cost
                    if cand < dists[v]:
                        dists[v] = cand
                        prev[v] = u
                        heapq.heappush(pq, (cand, v))

            if dists[dst] == float("inf"):
                return None, float("inf")

            p: List[str] = []
            curr: Optional[str] = dst
            while curr is not None:
                p.append(curr)
                curr = prev.get(curr)
            p.reverse()
            return p, round(dists[dst], 3)

        # 1. First shortest path
        p0, cost0 = run_custom_dijkstra(source, destination, failed_nodes, set())
        if not p0:
            elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0
            return [], round(elapsed, 4)

        A: List[Tuple[List[str], float]] = [(p0, cost0)]
        B: List[Tuple[float, List[str]]] = []  # Candidate min-heap

        for k in range(1, K):
            prev_path, _ = A[k - 1]
            for i in range(len(prev_path) - 1):
                spur_node = prev_path[i]
                root_path = prev_path[: i + 1]

                # Temporarily ban edges that were used by previous paths sharing same root path
                banned_edges: Set[Tuple[str, str]] = set()
                for path, _ in A:
                    if len(path) > i and path[: i + 1] == root_path:
                        banned_edges.add((path[i], path[i + 1]))

                # Ban nodes in root_path except spur_node to guarantee loopless paths
                banned_nodes = failed_nodes | set(root_path[:-1])

                spur_path, _ = run_custom_dijkstra(spur_node, destination, banned_nodes, banned_edges)
                if spur_path:
                    total_p = root_path[:-1] + spur_path
                    # Calculate exact path cost
                    _, total_c = run_custom_dijkstra(source, destination, set(failed_nodes), set())
                    # Compute actual cost for total_p
                    cost_sum = 0.0
                    valid_cost = True
                    for step_idx in range(len(total_p) - 1):
                        u_hop, v_hop = total_p[step_idx], total_p[step_idx + 1]
                        min_hop_c = float("inf")
                        for e in self.adjacency.get(u_hop, {}).get(v_hop, []):
                            if e.link_id not in failed_links and e.operational_state != "DOWN":
                                hc = e.cost * (2.0 if e.operational_state == "DEGRADED" else 1.0)
                                if hc < min_hop_c:
                                    min_hop_c = hc
                        if min_hop_c == float("inf"):
                            valid_cost = False
                            break
                        cost_sum += min_hop_c

                    if valid_cost:
                        cost_sum = round(cost_sum, 3)
                        # Avoid duplicates in B and A
                        if total_p not in [p for p, _ in A] and total_p not in [p for _, p in B]:
                            heapq.heappush(B, (cost_sum, total_p))

            if not B:
                break

            lowest_c, lowest_p = heapq.heappop(B)
            A.append((lowest_p, lowest_c))

        elapsed = (time.perf_counter_ns() - t0) / 1_000_000.0

        ranked_results: List[Dict[str, Any]] = []
        role_names = [
            "Primary Shortest Path",
            "1st Alternative Backup Route",
            "2nd Alternative Backup Route",
            "3rd Alternative Backup Route",
        ]

        for idx, (path, cost) in enumerate(A):
            role = role_names[idx] if idx < len(role_names) else f"{idx}th Alternative Route"
            ranked_results.append({
                "rank": idx + 1,
                "path": path,
                "total_cost": cost,
                "hop_count": len(path) - 1,
                "role": role,
                "valid_after_failure": True,
            })

        return ranked_results, round(elapsed, 4)

    def compare_algorithms(
        self,
        source: str,
        destination: str,
        K: int = 3,
        failed_node_ids: Optional[List[str]] = None,
        failed_link_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute and compare Dijkstra, Bellman-Ford, Floyd-Warshall, and Yen's K-Shortest
        on the exact same network topology and failure conditions.
        Distinguishes algorithm computation time from network convergence time.
        """
        fn_set = set(failed_node_ids or [])
        fl_set = set(failed_link_ids or [])

        # Include natively offline
        for nid, node in self.nodes.items():
            if node.get("status") == "offline":
                fn_set.add(nid)
        for lid, link in self.links_by_id.items():
            if link.operational_state == "DOWN":
                fl_set.add(lid)

        active_nodes_count = len(self.nodes) - len([n for n in self.nodes if n in fn_set])
        active_links_count = len(self.links_by_id) - len([l for l in self.links_by_id if l in fl_set])

        # 1. Dijkstra
        t_dijkstra_0 = time.perf_counter_ns()
        dijkstra_res = self.calculate_shortest_path(source, destination, list(fn_set), list(fl_set))
        t_dijkstra = (time.perf_counter_ns() - t_dijkstra_0) / 1_000_000.0

        # 2. Bellman-Ford
        bf_reachable, bf_cost, bf_path, bf_time, bf_note = self.bellman_ford(
            source, destination, fn_set, fl_set
        )

        # 3. Floyd-Warshall
        fw_dist, fw_next, fw_time, fw_warning, fw_summary = self.floyd_warshall(
            fn_set, fl_set
        )
        fw_path = self.reconstruct_floyd_warshall_path(source, destination, fw_dist, fw_next)
        fw_cost = fw_dist.get(source, {}).get(destination, float("inf"))
        fw_reachable = fw_cost < float("inf")

        # 4. Yen's K-Shortest
        yen_ranked, yen_time = self.yen_k_shortest_paths(
            source, destination, K=K, failed_node_ids=fn_set, failed_link_ids=fl_set
        )

        comparisons = [
            {
                "algorithm_key": "dijkstra",
                "algorithm_name": "Dijkstra SPF (OSPF Standard)",
                "path": dijkstra_res.selected_path if dijkstra_res.reachable else [],
                "total_cost": dijkstra_res.total_cost if dijkstra_res.reachable else None,
                "hop_count": len(dijkstra_res.selected_path) - 1 if dijkstra_res.reachable else 0,
                "reachable": dijkstra_res.reachable,
                "execution_time_ms": round(t_dijkstra, 4),
                "time_complexity": "O((|V| + |E|) log |V|)",
                "space_complexity": "O(|V| + |E|)",
                "purpose": "Link-State routing foundation (OSPF/IS-IS) calculating single-source shortest paths on non-negative weighted graphs.",
                "assumptions": "All edge costs w(u,v) >= 0. Greedy optimal substructure with min-heap priority queue.",
                "scalability_warning": None,
                "is_optimal": True,
                "ranked_alternatives": None,
            },
            {
                "algorithm_key": "bellman_ford",
                "algorithm_name": "Bellman-Ford (Distance Vector)",
                "path": bf_path,
                "total_cost": bf_cost if bf_reachable else None,
                "hop_count": len(bf_path) - 1 if bf_reachable else 0,
                "reachable": bf_reachable,
                "execution_time_ms": bf_time,
                "time_complexity": "O(|V| * |E|)",
                "space_complexity": "O(|V|)",
                "purpose": "Distance-Vector routing basis (RIP/BGP-path). Relaxes edges |V|-1 times and validates non-negative metrics.",
                "assumptions": "Supports negative edges in general graphs, but network links must remain non-negative metrics. Detects negative cycles.",
                "scalability_warning": f"Higher time complexity than Dijkstra. Performs up to {len(self.nodes) - 1} passes.",
                "is_optimal": True,
                "ranked_alternatives": None,
            },
            {
                "algorithm_key": "floyd_warshall",
                "algorithm_name": "Floyd-Warshall (All-Pairs Dynamic Programming)",
                "path": fw_path,
                "total_cost": round(fw_cost, 3) if fw_reachable else None,
                "hop_count": len(fw_path) - 1 if fw_reachable else 0,
                "reachable": fw_reachable,
                "execution_time_ms": fw_time,
                "time_complexity": "O(|V|^3)",
                "space_complexity": "O(|V|^2)",
                "purpose": "All-pairs shortest paths computed simultaneously via dynamic programming matrix relaxation.",
                "assumptions": "Centralized topological model with dense connectivity. Calculates paths between every node pair simultaneously.",
                "scalability_warning": fw_warning,
                "is_optimal": True,
                "ranked_alternatives": None,
            },
            {
                "algorithm_key": "yen_k_shortest",
                "algorithm_name": f"Yen's K-Shortest Loopless Paths (K={K})",
                "path": yen_ranked[0]["path"] if yen_ranked else [],
                "total_cost": yen_ranked[0]["total_cost"] if yen_ranked else None,
                "hop_count": yen_ranked[0]["hop_count"] if yen_ranked else 0,
                "reachable": len(yen_ranked) > 0,
                "execution_time_ms": yen_time,
                "time_complexity": f"O(K * |V| * (|E| + |V| log |V|))",
                "space_complexity": "O(K * |V| + |E|)",
                "purpose": "Precomputes ranked alternative backup paths for instant failover during catastrophic link or node outages.",
                "assumptions": "Deviates spur paths systematically to ensure all alternative paths are strictly loopless.",
                "scalability_warning": "Runs multiple Dijkstra iterations per spur node; ideal for mission-critical pre-computed failover routes.",
                "is_optimal": True,
                "ranked_alternatives": yen_ranked,
            },
        ]

        educational_notes = (
            "ENGINEERING NOTICE: Algorithm computation time (CPU execution in microseconds) is distinct from network convergence "
            "and end-to-end recovery time. In a physical or simulated mesh, total recovery incorporates failure detection "
            "(dead-timer/BFD, 10-50ms), LSA flood propagation (5-15ms), SPF calculation (0.01-0.1ms), FIB hardware update "
            "(2-10ms), and packet queue draining. Dijkstra and Bellman-Ford produce identical optimal paths on non-negative "
            "topologies, while Yen's algorithm provides vital ranked loopless alternative routes for resilient disaster recovery."
        )

        return {
            "source": source,
            "destination": destination,
            "active_nodes_count": active_nodes_count,
            "active_links_count": active_links_count,
            "k_paths_requested": K,
            "algorithms": comparisons,
            "all_pairs_matrix_summary": fw_summary,
            "educational_notes": educational_notes,
            "timestamp": datetime.utcnow(),
        }

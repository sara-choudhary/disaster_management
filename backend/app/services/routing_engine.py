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

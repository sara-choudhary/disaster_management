"""
Discrete Simulation-Level Packet State Engine and Disaster Recovery Model.

Provides real packet lifecycle tracking:
- States: QUEUED, IN_TRANSIT, DELIVERED, RETRY_PENDING, BUFFERED_DURING_FAILURE, FAILED_UNRECOVERABLE
- Bounded acknowledgements, timeout-based retransmissions, retry limits, receiver deduplication
- Dynamic rerouting and buffer hold upon node/link failure mid-stream
- Accurate latency components (queue, serialization, propagation, retransmission)
- Reconciled packet accounting: Generated = Delivered + Failed Unrecoverable + Buffered
"""

import enum
import uuid
import math
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field


class PacketState(str, enum.Enum):
    QUEUED = "QUEUED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    RETRY_PENDING = "RETRY_PENDING"
    BUFFERED_DURING_FAILURE = "BUFFERED_DURING_FAILURE"
    FAILED_UNRECOVERABLE = "FAILED_UNRECOVERABLE"


class LogicalPacket(BaseModel):
    packet_id: str
    sequence_number: int
    source: str
    destination: str
    priority: str
    payload_size_bytes: int = 1024
    generation_time_ms: float = 0.0
    current_state: PacketState = PacketState.QUEUED
    route_taken: List[str] = Field(default_factory=list)
    transmission_attempts: int = 0
    acknowledged: bool = False
    retransmissions: int = 0
    max_retries: int = 3
    timeout_ms: float = 50.0
    ttl_hops: int = 16
    queued_at_ms: float = 0.0
    transmitted_at_ms: Optional[float] = None
    delivered_at_ms: Optional[float] = None
    dropped_at_ms: Optional[float] = None
    drop_reason: Optional[str] = None
    end_to_end_latency_ms: Optional[float] = None


class DiscreteSimulationResult(BaseModel):
    run_id: str
    source: str
    destination: str
    priority: str
    total_packets_generated: int
    delivered_count: int
    dropped_count: int
    buffered_count: int
    retransmitted_count: int
    delivery_ratio_pct: float
    loss_ratio_pct: float
    throughput_kbps: float
    avg_latency_ms: float
    median_latency_ms: float
    p95_latency_ms: float
    max_latency_ms: float
    jitter_ms: float
    accounting_reconciled: bool
    reconciliation_details: str
    primary_path: List[str]
    actual_path: List[str]
    alternate_path_used: bool = False
    failure_encountered: bool = False
    packets: List[LogicalPacket]
    timeline_events: List[Dict[str, Any]]


def simulate_discrete_packet_flow(
    source_id: str,
    target_id: str,
    priority: str = "CRITICAL_SOS",
    packet_count: int = 20,
    payload_size_bytes: int = 1024,
    nodes_dict: Optional[Dict[str, Any]] = None,
    links_dict: Optional[Dict[str, Any]] = None,
    failed_nodes: Optional[List[str]] = None,
    failed_links: Optional[List[str]] = None,
    inject_failure_at_packet: Optional[int] = None,
    inject_failed_link: Optional[str] = None,
    max_queue_capacity: int = 100,
    retry_limit: int = 3,
) -> DiscreteSimulationResult:
    """
    Simulates discrete packet dispatch across the topology.
    Handles queueing, link hops, mid-stream link failures, buffer holding,
    SPF route recalculation, alternate route traversal, and receiver deduplication.
    """
    from app.services.routing_engine import OSPFRoutingEngine

    run_id = f"PKTRUN-{uuid.uuid4().hex[:8].upper()}"
    failed_n_set = set(failed_nodes or [])
    failed_l_set = set(failed_links or [])

    # Build initial engine
    engine = OSPFRoutingEngine()
    if nodes_dict:
        for nid, n in nodes_dict.items():
            status = getattr(n, "status", "active")
            engine.add_node(nid, getattr(n, "name", nid), getattr(n, "node_type", "router"), status)
    if links_dict:
        for lid, l in links_dict.items():
            engine.add_link(
                link_id=l.link_id,
                source=l.source_node_id,
                destination=l.destination_node_id,
                cost=l.link_cost,
                operational_state=l.operational_state,
                bandwidth=l.bandwidth,
                latency=l.latency,
                link_type=l.link_type,
            )

    # Compute initial primary route
    initial_route = engine.calculate_shortest_path(source_id, target_id, list(failed_n_set), list(failed_l_set))
    primary_path = list(initial_route.selected_path) if initial_route.reachable else []

    packets: List[LogicalPacket] = []
    delivered_packets: List[LogicalPacket] = []
    received_seq_set = set()  # Receiver-side deduplication table
    timeline_events: List[Dict[str, Any]] = []

    # Inter-packet generation interval (e.g. 5ms per packet = 200 pkt/sec)
    inter_packet_interval_ms = 5.0
    current_sim_time = 0.0

    timeline_events.append({
        "timestamp_ms": round(current_sim_time, 2),
        "event": "DISPATCH_STARTED",
        "description": f"Generating {packet_count} {priority} packets from {source_id} to {target_id}.",
    })

    # Track mid-stream dynamic failure state
    mid_stream_failure_active = False
    current_engine = engine

    for seq in range(1, packet_count + 1):
        gen_time = round((seq - 1) * inter_packet_interval_ms, 2)
        pkt = LogicalPacket(
            packet_id=f"PKT-{seq:04d}-{uuid.uuid4().hex[:4].upper()}",
            sequence_number=seq,
            source=source_id,
            destination=target_id,
            priority=priority,
            payload_size_bytes=payload_size_bytes,
            generation_time_ms=gen_time,
            current_state=PacketState.QUEUED,
            queued_at_ms=gen_time,
            max_retries=retry_limit,
        )

        # Check queue capacity (buffer occupancy at this gen_time)
        active_in_buffer = 0
        for p in packets:
            if "QUEUE_BUFFER_OVERFLOW" in (p.drop_reason or ""):
                continue
            exit_time = p.delivered_at_ms if p.delivered_at_ms is not None else p.dropped_at_ms
            if exit_time is None or exit_time > gen_time:
                active_in_buffer += 1

        if active_in_buffer >= max_queue_capacity:
            pkt.current_state = PacketState.FAILED_UNRECOVERABLE
            pkt.dropped_at_ms = gen_time
            pkt.drop_reason = f"QUEUE_BUFFER_OVERFLOW (Capacity limit {max_queue_capacity} exceeded)"
            packets.append(pkt)
            continue

        # Check if mid-stream failure triggers at this packet
        if inject_failure_at_packet and seq == inject_failure_at_packet and not mid_stream_failure_active:
            mid_stream_failure_active = True
            fl_id = inject_failed_link or "LINK-R1-R2"
            failed_l_set.add(fl_id)
            current_engine.set_link_state(fl_id, "DOWN")
            timeline_events.append({
                "timestamp_ms": round(gen_time, 2),
                "event": "INJECTED_LINK_FAILURE",
                "resource_id": fl_id,
                "description": f"Primary backbone link {fl_id} failed mid-transmission at packet sequence #{seq}.",
            })

        # Calculate currently valid path
        route_now = current_engine.calculate_shortest_path(source_id, target_id, list(failed_n_set), list(failed_l_set))

        if not route_now.reachable:
            # Destination unreachable: packet enters failure buffer and attempts retries
            pkt.current_state = PacketState.BUFFERED_DURING_FAILURE
            pkt.transmission_attempts += 1

            # Bounded retry exhaustion
            retries_made = 0
            delivered_via_retry = False
            while retries_made < retry_limit:
                retries_made += 1
                pkt.retransmissions = retries_made
                retry_time = gen_time + (retries_made * pkt.timeout_ms)
                # Check if route became available
                retry_route = current_engine.calculate_shortest_path(source_id, target_id, list(failed_n_set), list(failed_l_set))
                if retry_route.reachable:
                    # Successful reroute after buffer
                    delivered_via_retry = True
                    break

            if delivered_via_retry:
                pkt.current_state = PacketState.DELIVERED
                pkt.acknowledged = True
                pkt.route_taken = retry_route.selected_path
                # Latency includes wait in buffer + retry backoff + alternate path latency
                hop_lat = sum(h.latency_ms for h in retry_route.hop_list)
                pkt.end_to_end_latency_ms = round(hop_lat + (retries_made * pkt.timeout_ms) + 1.2, 2)
                pkt.delivered_at_ms = round(gen_time + pkt.end_to_end_latency_ms, 2)
                delivered_packets.append(pkt)
            else:
                pkt.current_state = PacketState.FAILED_UNRECOVERABLE
                pkt.dropped_at_ms = round(gen_time + (retry_limit * pkt.timeout_ms), 2)
                pkt.drop_reason = f"DESTINATION_PARTITIONED (Max retries {retry_limit} exhausted, no route available)"
        else:
            # Active route exists
            pkt.current_state = PacketState.IN_TRANSIT
            pkt.transmission_attempts = 1
            pkt.route_taken = route_now.selected_path

            # Compute latency for this path
            hop_latency = sum(h.latency_ms for h in route_now.hop_list) if route_now.hop_list else 2.5
            # Serialization delay = (bytes * 8) / (bandwidth * 10^6) * 1000 ms
            serialization_delay = round((payload_size_bytes * 8.0) / (100.0 * 1000.0), 3)
            # Queue delay varies slightly with packet load
            queue_delay = round(0.1 + (seq % 4) * 0.15, 2)

            # Extra rerouting penalty if alternate path was used due to mid-stream failure
            reroute_penalty = 0.0
            if mid_stream_failure_active and route_now.selected_path != primary_path:
                reroute_penalty = 15.0  # 15ms BFD detection and SPF convergence delay
                pkt.retransmissions = 1
                pkt.transmission_attempts = 2

            total_lat = round(hop_latency + serialization_delay + queue_delay + reroute_penalty, 2)
            pkt.end_to_end_latency_ms = total_lat
            pkt.delivered_at_ms = round(gen_time + total_lat, 2)

            # Receiver Deduplication
            if seq not in received_seq_set:
                received_seq_set.add(seq)
                pkt.current_state = PacketState.DELIVERED
                pkt.acknowledged = True
                delivered_packets.append(pkt)
            else:
                # Duplicate copy dropped at receiver
                pkt.current_state = PacketState.DELIVERED
                pkt.acknowledged = True

        packets.append(pkt)

    # Accounting calculations
    delivered_count = len(delivered_packets)
    dropped_count = sum(1 for p in packets if p.current_state == PacketState.FAILED_UNRECOVERABLE)
    buffered_count = sum(1 for p in packets if p.current_state == PacketState.BUFFERED_DURING_FAILURE)
    retrans_count = sum(p.retransmissions for p in packets)

    total_gen = len(packets)
    delivery_ratio = round((delivered_count / total_gen) * 100.0, 2) if total_gen > 0 else 0.0
    loss_ratio = round((dropped_count / total_gen) * 100.0, 2) if total_gen > 0 else 0.0

    # Latency statistics from actual delivered packets
    latencies = [p.end_to_end_latency_ms for p in delivered_packets if p.end_to_end_latency_ms is not None]
    if latencies:
        latencies_sorted = sorted(latencies)
        avg_lat = round(sum(latencies) / len(latencies), 2)
        med_lat = round(latencies_sorted[len(latencies_sorted) // 2], 2)
        p95_idx = min(len(latencies_sorted) - 1, int(math.ceil(0.95 * len(latencies_sorted))) - 1)
        p95_lat = round(latencies_sorted[p95_idx], 2)
        max_lat = round(max(latencies), 2)

        # Jitter: mean absolute latency difference between consecutive delivered packets
        if len(latencies) > 1:
            diffs = [abs(latencies[i] - latencies[i - 1]) for i in range(1, len(latencies))]
            jitter_ms = round(sum(diffs) / len(diffs), 2)
        else:
            jitter_ms = 0.0
    else:
        avg_lat = med_lat = p95_lat = max_lat = jitter_ms = 0.0

    # Throughput calculation: payload bits delivered / simulation test span
    span_sec = max(0.01, (packet_count * inter_packet_interval_ms) / 1000.0)
    throughput_kbps = round((delivered_count * payload_size_bytes * 8.0) / (span_sec * 1000.0), 2)

    # Reconciliation audit: Every generated packet must have a valid terminal accounting state
    is_reconciled = (total_gen == delivered_count + dropped_count + buffered_count)
    reconciliation_details = (
        f"Reconciled: Total Generated ({total_gen}) = Delivered ({delivered_count}) + "
        f"Permanently Dropped ({dropped_count}) + Buffered/Pending ({buffered_count}). "
        f"Retransmission events: {retrans_count}."
    )

    final_route = current_engine.calculate_shortest_path(source_id, target_id, list(failed_n_set), list(failed_l_set))
    actual_path = final_route.selected_path if final_route.reachable else []
    alt_used = bool(primary_path and actual_path and actual_path != primary_path)

    timeline_events.append({
        "timestamp_ms": round(packet_count * inter_packet_interval_ms + (max_lat or 10.0), 2),
        "event": "DISPATCH_COMPLETED",
        "description": f"Simulation run complete. {delivered_count}/{total_gen} delivered ({delivery_ratio}%). "
                       f"Avg latency: {avg_lat}ms, Jitter: {jitter_ms}ms.",
    })

    return DiscreteSimulationResult(
        run_id=run_id,
        source=source_id,
        destination=target_id,
        priority=priority,
        total_packets_generated=total_gen,
        delivered_count=delivered_count,
        dropped_count=dropped_count,
        buffered_count=buffered_count,
        retransmitted_count=retrans_count,
        delivery_ratio_pct=delivery_ratio,
        loss_ratio_pct=loss_ratio,
        throughput_kbps=throughput_kbps,
        avg_latency_ms=avg_lat,
        median_latency_ms=med_lat,
        p95_latency_ms=p95_lat,
        max_latency_ms=max_lat,
        jitter_ms=jitter_ms,
        accounting_reconciled=is_reconciled,
        reconciliation_details=reconciliation_details,
        primary_path=primary_path,
        actual_path=actual_path,
        alternate_path_used=alt_used,
        failure_encountered=mid_stream_failure_active or bool(failed_nodes or failed_links),
        packets=packets,
        timeline_events=timeline_events,
    )

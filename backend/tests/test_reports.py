import json
import pytest


def test_get_summary_report(client):
    response = client.get("/api/v1/reports/summary")
    assert response.status_code == 200
    data = response.json()

    # Core summary metrics
    assert "total_nodes" in data
    assert "network_health_score" in data
    assert "total_simulation_runs" in data

    # 7 Concise Summary Domains
    assert "concise_summary" in data
    concise = data["concise_summary"]
    assert "network_availability_pct" in concise
    assert "failed_resources" in concise
    assert isinstance(concise["failed_resources"], list)
    assert "alternate_route_selected_count" in concise
    assert "recovery_result" in concise
    assert "packet_delivery_statistics" in concise
    assert "security_events_count" in concise
    assert "qos_observations" in concise

    # Direct top-level concise access fields
    assert "network_availability_pct" in data
    assert "failed_resources" in data
    assert "alternate_route_selected_count" in data
    assert "recovery_result" in data
    assert "packet_delivery_statistics" in data
    assert "security_events_count" in data
    assert "qos_observations" in data


def test_get_simulation_history_pagination(client):
    response = client.get("/api/v1/reports/history?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()

    assert "total_count" in data
    assert "page" in data
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert "total_pages" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    if data["items"]:
        item = data["items"][0]
        assert "run_id" in item
        assert "scenario_name" in item
        assert "start_time" in item
        assert "final_outcome" in item
        assert "recovery_duration_sec" in item
        assert "packets_sent" in item
        assert "packets_delivered" in item
        assert "packets_lost" in item
        assert "delivery_ratio_pct" in item


def test_get_simulation_history_search_and_filter(client):
    # Test status filter
    res_success = client.get("/api/v1/reports/history?status=SUCCESS")
    assert res_success.status_code == 200
    success_data = res_success.json()
    for item in success_data["items"]:
        assert item["final_outcome"] == "SUCCESS"

    # Test search query
    res_search = client.get("/api/v1/reports/history?search=SIM-")
    assert res_search.status_code == 200
    search_data = res_search.json()
    for item in search_data["items"]:
        assert "SIM-" in item["run_id"] or "sim-" in item["run_id"].lower()


def test_get_simulation_run_report(client):
    # Fetch list first to get a valid run_id
    history_res = client.get("/api/v1/reports/history?page=1&page_size=1")
    history_data = history_res.json()
    assert history_data["items"], "Expected seeded simulation runs"
    valid_run_id = history_data["items"][0]["run_id"]

    # Request report
    report_res = client.get(f"/api/v1/reports/simulations/{valid_run_id}")
    assert report_res.status_code == 200
    report = report_res.json()

    assert report["run_id"] == valid_run_id
    assert "status" in report
    assert "duration_seconds" in report
    assert "initial_topology" in report
    assert "final_topology" in report
    assert "route_changes" in report
    assert "events_triggered" in report
    assert "alerts_triggered" in report
    assert "packet_statistics" in report
    assert "resilience_score" in report
    assert "assessment" in report


def test_get_simulation_run_report_not_found(client):
    res = client.get("/api/v1/reports/simulations/NONEXISTENT-RUN-999")
    assert res.status_code == 404


def test_export_simulation_history_csv(client):
    res = client.get("/api/v1/reports/export/csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=simulation_history.csv" in res.headers.get("content-disposition", "")

    csv_text = res.text
    lines = csv_text.strip().split("\r\n") if "\r\n" in csv_text else csv_text.strip().split("\n")
    assert len(lines) >= 2, "Expected header and at least one data row"

    header = lines[0]
    assert "Run ID" in header
    assert "Scenario Name" in header
    assert "Start Time" in header
    assert "Final Outcome" in header
    assert "Recovery Duration" in header
    assert "Packets Sent" in header
    assert "Packets Delivered" in header
    assert "Packets Lost" in header
    assert "Delivery Ratio" in header


def test_export_simulation_detail_json(client):
    # Fetch list first to get a valid run_id
    history_res = client.get("/api/v1/reports/history?page=1&page_size=1")
    history_data = history_res.json()
    valid_run_id = history_data["items"][0]["run_id"]

    res = client.get(f"/api/v1/reports/export/json/{valid_run_id}")
    assert res.status_code == 200
    assert "application/json" in res.headers["content-type"]
    assert f"attachment; filename=simulation_{valid_run_id}.json" in res.headers.get("content-disposition", "")

    detail_data = json.loads(res.text)
    assert detail_data["run_id"] == valid_run_id
    assert "initial_topology" in detail_data
    assert "final_topology" in detail_data
    assert "events_triggered" in detail_data

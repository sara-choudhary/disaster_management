# End-to-End Operational Demonstration Guide

## Educational Simulation Notice
> [!NOTE]
> This application is an educational network simulation and engineering modeling tool. It demonstrates OSPF-inspired Dijkstra routing, priority-queued Quality of Service (QoS), departmental VLAN segmentation, and automated fault recovery. It is **not** a physical Cisco IOS or hardware router controller. All performance values and timing recovery metrics are deterministically computed software estimates.

---

## Team Members
- **Aahaan Kothari** — 24BDS0273
- **Sara Choudhary** — 24BCT0219
- **Aryan Verma** — 24BCT0223

---

## 12-Step Complete System Walkthrough

Follow this 12-step operational procedure to demonstrate the full capabilities of the emergency communication platform:

### Step 1: Open the Landing Page
1. Direct your browser to `http://localhost:5173/`.
2. **Observe**:
   - Clean, uncluttered pastel emergency-operations interface.
   - Centered project title: *"Disaster-Resistant Emergency Communication Network with Priority Routing"*.
   - Subtle shield background watermark.
   - Single prominent rectangular action button: **Explore Dashboard**.
   - Header with calm, solid status indicators (`Live Feed Active` and `System Active`).
   - The hamburger navigation drawer is **hidden by default** to preserve visual focus.

### Step 2: Navigate to the Emergency Dashboard
1. Click the **Explore Dashboard** button (or open the hamburger drawer and select **Overview**).
2. The URL changes to `http://localhost:5173/dashboard`.
3. **Observe**:
   - The 5 high-level operational metric sections at the top:
     1. **Network Availability**: Reflects real-time baseline health score (e.g. 100.0%).
     2. **Reachable Departments**: 7 of 7 departments online.
     3. **Active Backbone Links**: Number of operational inter-router and access links.
     4. **Critical Alerts**: Active unacknowledged emergency incidents.
     5. **Modeled Recovery Duration**: Estimated BFD + SPF + FIB convergence speed.
   - High-resolution SVG topology canvas showing 4 core routers (`ROUTER-01` to `04`), 7 departmental access switches (`SW-ECC` to `SW-BACKUP`), emergency stations, and microwave relays.

### Step 3: Verify Normal Baseline Connectivity
1. On the Dashboard, review the **Reachable Stations** matrix.
2. Confirm that all 7 municipal departments (Emergency Control Center, Police, Fire, Hospital, Ambulance, Relief Camp, Backup Control Center) are operational and reachable.
3. Verify that the 4 top action buttons are ready:
   - `Run Connectivity Test`
   - `Simulate Primary Link Failure` (highlighted in dusty rose)
   - `Restore Network`
   - `Open Scenario Runner`

### Step 4: Select a Source and Destination for Route Analysis
1. In the **Route Inspection & Path Trace** panel below the topology, select:
   - **Source**: `ROUTER-01` (or `HQ-COMMAND-01`)
   - **Destination**: `ROUTER-02` (or `HOSPITAL-TRIAGE-03`)
2. **Observe**:
   - The topology map highlights the optimal OSPF shortest-path in cerulean.
   - Path Trace displays direct traversal: `ROUTER-01 -> ROUTER-02` (Total cost: 1.0, 1 hop).
   - Tag states: `OPTIMAL ROUTE • 1 HOP`.

### Step 5: Inject Primary-Link Failure
1. Click the **Simulate Primary Link Failure** button on the dashboard (or click link `LINK-R1-R2` directly on the topology canvas and click **Sever / Fail Link**).
2. **Observe**:
   - Link `LINK-R1-R2` transitions to a dashed red/critical state labeled `DOWN`.
   - A real-time toast notification announces the failure injection: *"Primary backbone link LINK-R1-R2 severed."*
   - A `LINK_FAILURE` critical alert is automatically generated in the backend database.
   - Modeled recovery metrics appear in the inspector:
     - Detection Delay: `45.0 ms` (BFD 3x 15ms keepalive)
     - SPF Calculation: `~8.0 ms` (Dijkstra recomputation)
     - Hardware FIB Update: `12.0 ms`
     - Total Recovery Time: `~0.068 s`

### Step 6: Verify Alternate-Path Selection
1. Immediately observe the **Route Inspection** panel for `ROUTER-01` to `ROUTER-02`.
2. **Observe**:
   - The path has dynamically rerouted around the severed link.
   - The selected route now traverses surviving relays: `ROUTER-01 -> ROUTER-04 -> ROUTER-02` (or via `ROUTER-03`).
   - The badge updates to: `ALTERNATE ROUTE (DETOUR) • 2 HOPS`.
   - The path cost increases from `1.0` to `2.0` (or `3.0`), accurately reflecting the secondary detour.

### Step 7: Inspect Recovery Metrics and Forensic Events
1. In the Dashboard's **Recent Network Events** panel, note the new entries:
   - `LINK_FAILURE`: `LINK-R1-R2 severed due to simulated administrative drill.`
   - `ROUTE_RECALCULATION`: `Primary path disrupted; alternate route established.`
2. Open the hamburger menu and select **Alerts & Events** (`/alerts`).
3. Confirm that the new incident appears with timestamp, severity `CRITICAL`, category `CONNECTIVITY`, and affected resource `LINK-R1-R2`.
4. Click **Acknowledge** on the alert. Note that the status updates in place and persists to the database.

### Step 8: Run a Congestion and Priority Traffic Test (QoS)
1. Open the hamburger menu and navigate to **Traffic & QoS** (`/traffic`).
2. Configure the traffic generator:
   - **Source**: `Ambulance Services`
   - **Destination**: `Hospital`
   - **Traffic Class**: `CRITICAL` (Ambulance Dispatch & Triage)
   - **Offered Load**: `40 Mbps`
   - **Competing Traffic**: Toggle **Enabled** (adds 95 Mbps of competing Normal/Low traffic to exceed 100 Mbps bottleneck capacity).
3. Click **Simulate Priority Traffic**.
4. **Observe**:
   - Link utilization indicates `100.0% (Congested Bottleneck)`.
   - **Critical Class Performance**: `100% Delivery Ratio`, `0 Packets Lost`, minimal queuing delay (<5ms).
   - In the **Results by Priority Class** breakdown table, observe that `NORMAL` and `LOW` traffic experience packet drops and queuing delays, proving that strict priority scheduling protects life-safety communications while starvation safeguards still allocate minimum bandwidth to lower tiers.

### Step 9: Test Departmental ACL Denial & Security Isolation
1. Open the hamburger menu and navigate to **Security** (`/security`).
2. In the **Access Control (ACL)** tab:
   - Select **Source Department**: `Relief Camp (VLAN 60)`
   - Select **Destination Department**: `Backup Control Center (VLAN 70)`
   - Protocol: `TCP`
3. Click **Evaluate Connection**.
4. **Observe**:
   - Result: `DENIED • Action: DENY`.
   - Matched Rule: `RULE-PUBLIC-ISOLATION`.
   - **Routing vs. Security Separation**: The banner explicitly notes: *"Destination is physically reachable via OSPF topology graph, but packet transmission was blocked by administrative access policy."*
   - A persistent `SECURITY_VIOLATION` event is logged to the forensic database.

### Step 10: Restore Baseline Network
1. Navigate back to the **Dashboard** (`/dashboard`).
2. Click the rectangular **Restore Network** button at the top right.
3. **Observe**:
   - A restoration broadcast resets link `LINK-R1-R2` back to `UP`.
   - Network availability score returns to `100.0%`.
   - Route `ROUTER-01 -> ROUTER-02` immediately returns to the primary direct 1-hop path.
   - All active failure alerts are cleanly marked as `RESOLVED`.

### Step 11: Open the Auditable Reports Page
1. Open the hamburger menu and navigate to **Reports** (`/reports`).
2. **Observe**:
   - The aggregated **Executive Performance Summary** displays total drills, overall availability percentage, alternate route selection counts, and security events.
   - The **Simulation History Table** displays all completed simulation runs with Run ID, start/end timestamps, outcome, packet stats, and recovery duration.
3. Test Exports:
   - Click **Export History (CSV)**: Downloads `simulation_history.csv` generated directly from database records.
   - Click **Export Run (JSON)** on any row: Downloads comprehensive structured diagnostic logs including initial topology, final topology, route change sequences, and event timeline.

### Step 12: Refresh the Browser and Verify Persistence
1. Perform a hard browser refresh (`Ctrl+F5` or `Cmd+Shift+R`) on the `/reports` or `/alerts` page.
2. Restart or query the backend database if desired.
3. **Observe**:
   - All simulation runs, acknowledged alerts, forensic timeline records, and ACL test results remain intact in SQLite (`backend/data/disaster_resilience.db`).
   - Proves zero in-memory ephemeral data loss and complete system persistence across restarts.

---

## Summary of Verification Checkpoints
- [x] Landing page is clean and distraction-free with hidden sidebar.
- [x] Baseline reachability connects all 7 emergency departments (100%).
- [x] Primary link failure causes deterministic alternate-route recalculation.
- [x] BFD + SPF + FIB recovery timing is non-hardcoded and physically modeled.
- [x] QoS strictly protects Critical emergency traffic during link saturation.
- [x] ACL separates OSPF graph reachability from security authorization.
- [x] Baseline restoration re-establishes optimal paths without data loss.
- [x] CSV and JSON reports generate directly from SQLite database records.
- [x] Refreshing the browser preserves all state and historical runs.

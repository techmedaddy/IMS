"""
IMS Demo Load Generator
========================
Sends realistic signals to the IMS API to trigger incident creation via debounce.
Run this script to populate the system with demo data for showcasing the frontend.

Usage:
    python scripts/demo_load.py --base-url http://172.235.26.31
    python scripts/demo_load.py --base-url http://localhost:8000  (local)
"""

import argparse
import json
import random
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Realistic component scenarios
SCENARIOS = [
    {
        "component_id": "postgres-primary-us-east",
        "component_type": "RDBMS",
        "messages": [
            "Connection pool exhausted: 100/100 connections in use",
            "Query timeout after 30s on table orders",
            "Replication lag exceeded 10s threshold",
            "Deadlock detected in transaction batch_insert",
            "High CPU usage: 95% on postgres-primary",
        ],
    },
    {
        "component_id": "redis-cache-cluster-01",
        "component_type": "CACHE",
        "messages": [
            "Memory usage at 92% — eviction policy triggered",
            "Latency spike: p99 = 45ms (threshold: 10ms)",
            "Key eviction rate: 1200 keys/sec",
            "Cluster node redis-03 unreachable",
            "AOF rewrite failed: insufficient disk space",
        ],
    },
    {
        "component_id": "kafka-broker-prod-3",
        "component_type": "QUEUE",
        "messages": [
            "Consumer group lag exceeded 50,000 messages",
            "ISR shrunk: partition orders-topic-2 has 1/3 replicas",
            "Disk usage at 88% on broker-3",
            "Producer timeout: batch.linger.ms exceeded",
            "Under-replicated partitions detected: 4",
        ],
    },
    {
        "component_id": "api-gateway-prod",
        "component_type": "API",
        "messages": [
            "5xx error rate exceeded 5% threshold",
            "Request latency p99: 2.3s (SLA: 500ms)",
            "Rate limiter triggered for client auth-service",
            "Upstream timeout from payment-service",
            "Health check failing on instance api-gw-04",
        ],
    },
    {
        "component_id": "mongodb-analytics-cluster",
        "component_type": "NOSQL",
        "messages": [
            "Oplog window shrunk to 2 hours (threshold: 12h)",
            "Slow query detected: collection events, 8.2s",
            "Shard imbalance: shard-02 has 40% more chunks",
            "Write concern timeout on replica set rs-analytics",
            "Index build failed on collection user_sessions",
        ],
    },
]


def send_signal(base_url: str, component_id: str, component_type: str, message: str) -> bool:
    """Send a single signal to the IMS API."""
    url = f"{base_url}/api/signals"
    payload = json.dumps({
        "component_id": component_id,
        "component_type": component_type,
        "message": message,
        "ts": datetime.now(timezone.utc).isoformat(),
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 202
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode()}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def run_demo(base_url: str):
    print("=" * 60)
    print("  IMS Demo Load Generator")
    print("=" * 60)
    print(f"  Target: {base_url}")
    print()

    # Step 1: Health check
    print("[1/4] Checking API health...")
    try:
        with urllib.request.urlopen(f"{base_url}/api/health", timeout=5) as resp:
            data = json.loads(resp.read())
            print(f"  ✓ API is healthy: {data}")
    except Exception as e:
        print(f"  ✗ API not reachable: {e}")
        print("  Make sure the server is running and the URL is correct.")
        sys.exit(1)

    # Step 2: Send burst signals for each scenario to trigger debounce
    # Debounce threshold is 100 signals in 10 seconds per component
    print()
    print("[2/4] Sending signal bursts to trigger incident creation...")
    print(f"  (Debounce: 100 signals per component → creates 1 incident)")
    print()

    num_scenarios = 3  # Create 3 incidents to keep the demo clean
    for i, scenario in enumerate(SCENARIOS[:num_scenarios]):
        comp_id = scenario["component_id"]
        comp_type = scenario["component_type"]
        messages = scenario["messages"]

        print(f"  📡 Component: {comp_id} ({comp_type})")
        print(f"     Sending 110 signals...", end=" ", flush=True)

        success = 0
        for j in range(110):
            msg = random.choice(messages)
            if send_signal(base_url, comp_id, comp_type, msg):
                success += 1

        print(f"✓ {success}/110 sent")
        time.sleep(1)  # Small gap between scenarios

    # Step 3: Wait for worker to process and create incidents
    print()
    print("[3/4] Waiting for worker to process signals and create incidents...")
    time.sleep(8)  # Give the worker time to process the debounce window

    # Step 4: Verify incidents were created
    print()
    print("[4/4] Checking created incidents...")
    try:
        with urllib.request.urlopen(f"{base_url}/api/incidents", timeout=10) as resp:
            incidents = json.loads(resp.read())
            print(f"  ✓ {len(incidents)} active incident(s) found!")
            print()
            for inc in incidents:
                print(f"  ┌─ Incident: {inc['id'][:8]}...")
                print(f"  │  Component: {inc['component_id']}")
                print(f"  │  Severity:  {inc['severity']}")
                print(f"  │  State:     {inc['state']}")
                print(f"  └─ Created:   {inc['created_at']}")
                print()
    except Exception as e:
        print(f"  ⚠ Could not fetch incidents: {e}")
        print("  The worker might still be processing. Check the dashboard in a few seconds.")

    # Step 5: Check metrics
    try:
        with urllib.request.urlopen(f"{base_url}/api/metrics", timeout=5) as resp:
            metrics = json.loads(resp.read())
            print("  📊 System Metrics:")
            print(f"     Open Incidents:     {metrics.get('open_incidents', 'N/A')}")
            print(f"     Signals (last hr):  {metrics.get('signals_aggregated_last_hour', 'N/A')}")
            print(f"     Avg Latency:        {metrics.get('avg_worker_latency_ms', 'N/A')}ms")
    except Exception:
        pass

    print()
    print("=" * 60)
    print(f"  ✅ Demo data loaded! Open your dashboard:")
    print(f"     {base_url}")
    print()
    print("  Demo flow you can now show:")
    print("  1. Dashboard  → See live incidents with severity colors")
    print("  2. Click any incident → See signals, timeline")
    print("  3. Transition → OPEN → INVESTIGATING → RESOLVED")
    print("  4. Submit RCA → Fill root cause analysis form")
    print("  5. Close      → Only possible after RCA (enforced!)")
    print("  6. Analytics  → Signal trend chart + MTTR metrics")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IMS Demo Load Generator")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Base URL of the IMS API")
    args = parser.parse_args()

    # Remove trailing slash
    base_url = args.base_url.rstrip("/")
    run_demo(base_url)

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone


def post_json(url: str, payload: dict) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.getcode(), resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        return e.code, body


def burst_signals(*, url: str, component_id: str, component_type: str, n: int, concurrency: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "component_id": component_id,
        "component_type": component_type,
        "message": "simulated outage signal burst",
        "payload": {"ts": now, "kind": "burst", "n": n},
    }

    ok = 0
    errors = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(post_json, url, payload) for _ in range(n)]
        for fut in as_completed(futures):
            code, _body = fut.result()
            if code == 202:
                ok += 1
            else:
                errors += 1
    elapsed = time.time() - start
    print(f"- Burst {component_id} ({component_type}): sent={n} ok={ok} errors={errors} in {elapsed:.2f}s")


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate IMS outage signals (backend-only demo).")
    parser.add_argument("--base-url", default="http://localhost:8000", help="IMS API base URL")
    parser.add_argument("--burst-component-id", default="CACHE_CLUSTER_01")
    parser.add_argument("--burst-component-type", default="CACHE")
    parser.add_argument("--burst-count", type=int, default=120, help="Signals to send for debounce trigger (>=100)")
    parser.add_argument("--concurrency", type=int, default=30, help="Parallel requests during bursts")
    args = parser.parse_args()

    signals_url = args.base_url.rstrip("/") + "/api/signals"

    print("IMS Simulator")
    print("=============")
    print(f"Target: {signals_url}")
    print("")
    print("Expected:")
    print("- One incident created for the burst component (debounce: 100 signals/10s -> 1 Work Item).")
    print("- Additional incidents created for other components when their bursts hit threshold.")
    print("")

    # Primary burst to deterministically trigger debounce.
    burst_signals(
        url=signals_url,
        component_id=args.burst_component_id,
        component_type=args.burst_component_type,
        n=args.burst_count,
        concurrency=args.concurrency,
    )

    # Smaller secondary bursts to show severity differences. These are set >=100 so they also trigger.
    burst_signals(
        url=signals_url,
        component_id="RDBMS_PRIMARY_01",
        component_type="RDBMS",
        n=105,
        concurrency=min(args.concurrency, 20),
    )
    burst_signals(
        url=signals_url,
        component_id="QUEUE_KAFKA_01",
        component_type="QUEUE",
        n=101,
        concurrency=min(args.concurrency, 20),
    )

    print("")
    print("Next steps (verify via API):")
    print(f"- List incidents: curl -sS {args.base_url.rstrip('/')}/api/incidents | jq")
    print(f"- Pick an id and inspect: curl -sS {args.base_url.rstrip('/')}/api/incidents/<INCIDENT_ID> | jq")
    print("")
    print("Workflow checks:")
    print("- Transition OPEN->INVESTIGATING->RESOLVED should succeed.")
    print("- Transition RESOLVED->CLOSED should fail until RCA is submitted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


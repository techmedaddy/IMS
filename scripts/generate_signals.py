#!/usr/bin/env python3
import argparse
import json
import urllib.request
import uuid
from datetime import datetime, timezone

def main():
    parser = argparse.ArgumentParser(description="Generate a single signal for IMS.")
    parser.add_argument("--url", default="http://localhost:8000/api/signals", help="Signals API URL")
    parser.add_argument("--component-id", default="WEBSERVER_01")
    parser.add_argument("--component-type", default="WEBSERVER")
    parser.add_argument("--message", default="Manual signal generation")
    args = parser.parse_args()

    payload = {
        "event_id": str(uuid.uuid4()),
        "component_id": args.component_id,
        "component_type": args.component_type,
        "message": args.message,
        "ts": datetime.now(timezone.utc).isoformat()
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        args.url,
        data=data,
        headers={"content-type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Status: {resp.getcode()}")
            print(f"Response: {resp.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()

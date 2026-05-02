#!/usr/bin/env bash
set -euo pipefail

echo "IMS backpressure demo"
echo "====================="
echo ""
echo "This demonstrates: API stays responsive while Postgres is paused."
echo ""
echo "Prereqs:"
echo "- docker compose up --build -d"
echo ""

echo "Pausing Postgres for 20s..."
docker compose pause postgres

echo "Sending a burst of signals while Postgres is paused."
echo "(The API should still accept requests because it only enqueues to Kafka.)"
python3 ./scripts/simulate_outage.py --burst-count 150 --concurrency 40 || true

echo "Sleeping 20s..."
sleep 20

echo "Resuming Postgres..."
docker compose unpause postgres

echo ""
echo "Now check worker logs to see it draining after resume:"
echo "  docker compose logs -f worker"

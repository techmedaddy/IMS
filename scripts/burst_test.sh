#!/usr/bin/env bash

echo "Running burst test (sending large volume of signals fast)..."
# Assuming simulate_outage.py exists and handles sending signals.
# We run it multiple times concurrently to simulate a massive burst.
for i in {1..5}; do
  ./scripts/simulate_outage.py &
done
wait
echo "Burst test complete. Check the metrics and dashboard for latency and idempotency handling."

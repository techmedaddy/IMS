#!/usr/bin/env bash

echo "Simulating worker node failure by killing the worker container..."
docker compose kill worker
echo "Worker killed. Watch the API keep accepting signals (buffered in Kafka or Redis)."
echo "Restart it with: docker compose start worker"

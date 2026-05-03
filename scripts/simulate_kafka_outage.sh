#!/usr/bin/env bash

echo "Simulating broker failure by killing the Redpanda container..."
docker compose kill redpanda
echo "Kafka killed. Watch the API degrade gracefully using the Redis memory buffer."
echo "Restart it with: docker compose start redpanda
# After restart, the API drain task automatically rehydrates Kafka from the Redis buffer."

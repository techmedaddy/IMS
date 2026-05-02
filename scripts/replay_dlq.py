#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys

from kafka import KafkaConsumer, KafkaProducer


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay IMS DLQ messages back into the main signals topic.")
    parser.add_argument("--bootstrap", default="localhost:9092", help="Kafka/Redpanda bootstrap servers")
    parser.add_argument("--dlq-topic", default="ims.signals.dlq")
    parser.add_argument("--signals-topic", default="ims.signals")
    parser.add_argument("--max", type=int, default=50, help="Max messages to replay")
    args = parser.parse_args()

    consumer = KafkaConsumer(
        args.dlq_topic,
        bootstrap_servers=args.bootstrap,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        consumer_timeout_ms=3000,
        value_deserializer=lambda b: b.decode("utf-8", errors="replace"),
    )
    producer = KafkaProducer(
        bootstrap_servers=args.bootstrap,
        value_serializer=lambda s: s.encode("utf-8"),
    )

    replayed = 0
    try:
        for msg in consumer:
            if replayed >= args.max:
                break
            try:
                payload = json.loads(msg.value)
            except Exception:
                continue

            raw = payload.get("raw")
            if isinstance(raw, dict):
                raw_str = json.dumps(raw)
            elif isinstance(raw, str):
                raw_str = raw
            else:
                continue

            producer.send(args.signals_topic, raw_str)
            replayed += 1
    finally:
        producer.flush()
        consumer.close()
        producer.close()

    print(f"Replayed {replayed} messages from {args.dlq_topic} -> {args.signals_topic}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


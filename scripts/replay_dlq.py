#!/usr/bin/env python3
import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add backend directory to sys.path to allow importing from ims
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from ims.config import get_settings


async def replay_dlq(max_messages: int, dry_run: bool) -> None:
    settings = get_settings()

    print(f"Connecting to Kafka at {settings.kafka_bootstrap}...")
    consumer = AIOKafkaConsumer(
        settings.kafka_topic_dlq,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id="ims-dlq-replayer",
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    await consumer.start()

    producer = None
    if not dry_run:
        producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap)
        await producer.start()

    print(f"Reading up to {max_messages} messages from {settings.kafka_topic_dlq}...")
    count = 0

    try:
        batch = await consumer.getmany(timeout_ms=5000, max_records=max_messages)
        
        if not batch:
            print("DLQ is empty.")
            return

        for tp, messages in batch.items():
            for msg in messages:
                if count >= max_messages:
                    break
                
                try:
                    payload = json.loads(msg.value.decode("utf-8", errors="replace"))
                    original_raw = payload.get("raw")
                    error = payload.get("error", "unknown")
                    reason = payload.get("reason", "")
                    
                    print(f"\n--- DLQ Message {count+1} ---")
                    print(f"Error: {error} | Reason: {reason}")
                    
                    if not original_raw:
                        print("Skipping: No 'raw' payload found in DLQ message.")
                        continue
                        
                    if isinstance(original_raw, dict):
                        original_bytes = json.dumps(original_raw).encode("utf-8")
                    else:
                        original_bytes = original_raw.encode("utf-8") if isinstance(original_raw, str) else original_raw

                    if not dry_run and producer:
                        await producer.send_and_wait(
                            settings.kafka_topic_signals,
                            original_bytes,
                            key=msg.key
                        )
                        print(f"Replayed to {settings.kafka_topic_signals}.")
                    else:
                        print("DRY RUN: Would have replayed this message.")
                        
                    count += 1
                except Exception as e:
                    print(f"Failed to process DLQ message: {e}")

        if not dry_run and count > 0:
            await consumer.commit()
            print(f"\nSuccessfully replayed and committed {count} messages.")

    finally:
        await consumer.stop()
        if producer:
            await producer.stop()


def main():
    parser = argparse.ArgumentParser(description="Replay messages from the IMS Dead Letter Queue.")
    parser.add_argument(
        "--max",
        type=int,
        default=100,
        help="Maximum number of messages to replay (default: 100)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print messages without actually pushing them back to the main topic"
    )
    args = parser.parse_args()

    asyncio.run(replay_dlq(max_messages=args.max, dry_run=args.dry_run))


if __name__ == "__main__":
    main()

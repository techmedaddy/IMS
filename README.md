# Incident Management System (IMS)

> High-throughput, fault-tolerant incident processing system with backpressure handling, strict lifecycle enforcement, and strong consistency guarantees across a polyglot persistence layer.

---

## What Problem This Solves

Traditional monitoring systems fail under load: alert storms create duplicate incidents, ingestion blocks on slow DB writes, and there is no audit trail for incident lifecycle or post-mortem accountability.

This system solves all three:
- **Alert storms** → debounce logic collapses N signals into 1 incident
- **Ingestion blocking** → Kafka decouples the API from storage; no request ever waits on a DB write
- **Accountability** → every state change, RCA, and note is an immutable `IncidentEvent` row, enforced in-transaction

---

## System Architecture

```
Clients
   │
   ▼
┌─────────────────────────────────────────────────┐
│           FastAPI Ingestion API                  │
│  POST /api/signals  (thin, async, non-blocking) │
└────────────┬────────────────────────────────────┘
             │  produce (at-least-once)
             ▼
     ┌───────────────┐       ┌─────────────────┐
     │  Redpanda     │       │  Redis Buffer   │
     │  ims.signals  │◄──────│  (fallback when │
     │  (primary)    │       │   Kafka is down)│
     └──────┬────────┘       └─────────────────┘
            │  consume
            ▼
   ┌─────────────────────┐
   │  Async Worker        │
   │  (stateless, retry) │
   └──┬──────┬──────┬────┘
      │      │      │
      ▼      ▼      ▼
  MongoDB  Postgres  Redis Cache
  (raw     (WorkItems  (dashboard,
  signals) RCA, Audit) debounce)
```

---

## Why Each Technology Was Chosen

| Component | Technology | Why |
|-----------|-----------|-----|
| **Message Broker** | Kafka (Redpanda) | Absorbs traffic bursts; decouples ingestion latency from storage latency. API stays fast even when DBs are slow. |
| **Source of Truth** | PostgreSQL | ACID transactions. Incident state, RCA, and audit trail require strong consistency — not eventual. |
| **Raw Signal Store** | MongoDB | Schema-less, high-write-throughput storage for raw telemetry. Signals arrive in varying shapes; Mongo handles this naturally. |
| **Cache + Fallback** | Redis | Sub-millisecond dashboard reads. Also serves as a circuit-breaker buffer for signals when Kafka is unreachable. |
| **API Framework** | FastAPI | Native async I/O; Pydantic validation; aligns with the engineering stack. |

---

## System Guarantees

These are explicit, not aspirational:

| Concern | Guarantee |
|---------|-----------|
| **Ingestion** | At-least-once delivery. Every `POST /api/signals` returns `202 Accepted` or stores to the Redis fallback buffer. No signal is silently dropped. |
| **Idempotency** | All signals carry a unique `event_id`. Re-ingested signals are rejected at the MongoDB layer via a `unique` index. The worker catches `BulkWriteError` and continues without reprocessing. |
| **Incident Uniqueness** | PostgreSQL enforces `UNIQUE (component_id) WHERE state != 'CLOSED'` — a partial index. It is physically impossible to create two active incidents for the same component, regardless of worker concurrency. |
| **State Consistency** | Incident state transitions are enforced by a state machine. Skipping states, reversing states, or closing without RCA are all rejected at the service layer. Postgres provides the locking (`SELECT ... FOR UPDATE`). |
| **MTTR Accuracy** | MTTR is computed at RCA-submission time as `submission_timestamp − first_signal_timestamp`. End-time cannot be back-dated to manipulate the metric. |
| **Audit Completeness** | Every mutation (CREATED, STATE_CHANGE, RCA_SUBMITTED, SLA_BREACH, NOTE_ADDED) writes an `IncidentEvent` row atomically in the same DB transaction. The audit log cannot be bypassed. |
| **Cache Consistency** | Redis cache is eventually consistent. It is updated after every successful Postgres write. The canonical source for incident state is always Postgres. |

---

## Data Flow (Step by Step)

1. **Ingestion**: Client POSTs to `POST /api/signals`. The API assigns a UUID `event_id` (if absent), timestamps the request, and produces to `ims.signals` Kafka topic. Returns `202 Accepted` immediately.
2. **Buffering**: Under normal conditions, Kafka absorbs the signal. Under broker failure, the API's exponential-backoff retry exhausts and the signal is written to a Redis list (`buffer:signals`). An async drain task rehydrates Kafka when the broker recovers.
3. **Worker Consumption**: The worker consumes from `ims.signals`. For each message:
   - Archives the raw signal to MongoDB (batch insert, idempotent).
   - Increments a Redis counter `debounce:count:{component_id}` with a TTL of the debounce window.
4. **Incident Creation**: Once the counter hits threshold (100 signals / 10s window), the worker acquires a Redis lock (`debounce:created:{component_id}`) and creates a `WorkItem` in Postgres. The DB-level unique index prevents race conditions between concurrent workers.
5. **Lifecycle**: Operators drive the incident through states via `POST /api/incidents/{id}/transition`. Closure requires a complete RCA (validated in-memory and re-enforced by a DB `CheckConstraint`).
6. **Observability**: Metrics are exposed at `GET /api/metrics`: signals/sec (last hour), open incident count, average MTTR, and average worker processing latency.

---

## Failure Handling

### Kafka Broker Down
**What happens**: Producer calls in the API fail with a connection error.

**System response**:
1. API retries with exponential backoff (3 attempts, 100ms base delay).
2. On final failure, signal is pushed to Redis list `buffer:signals`.
3. A background drain task (`_drain_fallback_buffer`) runs every second, popping from the buffer and re-producing to Kafka once the broker is available.

**Result**: Zero signal loss. API continues to return `202 Accepted` throughout the outage.

---

### Worker Crash
**What happens**: The worker process exits mid-consumption.

**System response**: Kafka consumer groups track committed offsets. The worker does not auto-commit until a message is fully processed. On restart, it resumes from the last committed offset.

**Result**: No messages are lost or skipped. Signals may be reprocessed, but idempotency at the MongoDB layer prevents duplication.

---

### Duplicate / Replayed Signals
**What happens**: A signal is sent twice with the same `event_id` (e.g., client retry, DLQ replay).

**System response**: MongoDB's unique index on `event_id` rejects the duplicate. The worker catches `BulkWriteError` and continues. No duplicate incidents are created.

**Result**: Processing is idempotent. Replay is safe.

---

### Poison Messages
**What happens**: A message arrives that cannot be decoded or causes a processing exception.

**System response**: Worker catches the exception, serializes the raw message plus error metadata, and produces it to `ims.signals.dlq`. The main consumption loop continues.

**Result**: Bad messages never block the pipeline. They are quarantined for inspection and replay.

---

## How to Run

### Prerequisites
- Docker ≥ 20.x
- Docker Compose ≥ 2.x

### Start from Scratch
```bash
cp .env.example .env
docker compose up --build -d
```

### Verify the Stack is Healthy
```bash
curl -sS http://localhost:8000/api/health
# {"status": "ok"}

curl -sS http://localhost:8000/api/metrics | jq
# {
#   "open_incidents": 0,
#   "signals_aggregated_last_hour": 0,
#   "avg_mttr_seconds_last_hour": null,
#   "avg_worker_latency_ms": 0.0
# }
```

**Exposed Ports:**
| Service | Port |
|---------|------|
| IMS API | `http://localhost:8000` |
| Redpanda Console | `http://localhost:8080` |
| PostgreSQL | `localhost:5432` |
| MongoDB | `localhost:27017` |
| Redis | `localhost:6379` |

---

## Demo Instructions (Proving the System Works)

### Step 1: Generate an Incident Burst
```bash
./scripts/burst_test.sh
```
**What it does**: Launches 5 concurrent `simulate_outage.py` processes, each sending 100+ signals across 4 component types.

**What to observe**:
```bash
curl -sS http://localhost:8000/api/incidents | jq '.[].component_id'
# "RDBMS_PRIMARY_01"
# "MCP_HOST_01"
# "CACHE_CLUSTER_01"
# "QUEUE_KAFKA_01"

curl -sS http://localhost:8000/api/metrics | jq
# "signals_aggregated_last_hour": ~2500
# "avg_worker_latency_ms": ~8
```

**Key proof**: Exactly 1 incident per component, regardless of 5× concurrent burst volume.

---

### Step 2: Lifecycle Enforcement (RCA Gate)
```bash
INCIDENT_ID=$(curl -sS http://localhost:8000/api/incidents | jq -r '.[0].id')

# Transition through states
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' \
  -d '{"to_state":"INVESTIGATING"}' | jq '.state'
# "INVESTIGATING"

curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' \
  -d '{"to_state":"RESOLVED"}' | jq '.state'
# "RESOLVED"

# Attempt to close without RCA — must fail
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' \
  -d '{"to_state":"CLOSED"}' | jq '.detail'
# "RCA is missing or incomplete; cannot close incident"

# Submit RCA and close
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/rca \
  -H 'content-type: application/json' \
  -d '{
    "root_cause_category": "RDBMS",
    "fix_applied": "Restarted primary replica and restored read traffic",
    "prevention_steps": "Add synthetic probes and automatic failover trigger",
    "start_time": "2026-05-01T12:00:00Z",
    "end_time": "2026-05-01T12:15:00Z"
  }' | jq '.mttr_seconds'
# 900

curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' \
  -d '{"to_state":"CLOSED"}' | jq '.state'
# "CLOSED"
```

---

### Step 3: Chaos Test — Worker Failure
```bash
./scripts/kill_worker.sh

# While worker is down, keep sending signals
./scripts/generate_signals.py --component-id RDBMS_PRIMARY_01 --component-type RDBMS

# API still returns 202 — Kafka is buffering
# Restore the worker
docker compose start worker

# Watch the worker drain the backlog
docker compose logs -f worker
# [worker] processed_throughput=340.0 signals/sec
```

---

### Step 4: Chaos Test — Broker Failure
```bash
./scripts/kill_kafka.sh

# Send a signal immediately — API should NOT drop it
curl -sS -X POST http://localhost:8000/api/signals \
  -H 'content-type: application/json' \
  -d '{"component_id": "TEST", "component_type": "TEST", "message": "kafka down test"}'
# {"status":"queued","event_id":"..."}   ← still 202, buffered to Redis

# Check the Redis buffer
docker compose exec redis redis-cli llen buffer:signals
# 1

# Restore Kafka — buffer drains automatically
docker compose start redpanda
docker compose logs api | grep "draining"
# [api] Error draining fallback buffer (before recovery)
# (silence = buffer drained successfully)
```

---

### Step 5: DLQ Inspection
```bash
docker compose exec -e PYTHONPATH=/app worker \
  python /tmp/replay_dlq.py --max 10 --dry-run
# DLQ is empty.   ← healthy system produces zero DLQ messages under normal load
```

---

## API Reference (Key Endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/signals` | Ingest a telemetry signal |
| `GET` | `/api/incidents` | List active incidents (sorted by severity) |
| `GET` | `/api/incidents/{id}` | Full incident detail with signals, RCA, and timeline |
| `POST` | `/api/incidents/{id}/transition` | Advance incident state |
| `POST` | `/api/incidents/{id}/rca` | Submit or update RCA |
| `POST` | `/api/incidents/{id}/notes` | Append operator note |
| `GET` | `/api/metrics` | Operational metrics snapshot |
| `GET` | `/api/health` | Liveness check |

---

## Environment Variables

See `.env.example` for the full list. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `IMS_KAFKA_BOOTSTRAP` | `redpanda:9092` | Kafka bootstrap servers |
| `IMS_POSTGRES_DSN` | `postgresql+asyncpg://...` | PostgreSQL connection |
| `IMS_MONGO_URI` | `mongodb://mongo:27017` | MongoDB connection |
| `IMS_REDIS_URL` | `redis://redis:6379/0` | Redis connection |
| `IMS_DEBOUNCE_THRESHOLD` | `100` | Signals before incident creation |
| `IMS_DEBOUNCE_WINDOW_SECONDS` | `10` | Debounce window length |
| `IMS_SLA_BREACH_MINUTES` | `30` | SLA breach escalation threshold |

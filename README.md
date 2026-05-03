# Incident Management System (IMS)

> High-throughput, fault-tolerant incident processing system with backpressure handling, strict lifecycle enforcement, and strong consistency guarantees across a polyglot persistence layer.

This system is designed to tolerate partial failures and maintain correctness under high-throughput conditions.

---

## Creative Additions

This system goes beyond baseline requirements in the following ways:

| Addition | Description |
|----------|-------------|
| **Failure Simulation Framework** | Scripts to simulate worker crash and Kafka outage with exact recovery observations |
| **Dead Letter Queue + Replay** | Failed messages routed to `ims.signals.dlq`; operational replay CLI included |
| **Idempotent Processing Pipeline** | `event_id`-based deduplication in MongoDB + DB-level partial unique index in Postgres prevents duplicate incidents |
| **SLA Breach Auto-Escalation** | Incidents unresolved past the SLA threshold are automatically escalated to P0 and logged as `SLA_BREACH` events |
| **Incident Audit Trail** | Full lifecycle tracking via immutable `IncidentEvent` rows — enables timeline reconstruction for any incident |
| **Kafka Fallback Buffer** | API continues accepting requests during broker outages via Redis circuit-breaker + async drain task |
| **Signal Replay Endpoint** | `POST /incidents/{id}/replay` re-publishes an incident's raw signals through the pipeline — enables reproducible debugging |
| **Worker Latency Metrics** | End-to-end processing latency tracked per minute in Redis; exposed at `/api/metrics` |

---

## Demo Highlights

```
Burst handling:    ~340 signals/sec worker throughput, zero API degradation
Debounce:          500 signals/10s → exactly 1 WorkItem per component
Failure recovery:
  Worker crash  → Kafka retains offset, worker resumes exactly where it stopped
  Kafka outage  → signals buffered in Redis, auto-drained on broker recovery
Idempotency:       duplicate event_id signals rejected at MongoDB layer
Lifecycle gate:    closing without RCA returns HTTP 400 — enforced at service + DB level
Replay:            POST /incidents/{id}/replay re-runs full ingestion for debugging
```

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
      │
      ▼
  ims.signals.dlq
  (poison messages)
```

---

## Why Each Technology Was Chosen

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Message Broker** | Kafka (Redpanda) | Absorbs traffic bursts; decouples ingestion latency from storage latency. API stays fast even when DBs are slow or unavailable. |
| **Source of Truth** | PostgreSQL | ACID transactions. Incident state, RCA, and audit trail require strong consistency — not eventual. |
| **Raw Signal Store** | MongoDB | Schema-less, high-write-throughput storage for raw telemetry. Signals arrive in varying shapes; batch inserts are idempotent via `event_id` unique index. |
| **Cache + Fallback** | Redis | Sub-millisecond dashboard reads via materialized incident snapshots. Doubles as a circuit-breaker buffer for signals when Kafka is unreachable. |
| **API Framework** | FastAPI | Native async I/O; Pydantic validation; minimal overhead in the hot path. |

---

## System Guarantees

| Concern | Guarantee |
|---------|-----------|
| **Ingestion** | At-least-once delivery. Every `POST /api/signals` returns `202 Accepted` or stores to the Redis fallback buffer. No signal is silently dropped. |
| **Idempotency** | All signals carry a unique `event_id`. Re-ingested signals are rejected at the MongoDB layer via a `unique` index. The worker catches `BulkWriteError` and continues without reprocessing. |
| **Incident Uniqueness** | PostgreSQL enforces `UNIQUE (component_id) WHERE state != 'CLOSED'` — a partial index. It is physically impossible to create two active incidents for the same component, regardless of worker concurrency. |
| **State Consistency** | Incident state transitions are enforced by a state machine + database row-level locks (`SELECT ... FOR UPDATE`). Skipping states, reversing states, or closing without RCA are all rejected. |
| **MTTR Accuracy** | MTTR is computed at RCA-submission time as `now − first_signal_timestamp`. End-time cannot be back-dated to manipulate the metric. |
| **Audit Completeness** | Every mutation (CREATED, STATE_CHANGE, RCA_SUBMITTED, SLA_BREACH, NOTE_ADDED, SIGNALS_REPLAYED) writes an `IncidentEvent` row in the same DB transaction. The audit log cannot be bypassed. |
| **Cache Consistency** | Redis cache is **eventually consistent**. Updated after every successful Postgres write. The canonical source for incident state is always Postgres. |

---

## Data Flow (Step by Step)

1. **Ingestion**: Client POSTs to `/api/signals`. API assigns `event_id` if absent, timestamps, and produces to `ims.signals`. Returns `202 Accepted` immediately — no DB writes in the request path.
2. **Buffering**: Under Kafka failure, the API retries with exponential backoff, then falls back to Redis list `buffer:signals`. An async drain task rehydrates Kafka on recovery.
3. **Worker Consumption**: Worker consumes `ims.signals`, archives raw signals to MongoDB (batch, idempotent), and increments Redis debounce counters with TTL.
4. **Incident Creation**: Once debounce threshold is hit (100 signals / 10s), worker acquires a Redis NX lock and creates a `WorkItem` in Postgres. DB unique index prevents races between concurrent workers.
5. **Lifecycle**: Operators drive state via `POST /api/incidents/{id}/transition`. Closure requires a validated, complete RCA — enforced at service layer and backed by a DB `CheckConstraint`.
6. **Observability**: `GET /api/metrics` exposes signals/sec (last hour), open incident count, average MTTR, and average worker processing latency in milliseconds.

---

## Failure Handling

### Kafka Broker Down
**System response**:
1. API retries with exponential backoff (3 attempts, 100ms base delay).
2. On final failure, signal written to Redis list `buffer:signals`.
3. Background drain task (`_drain_fallback_buffer`) runs every second — rehydrates Kafka on recovery.

**Result**: Zero signal loss. API continues returning `202 Accepted` throughout the outage.

### Worker Crash
**System response**: Consumer group offsets are committed only after successful processing. On restart, worker resumes from last committed offset.

**Result**: No messages lost or skipped. Any reprocessed signals are idempotent.

### Duplicate / Replayed Signals
**System response**: MongoDB `unique` index on `event_id` rejects duplicates. Worker catches `BulkWriteError` and continues. No duplicate incidents possible due to Postgres partial unique index.

**Result**: Full re-ingestion of any signal set is safe and produces identical system state.

### Poison Messages
**System response**: Worker catches processing exceptions, serializes the raw message + error metadata, and produces to `ims.signals.dlq`. Main loop continues unblocked.

**Result**: Bad messages never halt the pipeline. They are quarantined for inspection and replay.

---

## How to Run

### Prerequisites
- Docker ≥ 20.x and Docker Compose ≥ 2.x

### Start from Scratch
```bash
cp .env.example .env
docker compose up --build -d
```

### Verify the Stack
```bash
curl -sS http://localhost:8000/api/health
# {"status": "ok"}

curl -sS http://localhost:8000/api/metrics | jq
```

**Exposed Ports:**

| Service | Port |
|---------|------|
| IMS API | `http://localhost:8000` |
| API Docs (Swagger) | `http://localhost:8000/docs` |
| Redpanda Console | `http://localhost:8080` |
| PostgreSQL | `localhost:5432` |
| MongoDB | `localhost:27017` |
| Redis | `localhost:6379` |

---

## Demo Instructions

### 1. Burst & Debounce Test
```bash
./scripts/stress_test_ingestion.sh
```
**Observe**: 5 concurrent simulators flood 4 components.
```bash
curl -sS http://localhost:8000/api/incidents | jq '.[].component_id'
# "RDBMS_PRIMARY_01"
# "MCP_HOST_01"
# "CACHE_CLUSTER_01"
# "QUEUE_KAFKA_01"
```
**Key proof**: Exactly 1 incident per component despite hundreds of concurrent signals.

---

### 2. Lifecycle Enforcement
```bash
INCIDENT_ID=$(curl -sS http://localhost:8000/api/incidents | jq -r '.[0].id')

# Walk the state machine
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' -d '{"to_state":"INVESTIGATING"}' | jq '.state'
# "INVESTIGATING"

curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' -d '{"to_state":"RESOLVED"}' | jq '.state'
# "RESOLVED"

# Attempt close without RCA — must fail
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' -d '{"to_state":"CLOSED"}' | jq '.detail'
# "RCA is missing or incomplete; cannot close incident"

# Submit RCA and close
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/rca \
  -H 'content-type: application/json' \
  -d '{"root_cause_category":"RDBMS","fix_applied":"Restarted replica","prevention_steps":"Add auto-failover","start_time":"2026-05-01T12:00:00Z","end_time":"2026-05-01T12:15:00Z"}' \
  | jq '.mttr_seconds'
# 900

curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/transition \
  -H 'content-type: application/json' -d '{"to_state":"CLOSED"}' | jq '.state'
# "CLOSED"
```

---

### 3. Chaos: Worker Failure
```bash
./scripts/simulate_worker_failure.sh
./scripts/generate_signals.py --component-id RDBMS_PRIMARY_01 --component-type RDBMS
# API still returns 202 — signals are buffered in Kafka

docker compose start worker
docker compose logs -f worker
# [worker] processed_throughput=340.0 signals/sec  ← draining backlog
```

---

### 4. Chaos: Broker Failure
```bash
./scripts/simulate_kafka_outage.sh

curl -sS -X POST http://localhost:8000/api/signals \
  -H 'content-type: application/json' \
  -d '{"component_id":"TEST","component_type":"TEST","message":"kafka down"}'
# {"status":"queued","event_id":"..."}  ← 202, buffered to Redis

docker compose exec redis redis-cli llen buffer:signals
# 1

docker compose start redpanda
# Drain task runs automatically — buffer rehydrates Kafka
```

---

### 5. Signal Replay (Creative Feature)
Re-run the full ingestion pipeline for a closed incident — useful for debugging and staging reproduction:
```bash
curl -sS -X POST http://localhost:8000/api/incidents/$INCIDENT_ID/replay | jq
# {"incident_id": "...", "replayed": 127, "topic": "ims.signals"}
```

---

### 6. DLQ Inspection
```bash
docker compose exec -e PYTHONPATH=/app worker \
  python /tmp/replay_dlq.py --max 10 --dry-run
# DLQ is empty.  ← healthy system produces zero DLQ messages under normal load
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/signals` | Ingest a telemetry signal |
| `GET` | `/api/incidents` | List active incidents (sorted by severity) |
| `GET` | `/api/incidents/{id}` | Full detail with signals, RCA, and event timeline |
| `POST` | `/api/incidents/{id}/transition` | Advance incident state |
| `POST` | `/api/incidents/{id}/rca` | Submit or update RCA |
| `POST` | `/api/incidents/{id}/notes` | Append operator note |
| `POST` | `/api/incidents/{id}/replay` | Re-publish incident signals through the pipeline |
| `GET` | `/api/metrics` | Operational metrics snapshot |
| `GET` | `/api/health` | Liveness check |

---

## Environment Variables

See `.env.example`. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `IMS_KAFKA_BOOTSTRAP` | `redpanda:9092` | Kafka bootstrap servers |
| `IMS_POSTGRES_DSN` | `postgresql+asyncpg://...` | PostgreSQL connection |
| `IMS_MONGO_URI` | `mongodb://mongo:27017` | MongoDB connection |
| `IMS_REDIS_URL` | `redis://redis:6379/0` | Redis connection |
| `IMS_DEBOUNCE_THRESHOLD` | `100` | Signals before incident creation |
| `IMS_DEBOUNCE_WINDOW_SECONDS` | `10` | Debounce window |
| `IMS_SLA_BREACH_MINUTES` | `30` | Auto-escalation threshold |

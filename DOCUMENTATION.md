# Sentinel IMS — Incident Management System

## Complete Technical Documentation

---

## 1. What Is This Project?

Sentinel IMS is a **distributed, event-driven Incident Management System** designed to handle real-time infrastructure monitoring at scale. It ingests thousands of monitoring signals per second from infrastructure components (databases, caches, APIs, message queues), intelligently deduplicates them, automatically creates incident tickets, and enforces a strict lifecycle workflow from detection through resolution.

Think of it as a simplified, self-built version of what **PagerDuty** or **Opsgenie** does under the hood — but with full visibility into the architecture.

---

## 2. What Problem Does It Solve?

Modern infrastructure generates an enormous volume of monitoring signals. When a database goes down, you don't get one alert — you get **thousands** in seconds. Without proper handling, this leads to:

| Problem | How IMS Solves It |
|---|---|
| **Alert fatigue** — operators get flooded with duplicate alerts | Debounce logic collapses 100+ signals into a single incident |
| **Data loss under load** — synchronous writes fail when DBs are slow | Kafka queue decouples ingestion from processing |
| **Inconsistent incident states** — tickets get closed without root cause | State machine enforces `RCA required before CLOSE` |
| **Slow dashboards** — querying production DBs for real-time status | Cache-first architecture reads from Redis, not Postgres |
| **No audit trail** — raw signals are lost after processing | Every signal is persisted to MongoDB for forensic analysis |

---

## 3. System Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌────────────────────┐
│  Client  │────▶│ FastAPI  │────▶│ Apache Kafka │────▶│   Python Worker    │
│ (React)  │     │  (API)   │     │  (Redpanda)  │     │  (Kafka Consumer)  │
└──────────┘     └──────────┘     └──────────────┘     └────────┬───────────┘
     ▲                                                          │
     │                                                          ▼
     │           ┌──────────────────────────────────────────────────────────┐
     │           │                   Storage Layer                         │
     │           │  ┌────────────┐  ┌──────────┐  ┌───────────────────┐   │
     │           │  │ PostgreSQL │  │ MongoDB  │  │      Redis        │   │
     │           │  │ (Incidents │  │ (Raw     │  │ (Cache + Metrics  │   │
     │           │  │  + RCAs)   │  │ Signals) │  │  + Pub/Sub)       │   │
     │           │  └────────────┘  └──────────┘  └───────────────────┘   │
     │           └──────────────────────────────────────────────────────────┘
     │                                                          │
     └──────────────────── WebSocket (real-time) ◀──────────────┘
```

### Why This Architecture?

- **API is thin** — it only validates and enqueues. Zero business logic in the request path.
- **Kafka absorbs bursts** — if 10,000 signals/sec arrive, Kafka buffers them. The worker processes at its own pace.
- **Worker does the heavy lifting** — debounce, incident creation, alerting all happen asynchronously.
- **Three databases, three jobs** — each storage engine is used for what it's best at (see Section 5).

---

## 4. Complete Data Flow

Here is exactly what happens when a monitoring signal enters the system:

```
1. Signal arrives at POST /api/signals
       │
2. API validates the payload (Pydantic schema)
       │
3. API generates a unique event_id (UUID) for idempotency
       │
4. API pushes the signal to Kafka topic "ims.signals"
   (partitioned by component_id for ordering guarantees)
       │
   ┌───┴─── Kafka fails? ──▶ Falls back to Redis buffer "buffer:signals"
   │                         Background task drains buffer when Kafka recovers
   │
5. API returns 202 Accepted immediately (non-blocking)
       │
6. Worker consumes message from Kafka
       │
7. Worker checks event_id against MongoDB unique index
   (duplicate? → skip silently, exactly-once guarantee)
       │
8. Worker buffers signal document in memory
   (flushed to MongoDB via insert_many every 5 seconds)
       │
9. Worker increments Redis counter: metrics:signals:{minute_bucket}
       │
10. Worker runs debounce logic:
    - INCR debounce:count:{component_id}
    - If count >= 100 within 10-second window:
          │
11. Worker checks Postgres: "Does an active incident exist for this component?"
    - YES → attach signals to existing incident
    - NO  → create new WorkItem in Postgres
          │
12. Worker caches incident snapshot to Redis
          │
13. Worker publishes update to Redis Pub/Sub channel
          │
14. WebSocket endpoint forwards to connected React clients (instant UI update)
```

---

## 5. Tech Stack & Storage Strategy

### Polyglot Persistence (Why Three Databases?)

A single database is the **wrong choice** for this system. Each storage engine is used for its specific strength:

| Storage | What It Stores | Why This Engine |
|---|---|---|
| **PostgreSQL** | WorkItems (incidents), RCAs, state transitions | ACID transactions, relational integrity, `SELECT ... FOR UPDATE` locking |
| **MongoDB** | Raw signal payloads (high-volume append-only logs) | Flexible schema, optimized for write-heavy workloads, no joins needed |
| **Redis** | Active incident cache, dashboard state, metrics counters, Pub/Sub, debounce locks, fallback buffer | Sub-millisecond reads, atomic operations, ephemeral data |

### Full Stack

| Layer | Technology | Purpose |
|---|---|---|
| API | **FastAPI** (Python, async) | Signal ingestion, incident CRUD, WebSocket |
| Message Broker | **Apache Kafka** (via Redpanda) | Durable queue, burst absorption, partitioning |
| Worker | **Python** (aiokafka consumer) | Async signal processing, debounce, incident creation |
| Primary DB | **PostgreSQL 16** | Source of truth for incidents and RCAs |
| Signal Store | **MongoDB 7** | High-volume raw signal storage |
| Cache/Metrics | **Redis 7** | Real-time cache, counters, Pub/Sub |
| Frontend | **React + TypeScript + Vite** | Dashboard, incident management UI |
| CI/CD | **Jenkins** | Automated build and test pipeline |
| Containerization | **Docker Compose** | Full local development environment |

---

## 6. Core Features

### 6.1 Signal Ingestion Pipeline
- **Endpoint:** `POST /api/signals`
- **Throughput:** Designed for 10,000+ signals/second
- **Response:** Immediate `202 Accepted` (non-blocking)
- **Partitioning:** Signals are partitioned by `component_id` in Kafka, guaranteeing ordering per component
- **Rate Limiting:** Per-IP (5,000/sec) and global (20,000/sec) rate limits enforced via Redis

### 6.2 Debounce Mechanism
- **Rule:** 100 signals from the same component within a 10-second window → 1 incident
- **Implementation:** Redis sliding window counter + `SETNX` lock to prevent duplicate creation
- **Purpose:** Reduces noise so operators see one actionable incident, not thousands of raw alerts

### 6.3 Incident Lifecycle (State Machine)

```
    ┌──────┐      ┌───────────────┐      ┌──────────┐      ┌────────┐
    │ OPEN │─────▶│ INVESTIGATING │─────▶│ RESOLVED │─────▶│ CLOSED │
    └──────┘      └───────────────┘      └──────────┘      └────────┘
                                                                ▲
                                                                │
                                                     Requires complete RCA
```

- Uses the **State Pattern** (class-based transitions)
- Each state defines its own allowed transitions
- **Critical Rule:** An incident CANNOT be closed unless a complete RCA has been submitted
- Invalid transitions (e.g., OPEN → RESOLVED) are rejected with a `400 Bad Request`

### 6.4 Root Cause Analysis (RCA) Enforcement
An RCA requires ALL of the following fields:
- `start_time` and `end_time` (end must be ≥ start)
- `root_cause_category` (non-empty string)
- `fix_applied` (non-empty string)
- `prevention_steps` (non-empty string)

If any field is missing or invalid, the RCA is rejected and the incident cannot be closed.

### 6.5 Alerting (Strategy Pattern)
Alert severity is automatically determined by `component_type`:

| Component Type | Severity | Rationale |
|---|---|---|
| `RDBMS` | **P0** (Critical) | Database failure = highest impact |
| `QUEUE` | **P1** (High) | Message broker failure = data flow disrupted |
| `MCP_HOST` | **P1** (High) | Host-level failure |
| `API` | **P2** (Medium) | Application-level issue |
| `NOSQL` | **P2** (Medium) | Non-relational DB issue |
| `CACHE` | **P2** (Medium) | Cache failure (degraded, not critical) |

New component types can be added by creating a new strategy class — zero changes to existing code.

### 6.6 Cache-First Dashboard
- The UI reads incident data from **Redis**, not Postgres
- Worker pushes snapshots to Redis on every incident create/update
- Dashboard loads in milliseconds, even with thousands of incidents in Postgres

### 6.7 Real-Time WebSocket Updates
- **Endpoint:** `ws://localhost:8000/ws/incidents`
- When an incident is created or its state changes, the update is published to a Redis Pub/Sub channel
- The WebSocket endpoint subscribes to this channel and pushes updates to all connected clients
- The React frontend uses a custom `useIncidentsSocket` hook with automatic reconnection

### 6.8 Metrics & Observability
- **Endpoint:** `GET /api/metrics`
- Returns: open incident count, average MTTR (last hour), signals ingested (last hour)
- Signal counts are stored as atomic Redis counters (bucketed per minute)
- Health endpoint: `GET /api/health`

---

## 7. Resilience & Fault Tolerance

These are the production-grade patterns that go beyond a basic implementation:

### 7.1 Signal Idempotency
- Every signal gets a unique `event_id` (UUID)
- MongoDB has a unique sparse index on `event_id`
- If Kafka re-delivers a message, the worker catches `DuplicateKeyError` and skips it
- **Result:** Exactly-once processing semantics

### 7.2 Database-Level Incident Guard
- Before creating a new incident, the worker queries Postgres: `SELECT ... WHERE component_id = X AND state != CLOSED`
- If an active incident already exists, the worker attaches signals to it instead of duplicating
- Redis locks are treated as an **optimization**, not the source of truth
- **Result:** No duplicate incidents, even if Redis restarts

### 7.3 Kafka Fallback Buffer
- If Kafka is down, the API pushes signals to a Redis list (`buffer:signals`) instead of returning `503`
- A background asyncio task continuously drains this buffer back into Kafka when it recovers
- **Result:** Zero data loss during broker outages

### 7.4 Batched MongoDB Writes
- Signals are accumulated in an in-memory buffer within the worker
- Every 5 seconds, the buffer is flushed using `insert_many(ordered=False)`
- Duplicate key errors from idempotency checks are silently ignored in bulk
- **Result:** Massively higher write throughput under load

### 7.5 Dead Letter Queue (DLQ)
- Signals that fail processing (bad JSON, missing fields, DB errors) are routed to `ims.signals.dlq`
- A CLI tool (`scripts/replay_dlq.py`) allows operators to inspect and replay failed messages
- Supports `--dry-run` mode for safe inspection

### 7.6 Retry Logic
- All database writes use an exponential backoff retry strategy (up to 5 attempts)
- Prevents transient network errors from causing permanent data loss

---

## 8. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/signals` | Ingest a monitoring signal (returns 202) |
| `GET` | `/api/incidents` | List all active incidents (from Redis cache) |
| `GET` | `/api/incidents/{id}` | Get incident details + signals + RCA |
| `POST` | `/api/incidents/{id}/transition` | Transition incident state |
| `POST` | `/api/incidents/{id}/rca` | Submit/update Root Cause Analysis |
| `GET` | `/api/metrics` | System metrics (open count, MTTR, signal volume) |
| `GET` | `/api/health` | Health check |
| `WS` | `/ws/incidents` | Real-time incident updates via WebSocket |

---

## 9. Frontend Pages

| Page | Description |
|---|---|
| **Dashboard** | Overview with metric cards (Critical Incidents, MTTR, SLA Uptime, Signals Ingested) + recent incidents table |
| **Incidents** | Full incident list with search/filter, sortable by severity and update time |
| **Incident Detail** | Individual incident view with signal history, state transition controls, and RCA submission form |
| **Analytics** | Charts and visualizations for signal volume trends and incident metrics |

---

## 10. Running the Project

### Prerequisites
- Docker & Docker Compose

### Start Everything
```bash
docker compose up -d
```

This starts: PostgreSQL, MongoDB, Redis, Redpanda (Kafka), API server (port 8000), Worker consumer.

### Run Tests
```bash
# Using the project's virtual environment
.venv/bin/python -m pytest tests/ -v
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

---

## 11. Project Structure

```
IMS/
├── backend/
│   ├── ims/
│   │   ├── api/                    # FastAPI application
│   │   │   ├── main.py             # App factory, lifespan, middleware
│   │   │   ├── deps.py             # Dependency injection (DB sessions, Redis, Kafka)
│   │   │   ├── schemas.py          # Pydantic request/response models
│   │   │   ├── rate_limit.py       # Per-IP and global rate limiting
│   │   │   ├── throughput.py       # Ingest throughput counter
│   │   │   └── routes/
│   │   │       ├── signals.py      # POST /api/signals (ingestion)
│   │   │       ├── incidents.py    # Incident CRUD endpoints
│   │   │       ├── metrics.py      # GET /api/metrics
│   │   │       ├── health.py       # GET /api/health
│   │   │       ├── fragments.py    # HTMX fragments (server-rendered)
│   │   │       └── ws.py           # WebSocket /ws/incidents
│   │   ├── worker/
│   │   │   └── main.py             # Kafka consumer, debounce, incident creation
│   │   ├── services/
│   │   │   └── incidents.py        # Business logic (transitions, RCA, caching)
│   │   ├── domain/
│   │   │   ├── state_machine.py    # State Pattern implementation
│   │   │   ├── alerts.py           # Strategy Pattern (severity by component type)
│   │   │   └── rca.py              # RCA validation rules
│   │   ├── db/
│   │   │   ├── models.py           # SQLAlchemy models (WorkItem, RCA)
│   │   │   ├── postgres.py         # Async Postgres engine/session
│   │   │   ├── mongo.py            # Motor client + unique index init
│   │   │   └── redis.py            # Redis client factory
│   │   ├── cache.py                # Redis caching helpers
│   │   └── config.py               # Pydantic settings (env-based config)
│   └── tests/                      # Unit tests (17 tests)
├── frontend/
│   └── src/
│       ├── pages/                  # Dashboard, Incidents, IncidentDetail, Analytics
│       ├── hooks/                  # useIncidentsSocket (WebSocket hook)
│       ├── api/                    # API client functions
│       └── components/             # Reusable UI components
├── scripts/
│   └── replay_dlq.py              # DLQ replay CLI tool
├── docker-compose.yml              # Full infrastructure stack
├── Jenkinsfile                     # CI/CD pipeline
└── DOCUMENTATION.md                # This file
```

---

## 12. Design Patterns Used

| Pattern | Where | Why |
|---|---|---|
| **State Pattern** | `domain/state_machine.py` | Enforces valid incident lifecycle transitions with per-state validation rules |
| **Strategy Pattern** | `domain/alerts.py` | Pluggable severity/alerting logic per component type without if/else chains |
| **Repository Pattern** | `services/incidents.py` | Separates business logic from database access |
| **Event-Driven Architecture** | Kafka pipeline | Decouples producers (API) from consumers (Worker) for resilience and scale |
| **Cache-Aside Pattern** | `cache.py` | Worker writes to both DB and cache; reads always hit cache first |
| **Circuit Breaker (soft)** | API Kafka fallback | Gracefully degrades to Redis buffer when Kafka is unavailable |
| **Idempotent Consumer** | Worker `event_id` check | Safely handles at-least-once Kafka delivery without duplicates |

---

## 13. Testing

The test suite covers the core domain logic that doesn't require external services:

| Test File | What It Tests |
|---|---|
| `test_state_machine_transitions.py` | Happy path transitions, invalid transition rejection, close-without-RCA rejection |
| `test_alert_strategy.py` | Correct severity mapping for all 7 component types |
| `test_close_requires_rca.py` | `can_close_incident()` logic with missing/incomplete/complete RCA |
| `test_rca_validation.py` | `is_rca_complete()` with missing fields, end-before-start, and valid input |

**All 17 tests pass.**

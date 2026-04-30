# Project Context

## Purpose
Build a mission-critical Incident Management System (IMS) for an engineering assignment.

The IMS ingests high-volume “signals” (errors/latency spikes), debounces bursts into
workflow-driven “Work Items” (incidents), stores raw signals for audit, maintains a real-time
dashboard state, and enforces Root Cause Analysis (RCA) before closure.

## Tech Stack
- Backend: Python 3.11, FastAPI, Uvicorn
- Broker: Kafka API (Redpanda container in `docker-compose.yml`)
- Worker: Python async consumer (aiokafka)
- Source of truth: PostgreSQL (async SQLAlchemy + asyncpg)
- Raw signals store: MongoDB
- Cache/dashboard state: Redis
- Frontend: Static HTML + HTMX served via Nginx

## Project Conventions

### Code Style
- Prefer small, explicit modules over heavy abstraction.
- Use typed Pydantic models at API boundaries.
- Keep ingestion API “thin” (enqueue only) to preserve backpressure.
- Use UTC timestamps (`datetime` with timezone) and ISO-8601 over the wire.

### Architecture Patterns
- Event-driven ingestion (API → broker → worker) to absorb spikes and isolate slow storage.
- Strategy pattern for severity/alerting per `component_type`.
- State machine for Work Item lifecycle (OPEN → INVESTIGATING → RESOLVED → CLOSED).
- Redis cache as the hot-path for dashboard reads.

### Testing Strategy
- Unit tests for RCA completeness validation and “cannot close without RCA” rule.
- Keep tests fast and deterministic (no Docker dependency for unit tests).

### Git Workflow
- Not enforced for this assignment repository.

## Domain Context
- A “signal” is a raw event (error/latency) associated with a `component_id` and `component_type`.
- Debounce requirement: 100 signals for the same `component_id` within 10 seconds must create
  exactly 1 Work Item, while all raw signals remain stored and linked.
- “RCA” is mandatory for closure and drives MTTR computation.

## Important Constraints
- Ingestion must tolerate bursts up to 10,000 signals/sec without blocking on persistence.
- Work Item transitions must be transactional and concurrency-safe.
- Observability: `/health` endpoint and throughput logs every 5 seconds.

## External Dependencies
- Docker Compose provides Postgres, Mongo, Redis, and Kafka API broker (Redpanda).

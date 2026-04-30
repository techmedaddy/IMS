# Proposal: IMS MVP Scaffold

## Why
This repository is an engineering assignment to build a resilient Incident Management System (IMS).
The current repo contains only design notes; it needs an executable, end-to-end implementation with
Docker Compose, a working UI, a sample signal generator, and tests for critical workflow rules.

## What Changes
- Add `/backend` (FastAPI ingestion API + async worker).
- Add `/frontend` (simple responsive dashboard using HTMX served by Nginx).
- Add `docker-compose.yml` to run Postgres, MongoDB, Redis, and a Kafka-compatible broker.
- Implement the core assignment behaviors:
  - Async ingestion with backpressure via broker buffering
  - Debounce rule (100 signals/10s → 1 Work Item; all signals linked)
  - Workflow engine (state machine + mandatory RCA before CLOSED)
  - MTTR calculation on RCA submission
  - `/health`, rate limiting, and throughput logs every 5 seconds
- Add a sample script to generate a realistic “stack outage” signal burst.
- Add unit tests for RCA completeness validation.

## Impact
- New code and runtime services are introduced; running the system requires Docker.
- The README will be updated to include architecture diagram, setup steps, and backpressure details.

## Out of Scope
- Authentication/authorization
- Multi-tenant routing, SSO, audit roles
- Production hardening (TLS, secret managers, HA broker configs)

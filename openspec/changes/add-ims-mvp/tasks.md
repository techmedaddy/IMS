## 1. Repository Scaffold
- [x] 1.1 Add `backend/` service layout and Dockerfile
- [ ] 1.2 Add `frontend/` static UI and Nginx config
- [ ] 1.3 Add `docker-compose.yml` and `.env.example`

## 2. Backend API (FastAPI)
- [x] 2.1 Implement `/api/health`
- [x] 2.2 Implement `/api/signals` (rate-limited, enqueue-only)
- [x] 2.3 Implement incident read APIs (list/detail) from Redis + Mongo
- [x] 2.4 Implement workflow APIs (state transitions + RCA submission)

## 3. Worker
- [x] 3.1 Consume `ims.signals` topic and persist raw signals to MongoDB
- [x] 3.2 Implement debounce rule + Work Item creation in Postgres
- [x] 3.3 Maintain dashboard cache in Redis and flush timeseries aggregates
- [x] 3.4 Print throughput metrics every 5 seconds

## 4. Tests & Sample Data
- [x] 4.1 Add unit tests for RCA validation / close gating
- [ ] 4.2 Add `scripts/simulate_outage.py` to generate sample signal bursts

## 5. Documentation
- [ ] 5.1 Replace existing README with required submission format
- [ ] 5.2 Add architecture diagram + “Backpressure handling” section

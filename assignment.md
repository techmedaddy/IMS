IMS — Technical Design & Stack Justification
============================================

1\. Problem Framing
-------------------

The system must:

*   ingest up to **10,000 signals/sec**
    
*   prevent overload when storage is slow
    
*   deduplicate bursts (debounce)
    
*   maintain a **transactionally consistent incident lifecycle**
    
*   expose a low-latency dashboard
    
*   enforce RCA before closure
    

This is a **distributed, write-heavy, latency-sensitive system**. A monolithic request–response design will fail.

2\. Architectural Style
-----------------------

**Event-driven, queue-backed, multi-storage architecture**

```text
Client → API (FastAPI) → Kafka → Workers → Storage Layer
                                  ├─ PostgreSQL (source of truth)
                                  ├─ MongoDB (raw signals)
                                  ├─ Redis (cache)
                                  └─ Aggregation layer
```

### Rationale

*   decouples ingestion from processing
    
*   absorbs burst traffic
    
*   isolates failure domains
    
*   enables horizontal scaling
    

3\. Tech Stack Choices (with justification)
-------------------------------------------

### 3.1 API Layer

*   **FastAPI**
    

**Why:**

*   async I/O support
    
*   fast development speed
    
*   strong validation (Pydantic)
    
*   aligns with JD stack
    

**Design constraint:**

*   API must remain **thin**
    
*   no business logic or DB writes in request path
    

### 3.2 Message Broker (Core Component)

*   **Apache Kafka**
    

**Why Kafka:**

*   high-throughput ingestion (10k/sec easily handled)
    
*   durable log (replay capability)
    
*   partitioning → horizontal scalability
    
*   decouples producers and consumers
    

**Design role:**

*   buffer spikes
    
*   enable backpressure handling
    
*   isolate API from slow storage
    

### 3.3 Worker Layer

*   Python-based consumers
    

**Responsibilities:**

*   consume events from Kafka
    
*   perform **debounce logic**
    
*   create/update WorkItems
    
*   trigger alert strategies
    

**Why separate workers:**

*   prevents API blocking
    
*   allows independent scaling
    
*   isolates heavy processing
    

### 3.4 Database Strategy (polyglot persistence)

Single DB = incorrect for this system.

#### A. Source of Truth

*   **PostgreSQL**
    

**Stores:**

*   WorkItems
    
*   RCA records
    
*   state transitions
    

**Why:**

*   ACID guarantees
    
*   transactional updates
    
*   consistent lifecycle management
    

#### B. Raw Signal Store

*   **MongoDB**
    

**Stores:**

*   high-volume signal payloads
    
*   linked to WorkItems
    

**Why:**

*   flexible schema
    
*   high write throughput
    
*   optimized for append-heavy workloads
    

#### C. Cache Layer

*   **Redis**
    

**Stores:**

*   active incident snapshot
    
*   dashboard state
    

**Why:**

*   sub-millisecond reads
    
*   reduces DB load
    
*   enables real-time UI
    

#### D. Aggregation Layer

*   PostgreSQL (or extension like Timescale)
    

**Stores:**

*   time-series metrics
    
*   MTTR calculations
    

4\. Core Design Decisions
-------------------------

### 4.1 Event-Driven Ingestion

**Decision:**All signals go through Kafka before processing.

**Why:**

*   prevents cascading failure
    
*   supports burst absorption
    
*   enables async processing
    

### 4.2 Debounce Mechanism

**Requirement:**100 signals in 10 seconds → 1 WorkItem

**Implementation:**

*   worker groups by component\_id
    
*   sliding window (time-based aggregation)
    
*   signals stored individually (MongoDB)
    
*   single incident created (PostgreSQL)
    

**Impact:**

*   reduces noise
    
*   improves operator clarity
    

### 4.3 State Machine (Workflow Engine)

**States:**

```text
OPEN → INVESTIGATING → RESOLVED → CLOSED
```

**Implementation:**

*   State pattern (class-based transitions)
    
*   transition validation rules
    

**Critical Rule:**

*   CLOSED requires RCA object
    

**Why:**

*   prevents invalid transitions
    
*   enforces lifecycle integrity
    

### 4.4 Strategy Pattern (Alerting)

**Decision:**Alert logic varies by component type.

Example:

*   DB failure → high severity
    
*   cache failure → lower severity
    

**Implementation:**

*   pluggable strategy classes
    

**Why:**

*   extensibility
    
*   avoids hardcoded logic
    

### 4.5 Backpressure Handling

**Problem:**DB slowdown can crash system

**Solution:**

*   Kafka buffers incoming load
    
*   API only enqueues, never blocks
    

**Result:**

*   ingestion remains stable under load
    

### 4.6 Cache-First Dashboard

**Decision:**UI reads from Redis, not Postgres

**Why:**

*   avoids heavy query load
    
*   ensures real-time performance
    

5\. Data Flow
-------------

```text
1. Signal arrives → FastAPI
2. API validates → pushes to Kafka
3. Worker consumes
4. Debounce logic applied
5. Signals → MongoDB
6. WorkItem → PostgreSQL
7. Cache updated → Redis
8. UI reads from Redis
```

6\. Concurrency & Scaling
-------------------------

### Horizontal Scaling

*   Kafka partitions → multiple consumers
    
*   worker replicas → parallel processing
    
*   Redis shared cache
    

### Concurrency Control

*   Postgres transactions for state updates
    
*   idempotent processing (avoid duplicate WorkItems)
    

7\. Observability
-----------------

Required features:

*   /health endpoint
    
*   throughput metrics (signals/sec)
    
*   MTTR calculation
    

**Purpose:**

*   system introspection
    
*   operational visibility
    
*   debugging support
    

8\. Failure Handling
--------------------

### Retry Strategy

*   Kafka consumer retries
    
*   DB write retries
    

### Dead Letter Handling

*   failed messages moved to retry queue / DLQ
    

9\. Why This Architecture Is Correct
------------------------------------

| Requirement | Design response |
|---|---|
| High throughput | Kafka + async workers |
| No system crash under load | Queue buffering / backpressure |
| Data integrity | PostgreSQL transactions |
| Flexible logging | MongoDB |
| Fast UI | Redis |
| Lifecycle enforcement | State pattern |

10\. Trade-offs
---------------

### Complexity

*   multi-service system
    
*   multiple databases
    

**Accepted because:**

*   matches real production systems
    

### Operational Overhead

*   Kafka setup
    
*   multiple services
    

**Accepted because:**

*   necessary for scale and resilience
    

11\. Summary
------------

This system is designed as a:

*   **distributed, event-driven incident platform**
    
*   with **strict separation of concerns**
    
*   optimized for **high throughput, resilience, and correctness**
    

Framework choice is secondary.Architecture is the primary signal of competence.
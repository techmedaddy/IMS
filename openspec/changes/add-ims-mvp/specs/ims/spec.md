## ADDED Requirements

### Requirement: Async Signal Ingestion
The system MUST accept signals via an HTTP ingestion API and enqueue them to the broker for async processing.
The ingestion path MUST NOT block on database writes.

#### Scenario: Valid signal accepted
- **GIVEN** a well-formed signal payload
- **WHEN** the client POSTs to `/api/signals`
- **THEN** the API returns `202 Accepted`
- **AND** the signal is produced to the broker keyed by `component_id`

#### Scenario: Over rate limit
- **GIVEN** the client exceeds the configured rate limit
- **WHEN** the client POSTs to `/api/signals`
- **THEN** the API returns `429 Too Many Requests`

### Requirement: Debounce → Work Item Creation
If 100 signals arrive for the same `component_id` within 10 seconds, exactly one Work Item MUST be created.
All raw signals MUST be stored in the NoSQL store and linked to the Work Item.

#### Scenario: 100 signals in 10 seconds creates one Work Item
- **GIVEN** 100 signals for `CACHE_CLUSTER_01` arrive within 10 seconds
- **WHEN** the worker processes the stream
- **THEN** exactly one Work Item is created for `CACHE_CLUSTER_01`
- **AND** all signals in the window are linked to that Work Item in the NoSQL store

### Requirement: Workflow Engine & Mandatory RCA
Work Items MUST transition through `OPEN → INVESTIGATING → RESOLVED → CLOSED`.
The system MUST reject any attempt to transition a Work Item to `CLOSED` if the RCA object is missing or incomplete.

#### Scenario: Reject close without complete RCA
- **GIVEN** a Work Item without a complete RCA
- **WHEN** a client requests transition to `CLOSED`
- **THEN** the request is rejected

### Requirement: Dashboard Reads From Cache
The dashboard MUST read the real-time incident list from the cache hot-path.
Active incidents MUST be sorted by severity for display.

#### Scenario: New Work Item appears in the live feed
- **GIVEN** a new Work Item is created
- **WHEN** the dashboard refreshes
- **THEN** the Work Item appears in the live feed without querying the source-of-truth DB

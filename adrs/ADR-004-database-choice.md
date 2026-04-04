# ADR-004: Database Choice — PostgreSQL and MongoDB

## Status
Accepted

## Context
The system stores two fundamentally different types of data:

1. **User and session data** — structured, relational, requires ACID
   guarantees. A user record has a fixed schema (id, email, name, role).
   Sessions reference users with a foreign key. Referential integrity matters:
   deleting a user must cascade to their sessions.

2. **Chat messages and rooms** — document-like, high write volume, schema can
   evolve (reactions, attachments, message types). The messages collection
   receives the highest write throughput in the system (10,000 concurrent
   users, each potentially sending multiple messages per minute).

A single database cannot serve both profiles optimally. A relational database
under high write throughput degrades. A document store lacks the ACID
guarantees needed for auth and billing-grade user data.

## Decision
We adopt a **polyglot persistence** strategy:

- **PostgreSQL** for the Auth Service and User Service. Stores `users` and
  `sessions` tables. Chosen for: ACID compliance, foreign key constraints,
  mature ecosystem, and strong support for UUID primary keys and
  timestamp-based range partitioning.

- **MongoDB** for the Chat Service. Stores `messages` and `rooms`
  collections. Chosen for: document model maps naturally to JSON message
  objects, horizontal scaling via sharding on `room_id`, and high write
  throughput without schema migration overhead when message formats evolve.

Each service owns its own database exclusively. No service queries another
service's database directly — all cross-service data access goes through
REST APIs (database-per-service pattern).

## Consequences

**Positive:**
- Each database is optimized for its actual workload
- Auth data has ACID guarantees; chat data has horizontal scalability
- Services are independently deployable with no shared database state
- MongoDB sharding on `room_id` keeps message queries local to one shard

**Negative:**
- Two database systems to operate, monitor, and back up
- No cross-database joins — cross-service data must be fetched via API calls
- Development teams must be familiar with both SQL and MongoDB query syntax
- Increased infrastructure cost (two separate DB clusters)

## Alternatives Considered

**Single PostgreSQL for everything:**
Rejected. Chat messages do not benefit from relational constraints. Under high
write volume, PostgreSQL's MVCC and WAL overhead creates bottlenecks that
MongoDB's write path avoids. Message schema evolution (e.g., adding reactions)
requires ALTER TABLE migrations that are risky at scale.

**Single MongoDB for everything:**
Rejected. User and session data require ACID transactions and referential
integrity (e.g., deleting a user must atomically remove all sessions). MongoDB
multi-document transactions exist but add latency and complexity. PostgreSQL
handles this natively and more efficiently.

**MySQL instead of PostgreSQL:**
Rejected. PostgreSQL has native UUID support, better JSONB capabilities for
semi-structured data, and superior support for range partitioning on the
`sessions` table by expiry date. Both are valid choices, but PostgreSQL is
better suited to this system's requirements.
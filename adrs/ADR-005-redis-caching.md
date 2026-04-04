# ADR-005: Redis for Session Management and Message Caching

## Status
Accepted

## Context
Two distinct performance problems require an in-memory store:

1. **Session validation on every request** — The API Gateway validates the
   JWT and checks that the session has not been invalidated (logout) on every
   single API call. Hitting PostgreSQL for a session lookup on every request
   would add 10–30ms of latency per call and create unnecessary DB load.

2. **Recent message cache** — When a user opens a chat room, the UI loads the
   last 50 messages. This is the most frequent read operation in the system.
   Serving it from MongoDB on every room open is expensive at scale. These
   messages change infrequently relative to how often they are read.

3. **Real-time broadcast coordination** — Multiple Chat Service instances
   (horizontal scaling) each hold their own set of WebSocket connections.
   When a new message arrives, it must be broadcast to all connected clients
   across all instances, not just the one that received the POST request.
   A shared pub/sub channel is required.

## Decision
We use **Redis** as a shared in-memory store with three distinct usage patterns:

**Pattern 1 — Session Store (Auth Service)**
- Key format: `session:{userId}`
- Value: `{ tokenHash, role, expiresAt }` (JSON string)
- TTL: 3600 seconds (matches JWT expiry)
- On logout: `DEL session:{userId}` — token is invalid immediately
- On request: Auth Middleware calls `GET session:{userId}`, checks `tokenHash`
  matches the hash of the incoming JWT. If key is missing or hash mismatches,
  reject with 401.

**Pattern 2 — Message Cache (Chat Service)**
- Key format: `room:messages:{roomId}`
- Value: JSON array of the last 50 messages
- TTL: 300 seconds (5 minutes)
- On new message: append to cache list, trim to 50 items, reset TTL
- On cache miss: fetch from MongoDB, populate cache, serve response
- Cache eviction: TTL-based only. No manual invalidation except on message
  edit or delete (which calls `DEL room:messages:{roomId}`)

**Pattern 3 — Pub/Sub for WebSocket Broadcast (Chat Service)**
- Channel format: `room:{roomId}:events`
- When Chat Service instance A receives a new message, it publishes to the
  channel. All Chat Service instances subscribed to that channel push the
  event to their connected WebSocket clients.
- This decouples horizontal scaling from broadcast state — no sticky sessions
  required.

## Consequences

**Positive:**
- Session validation adds < 1ms latency (in-memory lookup vs. SQL query)
- Room history reads are served from cache in the majority of cases,
  reducing MongoDB read load by an estimated 80% for active rooms
- Pub/sub enables stateless Chat Service horizontal scaling
- TTL-based expiry handles session cleanup automatically

**Negative:**
- Redis is a required infrastructure dependency — the system cannot function
  without it
- Data in Redis is volatile: a Redis crash without persistence configured
  loses all cached data and active sessions (mitigated: sessions can be
  re-established via re-login; PostgreSQL remains the source of truth)
- Redis must be clustered (Redis Cluster or Sentinel) for high availability —
  a single Redis instance is a single point of failure
- Memory must be monitored — unbounded pub/sub channels or large message
  payloads can exhaust memory

## Alternatives Considered

**Memcached:**
Rejected. No pub/sub support (eliminates Pattern 3 entirely). No TTL on
individual hash fields (Pattern 1 requires field-level expiry). No persistence
option for disaster recovery. Redis is strictly more capable for this use case.

**In-memory cache within each Node.js process:**
Rejected. Not shared across multiple Chat Service instances. Each instance
would have its own cache state, causing cache misses when requests hit
different instances. Breaks horizontal scaling.

**Database-side caching (PostgreSQL/MongoDB query cache):**
Rejected. Query caches are not addressable by application logic and cannot
serve as a pub/sub bus. Cannot implement the logout invalidation pattern
(Pattern 1) without application-controlled key management.

**Storing session state in the JWT only (stateless):**
Rejected. A purely stateless JWT cannot be invalidated before its natural
expiry. A logged-out user could continue making valid API calls for up to
1 hour. This is a security requirement, not a performance preference.
# Requirements Specification — Real-Time Chat & Dashboard Application

## 1. Functional Requirements

### 1.1 User Authentication
- Users can log in using Google OAuth2
- System issues a signed JWT (RS256) upon successful login
- Sessions are stored in Redis with a 1-hour TTL
- Users can log out, which invalidates their session in Redis
- Role-based access control: roles are `user` and `admin`

### 1.2 Chat (Core CRUD)
- Users can create a chat room
- Users can send a message in a room
- Users can read message history (paginated, cursor-based)
- Users can edit their own messages
- Users can delete their own messages
- Users can join and leave rooms
- Messages are delivered in real-time via WebSocket

### 1.3 User Management
- Users can view their own profile
- Users can update their profile (name, avatar)
- Users can search for other users by name or email

### 1.4 Dashboard
- Dashboard displays real-time active user count
- Dashboard displays message volume over time (chart)
- Dashboard displays system health indicators per service

---

## 2. Non-Functional Requirements

| Quality Attribute | Requirement |
|---|---|
| Scalability | System supports 10,000 concurrent users; services scale horizontally via containers |
| Resilience | Circuit breakers on all inter-service calls; 3 retries with exponential backoff (100ms, 200ms, 400ms) |
| Performance | API response time < 200ms at p95 under normal load |
| Security | OAuth2 only — no passwords stored; all JWTs expire in 1 hour; HTTPS enforced |
| Availability | 99.9% uptime target; graceful degradation when individual services fail |
| Observability | Centralized logging via OpenSearch; application and host metrics via Prometheus + Grafana |

---

## 3. User Stories

| ID | Story |
|---|---|
| US-01 | As a new user, I want to log in with my Google account so I do not need a separate password |
| US-02 | As a logged-in user, I want to send messages in a chat room so I can communicate with others |
| US-03 | As a logged-in user, I want to view my chat history so I can reference past conversations |
| US-04 | As a logged-in user, I want to edit or delete my own messages so I can correct mistakes |
| US-05 | As a logged-in user, I want to see real-time updates in the dashboard so I know system activity |
| US-06 | As an admin, I want to view all user activity logs so I can audit usage |
| US-07 | As a user, I want the app to stay responsive even if one service is slow |
| US-08 | As a developer, I want centralized logs so I can debug issues across all services |

---

## 4. Architectural Drivers

- **Scalability** — Chat and Dashboard have very different load profiles; they must scale independently
- **Resilience** — A failure in the Dashboard service must never affect the Chat or Auth service
- **Security** — Authentication is the gateway to all services; it must be hardened and stateless
- **Observability** — Distributed system failures are hard to trace without centralized logging and metrics
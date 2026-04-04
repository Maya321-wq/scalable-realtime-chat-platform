# ADR-007: Communication — Synchronous REST vs Asynchronous Messaging

## Status
Accepted

## Context
The system has multiple microservices that need to communicate. Two modes are available: synchronous REST (HTTP) and asynchronous messaging (RabbitMQ).
Choosing the wrong mode for a use case increases coupling or latency.

## Decision
We use both modes, selected per use case based on coupling and latency needs.

## Communication Map

| Operation              | Mode        | Reason                                      |
|----------------------|------------|---------------------------------------------|
| User login / OAuth2  | Sync REST  | Client needs JWT immediately                |
| Send/edit/delete msg | Sync REST  | Client needs confirmation of save           |
| Real-time delivery   | WebSocket  | Low-latency push to connected clients       |
| Dashboard metrics    | Async AMQP | Eventual consistency acceptable             |
| Log shipping         | Async Beats| Fire-and-forget, no response needed         |

## Synchronous (REST over HTTP)
Used for all client-facing operations. The API Gateway routes these requests.
Services: Auth Service, Chat Service, User Service.
Timeout: 5 seconds enforced at the API Gateway level.

## Asynchronous (RabbitMQ AMQP)
Used for Chat Service → Dashboard Service event flow.
When a new message is saved, the Chat Service publishes a "message_created" event to RabbitMQ.
The Dashboard Service consumes these events to update metrics. No response is expected.

## Consequences
+ Services are decoupled — Chat does not wait for Dashboard to respond
+ Dashboard failures do not affect Chat Service response time
+ REST calls are easy to debug and test individually
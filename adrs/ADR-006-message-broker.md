# ADR-006: Message Broker — RabbitMQ for Async Communication

## Status
Accepted

## Context
When a user sends a message, the Dashboard Service needs to update its metrics
(message count, active users). If this update is done synchronously, the Chat Service
must wait for the Dashboard Service to respond before confirming the message to the user.
This creates tight coupling and increases response latency.

## Decision
We use **RabbitMQ** as the async message broker between the Chat Service (producer)
and the Dashboard Service (consumer).

When a message is created:
1. Chat Service saves to MongoDB and immediately returns 200 to the client
2. Chat Service publishes a `message.created` event to RabbitMQ (fire and forget)
3. Dashboard Service consumes the event asynchronously and updates metrics

RabbitMQ was chosen over Kafka because:
- Our message volume does not require Kafka's throughput (Kafka is designed for millions/sec)
- RabbitMQ has simpler setup and operations for a team new to message brokers
- AMQP protocol gives reliable delivery with acknowledgments out of the box
- Better suited for task queues; Kafka is better for event streaming at scale

## Consequences
**Positive:**
- Chat Service response time is not affected by Dashboard Service performance
- Services are decoupled — Dashboard can be restarted without Chat losing messages (RabbitMQ queues buffer them)
- Reliable delivery with message acknowledgment

**Negative:**
- Adds one more infrastructure component to operate
- Dashboard metrics are eventually consistent (slight delay after message is sent)
- Requires dead-letter queue configuration for failed message handling

## Alternatives Considered
- **Kafka** — Rejected. Overkill for our scale, steeper learning curve, harder to operate.
- **Synchronous HTTP call** — Rejected. Tight coupling, increases Chat Service response time, Chat fails if Dashboard is down.
- **Redis Pub/Sub** — Rejected. No message persistence — if Dashboard is offline, events are lost.
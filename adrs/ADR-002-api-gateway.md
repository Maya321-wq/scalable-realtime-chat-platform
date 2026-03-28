# ADR-002: API Gateway Selection

## Status
Accepted

## Context
All client requests must be authenticated before reaching any microservice.
Without a gateway, each service would need to implement its own JWT validation,
rate limiting, and SSL termination — duplicating logic across four services.

## Decision
We use **Kong Gateway** as the API Gateway. Kong is deployed as the single entry point
for all client traffic. It handles:
- JWT validation on every request before forwarding to services
- Rate limiting (100 requests/minute per user)
- SSL/TLS termination
- Request routing to the correct microservice based on path prefix
- Request logging forwarded to OpenSearch

Alternative if Kong setup is complex: **NGINX with lua-resty-jwt** for JWT validation.

## Consequences
**Positive:**
- Single point for auth enforcement — no service needs to re-implement it
- Centralized rate limiting prevents abuse
- Easier SSL management (one certificate location)

**Negative:**
- Single point of failure if not clustered (mitigated by running multiple Gateway instances)
- Adds one network hop to every request

## Alternatives Considered
- **AWS API Gateway** — Rejected. Vendor lock-in, harder to run locally for development.
- **Custom NGINX reverse proxy** — Rejected. High maintenance burden for JWT plugin configuration.
- **No gateway (direct service calls)** — Rejected. Forces every service to implement auth, rate limiting, and logging independently.
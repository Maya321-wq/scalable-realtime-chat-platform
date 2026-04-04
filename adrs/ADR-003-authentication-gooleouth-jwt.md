# ADR-003: Authentication — Google OAuth2 and JWT

## Status
Accepted

## Context
The system requires user authentication and authorization. Users must be
logged in before sending messages or viewing the dashboard. We needed to
decide how to handle login and how to verify identity on every API request
without hitting the database each time. The project spec requires OAuth2
via Google as the authentication method.

## Decision
We use Google OAuth2 via Passport.js for the initial login handshake.
After a successful Google callback, the Auth Service issues a signed JWT
using the RS256 algorithm with a 1-hour expiry.

Token storage: The JWT is stored in memory only (a JavaScript variable)
on the client — never in localStorage or sessionStorage — to prevent XSS.
It is sent on every request in the Authorization: Bearer {token} header.

Session invalidation: A SHA-256 hash of the JWT is stored in Redis with
a TTL matching the token expiry. On logout, the Redis key is deleted,
making the token invalid immediately even before its natural expiry.

## Consequences
+ No password storage, reset flows, or brute-force protection needed
+ Google handles MFA and account security for us
+ JWT is stateless — verification needs no database call per request
+ Redis enables immediate logout (invalidation before expiry)
- Requires a Google account — users without one cannot log in
- RS256 requires a private/public key pair to be securely managed
- Redis becomes a required dependency for logout functionality

## Alternatives Considered
Local username/password: Rejected. Requires bcrypt hashing, password
reset email flows, and brute-force protection — high security risk and
high development effort with no advantage over OAuth2.

Auth0 / Okta: Rejected. External vendor dependency, ongoing cost, and
over-engineered for this project. Google OAuth2 achieves the same result
with no vendor lock-in.

Session-based auth (server-side cookies): Rejected. Requires sticky
sessions or a shared session store across all Auth Service instances,
which breaks horizontal scaling — a core architectural requirement.
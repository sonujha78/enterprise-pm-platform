# Security Documentation

## Authentication
- Passwords hashed with **bcrypt** (10 salt rounds), never stored or logged in plaintext.
- **JWT access tokens** (15 min expiry) and **refresh tokens** (7 day expiry), signed with
  separate secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
- Refresh tokens are **hashed (SHA-256) and stored in Redis** with a TTL matching their
  expiry. A refresh request checks the hash against Redis, meaning tokens can be revoked
  server-side (logout, rotation) — a capability a stateless JWT alone doesn't have.
- **Refresh-token rotation**: every refresh invalidates the old token and issues a new one,
  limiting the window a stolen refresh token remains useful.
- **Password reset / email verification** tokens are single-use, hashed before storage, and
  expire after 1 hour (reset) / on use (verification).

## Authorization
- **Role-Based Access Control (RBAC)** with four roles: `ADMIN`, `MANAGER`, `DEVELOPER`,
  `VIEWER`.
- Enforced globally via `JwtAuthGuard` + `RolesGuard` (`APP_GUARD` providers in
  `app.module.ts`) — every route is protected by default; only routes explicitly marked
  `@Public()` skip authentication.
- Per-route role restrictions via the `@Roles(...)` decorator (e.g., only `ADMIN`/`MANAGER`
  can create projects or invite users).
- **Multi-tenancy / data isolation**: every query is scoped by `organizationId` derived from
  the authenticated user's JWT payload, not from client-supplied input — a user cannot
  access another organization's data by guessing IDs.

## Input Validation
- Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`)
  rejects any request body containing fields not defined on the DTO, and coerces types.
- Every write endpoint has a dedicated DTO with `class-validator` decorators
  (`@IsEmail`, `@IsUUID`, `@IsIn`, `@MinLength`, etc.).

## Data Integrity
- **Optimistic locking** (`version` field) on `Project` and `Task` prevents lost updates —
  a stale update is rejected with `409 Conflict` rather than silently overwriting concurrent
  changes.
- Foreign-key constraints and cascading deletes are enforced at the database level via
  Prisma's relational schema (PostgreSQL).

## Transport & Headers
- CORS enabled via `app.enableCors()`.
- API is versioned under `/api/v1` to allow non-breaking future changes.

## Secrets Management
- All secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, Redis config) are
  read from environment variables, never hardcoded.
- `.env` is git-ignored; `.env.example` documents required variables with placeholder values.
- Docker Compose injects secrets as container environment variables, not baked into the image.

## Known Gaps / Production Hardening Notes
The following are recommended for a real production deployment but are out of scope for
this assignment's environment:
- Centralized rate limiting (e.g., `@nestjs/throttler`) on auth endpoints to mitigate
  brute-force attempts.
- Helmet.js for security headers (CSP, HSTS, X-Frame-Options).
- A real email provider (SendGrid/SES) in place of the logging stub in `EmailProcessor`.
- Secrets should be sourced from a vault (AWS Secrets Manager, HashiCorp Vault) rather than
  plain environment variables in production.
- TLS termination (via a reverse proxy such as Nginx) in front of the Node process.

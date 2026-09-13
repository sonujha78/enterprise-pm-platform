# System Architecture

## High-Level Overview

```mermaid
graph TB
    subgraph Client
        FE[React + TypeScript SPA]
    end

    subgraph "Backend (NestJS)"
        API[REST API /api/v1]
        Auth[Auth Module<br/>JWT + RBAC]
        Guards[Global Guards<br/>JwtAuthGuard + RolesGuard]
        Modules[Feature Modules<br/>Orgs / Teams / Projects / Tasks /<br/>Notifications / Dashboard]
        Queue[BullMQ Workers<br/>Email + Reminders]
        Health[Health Check<br/>/api/v1/health]
        Docs[Swagger Docs<br/>/api/docs]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>via Prisma ORM)]
        Redis[(Redis<br/>Sessions, Cache, Queue)]
    end

    subgraph "CI/CD"
        GH[GitHub Actions<br/>Lint, Build, Test, Docker Build]
    end

    FE -->|HTTPS + Bearer JWT| API
    API --> Guards
    Guards --> Auth
    Guards --> Modules
    Auth -->|refresh tokens, invites, resets| Redis
    Modules -->|Prisma Client| PG
    Modules -->|cache reads| Redis
    Modules -->|enqueue jobs| Queue
    Queue -->|dequeue| Redis
    Queue -->|write notifications| PG
    API --> Health
    Health --> PG
    Health --> Redis
    API --> Docs

    GH -.->|on push/PR| API
```

## Request Flow (Example: Creating a Task)

```mermaid
sequenceDiagram
    participant Client
    participant API as NestJS Controller
    participant Guard as JwtAuthGuard + RolesGuard
    participant Service as TasksService
    participant DB as PostgreSQL (Prisma)
    participant Notif as NotificationsService
    participant Queue as BullMQ (Redis)

    Client->>API: POST /projects/:id/tasks (Bearer token)
    API->>Guard: Validate JWT + role
    Guard-->>API: Authorized
    API->>Service: createTask(dto)
    Service->>DB: INSERT task, activity_log
    alt assigneeId provided
        Service->>Notif: create(TASK_ASSIGNED)
        Notif->>DB: INSERT notification
        Notif->>Queue: enqueue email job
    end
    Service-->>API: task
    API-->>Client: 201 Created
    Queue->>Queue: EmailProcessor sends email (async)
```

## Deployment Topology (Docker Compose)

```mermaid
graph LR
    subgraph "Docker Network"
        Backend[backend container<br/>Node 20 Alpine<br/>Port 3000]
        Postgres[(postgres container<br/>PostgreSQL 16<br/>Port 5432)]
        Redis[(redis container<br/>Redis 7<br/>Port 6379)]
    end

    Backend -->|DATABASE_URL| Postgres
    Backend -->|REDIS_HOST/PORT| Redis
    Host((Host Machine)) -->|:3000| Backend
    Host -->|:5432| Postgres
    Host -->|:6379| Redis
```

## Key Design Decisions

- **Controller → Service → Repository (Prisma)** layering throughout, per assignment
  Backend Engineering Standards.
- **PostgreSQL** for all relational, transactional data (users, orgs, teams, projects, tasks).
- **Redis** serves three purposes: refresh-token/session store, dashboard analytics cache
  (60s TTL), and the BullMQ job queue backend.
- **Global guards** (`JwtAuthGuard`, `RolesGuard`) protect every route by default; routes are
  opted out explicitly with `@Public()`.
- **Optimistic locking** via a `version` field on `Project` and `Task` prevents lost updates
  when two users edit the same record concurrently.
- **Computed progress** (`completed / total` tasks) is calculated on read, never persisted,
  to avoid data-consistency drift.
- **Background jobs** (email sending, due-date reminders) run through BullMQ instead of the
  request thread, keeping API responses fast.

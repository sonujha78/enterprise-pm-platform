# Enterprise Project & Task Management Platform

Production-grade full-stack platform for managing organizations, teams, projects, tasks,
roles, notifications, and activity tracking.

## Stack
- Backend: NestJS + TypeScript
- Database: PostgreSQL (Prisma ORM)
- Cache/Queue: Redis (BullMQ)
- Frontend: React + TypeScript
- Auth: JWT (access + refresh tokens), RBAC
- Docs: Swagger/OpenAPI
- CI/CD: GitHub Actions
- Containerization: Docker / Docker Compose

## Structure

```
enterprise-pm-platform/
├── backend/      # NestJS API
├── frontend/     # React app
├── docker/       # docker-compose, Dockerfiles
├── docs/         # ER diagram, architecture diagram, API docs
└── .github/      # CI/CD workflows
```

## Status
🚧 Work in progress — see commit history for build stages.

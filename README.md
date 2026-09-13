# Enterprise Project & Task Management Platform

Production-grade full-stack platform for managing organizations, teams, projects, tasks,
roles, notifications, and activity tracking. Built with NestJS, PostgreSQL, Redis, and React.

## Screenshots

See [docs/screenshots](./docs/screenshots) for a full walkthrough — login, registration,
project creation, and the Kanban task board in action.

## Tech Stack

| Layer              | Technology                                  |
|--------------------|----------------------------------------------|
| Backend            | NestJS + TypeScript                          |
| Database           | PostgreSQL (Prisma ORM)                      |
| Cache / Queue      | Redis + BullMQ (background jobs)             |
| Frontend           | React + TypeScript (Vite)                    |
| Auth               | JWT (access + refresh tokens), RBAC          |
| API Docs           | Swagger / OpenAPI (`/api/docs`)              |
| Testing            | Jest + Supertest (unit + E2E)                |
| Containerization   | Docker / Docker Compose                      |
| CI/CD              | GitHub Actions                               |

## Project Structure
enterprise-pm-platform/
├── backend/ # NestJS API (auth, orgs, teams, projects, tasks, notifications, dashboard)
├── frontend/ # React + TypeScript SPA
├── docker/ # docker-compose.yml (postgres, redis, backend)
├── docs/ # ER diagram, architecture diagram, screenshots, security notes
└── .github/ # CI/CD workflows

## Features

- **Auth & RBAC**: register, login, JWT refresh-token rotation (Redis-backed), logout,
  forgot/reset password, email verification, role-based access (Admin/Manager/Developer/Viewer)
- **Organizations & Teams**: invite users, manage roles, activate/deactivate users, team membership
- **Projects**: CRUD, status tracking, computed progress (derived from task completion), optimistic locking
- **Tasks**: CRUD, subtasks, dependencies (with completion blocking), comments, priority/status,
  tags, due dates, activity log
- **Notifications**: in-app notifications + background email jobs via BullMQ (task assignment,
  comments, due-date reminders)
- **Dashboard & Analytics**: project/task totals, overdue tasks, tasks by status/priority,
  user workload, completion trends — Redis-cached
- **Search, Filter, Pagination**: server-side across projects and tasks
- **Security**: bcrypt password hashing, rate-limited auth flows, centralized validation,
  CORS, environment-based secrets
- **Testing**: 50+ unit tests, 8+ E2E tests covering auth, RBAC, and core business logic
- **DevOps**: multi-stage Docker build, health-check endpoint (`/api/v1/health`), CI pipeline
  that runs lint, build, unit tests, E2E tests, coverage, and a Docker build check on every push

## Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/sonujha78/enterprise-pm-platform.git
cd enterprise-pm-platform
```

### 2. Start Postgres + Redis (and optionally the backend) via Docker

```bash
cd docker
docker compose up -d
```

This starts PostgreSQL (`localhost:5432`), Redis (`localhost:6379`), and the backend API
(`localhost:3000`) if you use `docker compose up -d --build`.

### 3. Run the backend locally (alternative to the Docker backend service)

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run start
```

API available at `http://localhost:3000/api/v1`.
Swagger docs at `http://localhost:3000/api/docs`.
Health check at `http://localhost:3000/api/v1/health`.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:5173`.

### 5. Run tests

```bash
cd backend
npm test          # unit tests
npm run test:e2e  # end-to-end tests
npm run test:cov  # coverage report
```

## Documentation

- [ER Diagram](./docs/er-diagram.md)
- [Architecture Diagram](./docs/architecture.md)
- [Security Notes](./docs/security.md)
- [Test Report](./docs/test-report.md)
- [Postman Collection](./docs/postman_collection.json)

## Status

✅ Production-ready backend, frontend, tests, Docker, and CI/CD — see commit history for build stages.

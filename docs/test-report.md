# Test Report

## Summary

| Suite Type   | Files | Test Cases | Status |
|--------------|-------|------------|--------|
| Unit tests   | 6     | 50         | ✅ Passing |
| E2E tests    | 2     | 8          | ✅ Passing |
| **Total**    | **8** | **58**     | ✅ All passing |

Run locally with:
```bash
cd backend
npm test          # unit tests
npm run test:e2e  # end-to-end tests
npm run test:cov  # coverage report
```

## Unit Test Coverage by Module

| Module            | What's Covered                                                        |
|--------------------|------------------------------------------------------------------------|
| `AuthService`       | Register (duplicate email, success), login (invalid/inactive/wrong password, success), logout |
| `OrganizationsService` | Get org (not found), invite user (conflict, success), deactivate self (forbidden), activate/deactivate |
| `ProjectsService`   | Create (0% progress), get (50%/100% computed progress), update (not found, version conflict, success), add member (not found, conflict) |
| `TasksService`      | Create (project/parent not found, success, assignee notification), update (not found, version conflict, blocked-dependency rejection, success), dependencies (self-dependency, not found, conflict, success), delete |
| `TeamsService`      | Create, get (not found), add/remove member (not found, conflict, success) |
| `RolesGuard`        | Allow when no roles required, allow on role match, deny on role mismatch |

## E2E Test Coverage

| Flow | Scenarios |
|------|-----------|
| App bootstrap | Root route requires authentication (401) |
| Auth flow | Register → tokens returned; duplicate email rejected (409); invalid login rejected (401); valid login returns tokens; protected route rejects missing token (401); protected route succeeds with valid token; invalid payload rejected (400) |

E2E tests run against a real PostgreSQL + Redis instance (see `.github/workflows/ci.yml`),
exercising the full HTTP → Guard → Service → Prisma → Database path.

## Edge Cases Covered
- Duplicate email registration
- Invalid credentials / inactive user login
- Missing / invalid JWT on protected routes
- Optimistic-locking version mismatch (concurrent edit conflict)
- Self-referential task dependency
- Completing a task with incomplete blocking dependencies
- Adding a project/team member who is already a member
- Deactivating one's own account (forbidden)
- Invalid request payloads (missing required fields)

## CI Integration
Every push and pull request to `main`/`develop` runs, via GitHub Actions
(`.github/workflows/ci.yml`):
1. Install dependencies
2. Generate Prisma client + run migrations against a fresh Postgres service container
3. Lint
4. Build
5. Unit tests
6. E2E tests
7. Coverage report
8. Docker image build check

See the [Actions tab](https://github.com/sonujha78/enterprise-pm-platform/actions) for
run history.

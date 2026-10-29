# TaskApp backend

Node.js 22 + Express 5 REST API backed by PostgreSQL, instrumented for Kubernetes and Prometheus.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/healthz` | Liveness probe — `200 {"status":"ok"}` while the process runs |
| GET | `/readyz` | Readiness probe — `200` if `SELECT 1` succeeds, otherwise `503` |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/info` | `{ version, environment, pod }` |
| GET | `/api/tasks` | List tasks (newest first) |
| POST | `/api/tasks` | Create — body `{ "title": "..." }` (1–200 chars) → `201` |
| PATCH | `/api/tasks/:id/toggle` | Toggle `done` → `200`, or `404` |
| DELETE | `/api/tasks/:id` | Delete → `204`, or `404` |

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `taskapp` | Database name |
| `DB_USER` | `taskapp` | Database user |
| `DB_PASSWORD` | `taskapp` | Database password |
| `APP_ENV` | `local` | Shown by `/api/info` |
| `APP_VERSION` | `dev` | Shown by `/api/info` (set to the image tag in Kubernetes) |

## Metrics

| Metric | Type | Labels |
| --- | --- | --- |
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status` |
| Node.js default metrics | various | — (CPU, memory, event loop lag, GC) |

## Behaviour on Kubernetes

- **Startup:** creates the `tasks` table if missing, retrying the DB connection 10 × 3 s.
- **Shutdown:** on `SIGTERM`/`SIGINT` stops accepting connections, drains in-flight requests, closes the pool.
- **Testability:** `createApp({ repo })` takes the data layer as a dependency; tests use an in-memory repo.

## Development

```bash
npm install
npm run lint
npm test                 # node:test + supertest, no database needed

# run against a local Postgres
docker run -d --name pg -e POSTGRES_USER=taskapp -e POSTGRES_PASSWORD=taskapp -e POSTGRES_DB=taskapp -p 5432:5432 postgres:16-alpine
npm run dev              # node --watch
```

## Image

Multi-stage build on `node:22-alpine`: production dependencies only, npm/yarn removed from the runtime,
runs as UID 1000, exec-form `CMD` so Node receives signals directly.

```bash
docker build -t taskapp-backend .
```

# TaskApp frontend

React 19 + TypeScript single-page app built with Vite and served by unprivileged nginx.

## Features

- Add, complete and delete tasks
- Header badge showing **environment · version · pod** from `/api/info`, so rollouts and load balancing are visible

## How it reaches the API

The browser only calls relative `/api/...` URLs.

| Where | Who proxies `/api` | Target |
| --- | --- | --- |
| `npm run dev` | Vite dev server (`vite.config.ts`) | `http://localhost:3000` |
| Docker / Kubernetes | nginx (`nginx.conf.template`) | `$BACKEND_URL` |

At container start the nginx image runs `envsubst` on `/etc/nginx/templates/*.template`, so the same image works
with `BACKEND_URL=http://backend:3000` (Compose) and `http://taskapp-backend:3000` (Kubernetes).

nginx also serves `/nginx-health` for probes and falls back to `index.html` for client-side routes.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (expects the backend on :3000)
npm run lint       # TypeScript type-check
npm run build      # outputs dist/
```

## Image

Stage 1 builds with `node:22-alpine`; stage 2 is `nginxinc/nginx-unprivileged` (UID 101, port 8080) with only
the static build — no Node.js in the runtime image.

| Variable | Default | Description |
| --- | --- | --- |
| `BACKEND_URL` | `http://backend:3000` | Upstream for `/api/` |

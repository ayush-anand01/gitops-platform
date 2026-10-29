import express from "express";
import client from "prom-client";

// Prometheus metrics: default process metrics + RED metrics per route
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

/**
 * @param {{ repo: { list, create, toggle, remove, ping } }} deps
 */
export function createApp({ repo }) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      const labels = {
        method: req.method,
        route: req.route?.path ?? "unmatched",
        status: res.statusCode,
      };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  });

  // Liveness: the process is up
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  // Readiness: dependencies (DB) are reachable
  app.get("/readyz", async (_req, res) => {
    try {
      await repo.ping();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not ready" });
    }
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.send(await register.metrics());
  });

  app.get("/api/info", (_req, res) =>
    res.json({
      version: process.env.APP_VERSION ?? "dev",
      environment: process.env.APP_ENV ?? "local",
      pod: process.env.HOSTNAME ?? "unknown",
    }),
  );

  app.get("/api/tasks", async (_req, res) => {
    res.json(await repo.list());
  });

  app.post("/api/tasks", async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 200) {
      return res.status(400).json({ error: "title is required (max 200 chars)" });
    }
    res.status(201).json(await repo.create(title));
  });

  app.patch("/api/tasks/:id/toggle", async (req, res) => {
    const task = await repo.toggle(Number(req.params.id));
    if (!task) return res.status(404).json({ error: "not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const removed = await repo.remove(Number(req.params.id));
    if (!removed) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

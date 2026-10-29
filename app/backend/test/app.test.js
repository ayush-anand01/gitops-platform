import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";

function memoryRepo({ healthy = true } = {}) {
  let seq = 0;
  const tasks = new Map();
  return {
    async ping() {
      if (!healthy) throw new Error("db down");
    },
    async list() {
      return [...tasks.values()].reverse();
    },
    async create(title) {
      const task = { id: ++seq, title, done: false };
      tasks.set(task.id, task);
      return task;
    },
    async toggle(id) {
      const t = tasks.get(id);
      if (!t) return null;
      t.done = !t.done;
      return t;
    },
    async remove(id) {
      return tasks.delete(id);
    },
  };
}

test("healthz returns ok", async () => {
  const res = await request(createApp({ repo: memoryRepo() })).get("/healthz");
  assert.equal(res.status, 200);
});

test("readyz returns 503 when DB is down", async () => {
  const res = await request(createApp({ repo: memoryRepo({ healthy: false }) })).get("/readyz");
  assert.equal(res.status, 503);
});

test("task CRUD lifecycle", async () => {
  const app = createApp({ repo: memoryRepo() });

  const created = await request(app).post("/api/tasks").send({ title: "Ship it" });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, "Ship it");

  const toggled = await request(app).patch(`/api/tasks/${created.body.id}/toggle`);
  assert.equal(toggled.body.done, true);

  const list = await request(app).get("/api/tasks");
  assert.equal(list.body.length, 1);

  const del = await request(app).delete(`/api/tasks/${created.body.id}`);
  assert.equal(del.status, 204);
});

test("rejects empty title", async () => {
  const res = await request(createApp({ repo: memoryRepo() })).post("/api/tasks").send({ title: "  " });
  assert.equal(res.status, 400);
});

test("exposes prometheus metrics", async () => {
  const app = createApp({ repo: memoryRepo() });
  await request(app).get("/healthz");
  const res = await request(app).get("/metrics");
  assert.match(res.text, /http_requests_total/);
});

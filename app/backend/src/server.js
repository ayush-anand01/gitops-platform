import { createApp } from "./app.js";
import { createPgRepo } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const repo = createPgRepo();

// Retry migrations so the pod survives the DB starting after it
async function migrateWithRetry(attempts = 10) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await repo.migrate();
      return;
    } catch (err) {
      console.warn(`DB not ready (attempt ${i}/${attempts}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("Could not connect to database");
}

await migrateWithRetry();

const server = createApp({ repo }).listen(port, () =>
  console.log(`backend listening on :${port}`),
);

// Graceful shutdown so Kubernetes rolling updates don't drop requests
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await repo.close();
      process.exit(0);
    });
  });
}

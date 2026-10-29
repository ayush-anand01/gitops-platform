import pg from "pg";

export function createPgRepo() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "taskapp",
    password: process.env.DB_PASSWORD ?? "taskapp",
    database: process.env.DB_NAME ?? "taskapp",
    max: 10,
  });

  return {
    pool,

    async migrate() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id         SERIAL PRIMARY KEY,
          title      TEXT NOT NULL,
          done       BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    },

    async ping() {
      await pool.query("SELECT 1");
    },

    async list() {
      const { rows } = await pool.query("SELECT * FROM tasks ORDER BY id DESC");
      return rows;
    },

    async create(title) {
      const { rows } = await pool.query(
        "INSERT INTO tasks (title) VALUES ($1) RETURNING *",
        [title],
      );
      return rows[0];
    },

    async toggle(id) {
      const { rows } = await pool.query(
        "UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING *",
        [id],
      );
      return rows[0] ?? null;
    },

    async remove(id) {
      const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
      return rowCount > 0;
    },

    close: () => pool.end(),
  };
}

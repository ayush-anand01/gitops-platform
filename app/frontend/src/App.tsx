import { useEffect, useState, type FormEvent } from "react";

type Task = { id: number; title: string; done: boolean };
type Info = { version: string; environment: string; pod: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api<Task[]>("/api/tasks")
      .then(setTasks)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api<Info>("/api/info").then(setInfo).catch(() => {});
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
    setTitle("");
    load();
  }

  async function toggle(id: number) {
    await api(`/api/tasks/${id}/toggle`, { method: "PATCH" });
    load();
  }

  async function remove(id: number) {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main>
      <header>
        <h1>TaskApp</h1>
        {info && (
          <span className={`badge env-${info.environment}`}>
            {info.environment} · v{info.version} · {info.pod}
          </span>
        )}
      </header>

      {error && <p className="error">Backend error: {error}</p>}

      <form onSubmit={add}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={200}
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : ""}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
              {t.title}
            </label>
            <button className="delete" onClick={() => remove(t.id)} aria-label="Delete">
              ×
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

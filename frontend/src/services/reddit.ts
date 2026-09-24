const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getRedditStatus(): Promise<{ connected: boolean; connected_at: string | null }> {
  const resp = await fetch(`${API}/api/reddit/status`, { credentials: "include" });
  if (!resp.ok) throw new Error("Failed to get Reddit status");
  return resp.json();
}

export function connectReddit() {
  window.location.href = `${API}/api/reddit/login`;
}

export async function syncReddit(): Promise<{
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}> {
  const resp = await fetch(`${API}/api/reddit/sync`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Sync failed" }));
    throw new Error(err.detail || "Reddit sync failed");
  }
  return resp.json();
}

export async function disconnectReddit(): Promise<void> {
  await fetch(`${API}/api/reddit/disconnect`, { method: "DELETE", credentials: "include" });
}

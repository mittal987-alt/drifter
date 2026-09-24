const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getGitHubStatus(): Promise<{ connected: boolean; connected_at: string | null }> {
  const resp = await fetch(`${API}/api/github/status`, { credentials: "include" });
  if (!resp.ok) throw new Error("Failed to get GitHub status");
  return resp.json();
}

export function connectGitHub() {
  window.location.href = `${API}/api/github/login`;
}

export async function syncGitHub(): Promise<{
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}> {
  const resp = await fetch(`${API}/api/github/sync`, {
    method: "POST",
    credentials: "include",
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Sync failed" }));
    throw new Error(err.detail || "GitHub sync failed");
  }
  return resp.json();
}

export async function disconnectGitHub(): Promise<void> {
  await fetch(`${API}/api/github/disconnect`, { method: "DELETE", credentials: "include" });
}

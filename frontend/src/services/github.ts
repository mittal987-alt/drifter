import { apiClient, API_URL } from "./api";

export async function getGitHubStatus(): Promise<{ connected: boolean; connected_at: string | null }> {
  const resp = await apiClient.get("/api/github/status");
  return resp.data;
}

export function connectGitHub() {
  window.location.href = `${API_URL}/api/github/login`;
}

export async function syncGitHub(): Promise<{
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}> {
  const resp = await apiClient.post("/api/github/sync", {});
  return resp.data;
}

export async function disconnectGitHub(): Promise<void> {
  await apiClient.delete("/api/github/disconnect");
}


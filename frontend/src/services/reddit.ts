import { apiClient, API_URL } from "./api";

export async function getRedditStatus(): Promise<{ connected: boolean; connected_at: string | null }> {
  const resp = await apiClient.get("/api/reddit/status");
  return resp.data;
}

export function connectReddit() {
  window.location.href = `${API_URL}/api/reddit/login`;
}

export async function syncReddit(): Promise<{
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}> {
  const resp = await apiClient.post("/api/reddit/sync", {});
  return resp.data;
}

export async function disconnectReddit(): Promise<void> {
  await apiClient.delete("/api/reddit/disconnect");
}


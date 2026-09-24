const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface SteamSyncResult {
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}

export async function syncSteam(apiKey: string, steamId: string): Promise<SteamSyncResult> {
  const resp = await fetch(`${API}/api/history/steam-sync`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, steam_id: steamId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Steam sync failed" }));
    throw new Error(err.detail || "Steam sync failed");
  }

  return resp.json();
}

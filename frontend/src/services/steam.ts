import { apiClient } from "./api";

export interface SteamSyncResult {
  imported: number;
  duplicates: number;
  total: number;
  message: string;
}

export async function syncSteam(apiKey: string, steamId: string): Promise<SteamSyncResult> {
  const resp = await apiClient.post<SteamSyncResult>("/api/history/steam-sync", {
    api_key: apiKey,
    steam_id: steamId,
  });
  return resp.data;
}


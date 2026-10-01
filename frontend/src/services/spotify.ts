import { apiClient } from "./api";

export interface SpotifySyncResponse {
  status: string;
  message: string;
  imported: number;
  duplicates: number;
  total: number;
}

export async function syncSpotifyHistory(): Promise<SpotifySyncResponse> {
  const response = await apiClient.post<SpotifySyncResponse>("/api/spotify/sync", {});
  return response.data;
}

export async function getSpotifyProfile(): Promise<any> {
  const response = await apiClient.get("/api/spotify/profile");
  return response.data;
}

export async function getSpotifyRecent(limit = 20): Promise<any> {
  const response = await apiClient.get("/api/spotify/recent", { params: { limit } });
  return response.data;
}

export const spotifyService = {
  syncSpotifyHistory,
  getSpotifyProfile,
  getSpotifyRecent,
};


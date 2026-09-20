import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export interface SpotifySyncResponse {
  status: string;
  message: string;
  imported: number;
  duplicates: number;
  total: number;
}

export async function syncSpotifyHistory(): Promise<SpotifySyncResponse> {
  const response = await axios.post<SpotifySyncResponse>(
    `${API_URL}/api/spotify/sync`,
    {},
    { withCredentials: true },
  );
  return response.data;
}

export async function getSpotifyProfile(): Promise<any> {
  const response = await axios.get(
    `${API_URL}/api/spotify/profile`,
    { withCredentials: true },
  );
  return response.data;
}

export async function getSpotifyRecent(limit = 20): Promise<any> {
  const response = await axios.get(
    `${API_URL}/api/spotify/recent`,
    { params: { limit }, withCredentials: true },
  );
  return response.data;
}

export const spotifyService = {
  syncSpotifyHistory,
  getSpotifyProfile,
  getSpotifyRecent,
};

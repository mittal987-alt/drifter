import axios from "axios";
import type { AuthResponse } from "@/types/auth";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export const authService = {
  async getCurrentUser(): Promise<AuthResponse> {
    const response = await axios.get<AuthResponse>(
      `${API_URL}/api/auth/me`,
      {
        withCredentials: true,
      }
    );

    return response.data;
  },

  async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(
      `${API_URL}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    return response.data;
  },

  async registerWithPassword(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(
      `${API_URL}/api/auth/register`,
      { email, password, name },
      { withCredentials: true }
    );
    return response.data;
  },

  async getSyncToken(): Promise<{ user_id: number; token: string }> {
    const response = await axios.get<{ user_id: number; token: string }>(
      `${API_URL}/api/auth/token`,
      { withCredentials: true }
    );
    return response.data;
  },

  async logout(): Promise<void> {
    await axios.post(
      `${API_URL}/api/auth/logout`,
      {},
      {
        withCredentials: true,
      }
    );
  },

  async signout(): Promise<void> {
    await axios.post(
      `${API_URL}/api/auth/signout`,
      {},
      {
        withCredentials: true,
      }
    );
  },

  connectYouTube(): void {
    window.location.href =
      `${API_URL}/api/auth/google/data-portability/login`;
  },

  connectGoogleDataPortability(): void {
    window.location.href =
      `${API_URL}/api/auth/google/data-portability/login`;
  },

  connectSpotify(): void {
    window.location.href =
      `${API_URL}/api/auth/spotify/login`;
  },

  getApiUrl(): string {
    return API_URL;
  },
};
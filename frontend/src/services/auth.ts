import type { AuthResponse } from "@/types/auth";
import { apiClient, API_URL } from "./api";

export const authService = {
  async getCurrentUser(): Promise<AuthResponse> {
    const response = await apiClient.get<AuthResponse>("/api/auth/me");
    return response.data;
  },

  async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/auth/login", { email, password });
    return response.data;
  },

  async registerWithPassword(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/auth/register", { email, password, name });
    return response.data;
  },

  async getSyncToken(): Promise<{ user_id: number; token: string }> {
    const response = await apiClient.get<{ user_id: number; token: string }>("/api/auth/token");
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/api/auth/logout", {});
  },

  async signout(): Promise<void> {
    await apiClient.post("/api/auth/signout", {});
  },

  connectYouTube(): void {
    window.location.href = `${API_URL}/api/auth/google/data-portability/login`;
  },

  connectGoogleDataPortability(): void {
    window.location.href = `${API_URL}/api/auth/google/data-portability/login`;
  },

  connectSpotify(): void {
    window.location.href = `${API_URL}/api/auth/spotify/login`;
  },

  async refreshAllTokens(): Promise<{ status: string; providers: Record<string, string> }> {
    const response = await apiClient.post("/api/auth/refresh-all", {});
    return response.data;
  },

  getApiUrl(): string {
    return API_URL;
  },
};
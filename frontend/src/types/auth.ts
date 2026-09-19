export interface AuthConnection {
  provider: "youtube" | "spotify";
  connected: boolean;
  expires_at?: string | null;
}

export interface AuthUser {
  id: number;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: AuthUser;
  connections?: AuthConnection[];
}
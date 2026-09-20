export interface AuthConnection {
  provider: "youtube" | "spotify";
  connected: boolean;
  expires_at?: string | null;
}

export interface AuthUser {
  id: number;
  email?: string | null;
  name?: string | null;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: AuthUser;
  connections?: AuthConnection[];
  sync_token?: string;
  message?: string;
}
import { useCallback, useEffect, useState } from "react";
import { authService } from "@/services/auth";
import type {
  AuthConnection,
  AuthResponse,
} from "@/types/auth";

interface UseAuthReturn {
  auth: AuthResponse | null;
  loading: boolean;
  authenticated: boolean;
  connections: AuthConnection[];
  isConnected: (provider: "youtube" | "spotify") => boolean;
  logout: () => Promise<void>;
  signout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [auth, setAuth] =
    useState<AuthResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const loadAuth = useCallback(async () => {
    try {
      const data =
        await authService.getCurrentUser();

      setAuth(data);
    } catch {
      setAuth({
        authenticated: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setAuth({
        authenticated: false,
      });
    }
  };

  const isConnected = (
    provider: "youtube" | "spotify"
  ) => {
    return (
      auth?.connections?.some(
        (connection) =>
          connection.provider === provider &&
          connection.connected
      ) ?? false
    );
  };

  return {
    auth,
    loading,
    authenticated:
      auth?.authenticated ?? false,
    connections:
      auth?.connections ?? [],
    isConnected,
    logout,
    signout: logout,
    refreshAuth: loadAuth,
  };
}
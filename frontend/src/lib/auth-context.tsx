"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/api-types";
import { hasPermission, type Permission } from "@/lib/permissions";

const TOKEN_STORAGE_KEY = "roadmaster.token";

interface RegisterInput {
  fullName: string;
  phone: string;
  password: string;
  email?: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** UX-only permission check (SuperAdmin → always true). The backend enforces for real. */
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // GET /auth/me needs no permission of its own, so every active user — even one whose role
  // grants nothing — can load who they are. A 401 (expired token, deactivated account) throws
  // and the caller signs them out.
  const loadUser = useCallback(async (activeToken: string) => {
    const profile = await apiFetch<CurrentUser>("/auth/me", {
      token: activeToken,
    });
    setUser(profile);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }
    setToken(stored);
    loadUser(stored)
      .catch(() => {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [loadUser]);

  const applyToken = useCallback(
    async (accessToken: string) => {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);
      await loadUser(accessToken);
    },
    [loadUser],
  );

  const login = useCallback(
    async (phone: string, password: string) => {
      const { accessToken } = await apiFetch<{ accessToken: string }>(
        "/auth/login",
        { method: "POST", body: { phone, password } },
      );
      await applyToken(accessToken);
    },
    [applyToken],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { accessToken } = await apiFetch<{ accessToken: string }>(
        "/auth/register",
        { method: "POST", body: input },
      );
      await applyToken(accessToken);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    await loadUser(token);
  }, [token, loadUser]);

  const can = useCallback(
    (permission: Permission) => hasPermission(user, permission),
    [user],
  );
  const canAny = useCallback(
    (...permissions: Permission[]) =>
      permissions.some((permission) => hasPermission(user, permission)),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refreshUser, can, canAny }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

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
import { decodeJwt } from "@/lib/jwt";
import type { User } from "@/lib/api-types";

const TOKEN_STORAGE_KEY = "roadmaster.token";

interface RegisterInput {
  fullName: string;
  phone: string;
  password: string;
  email?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async (activeToken: string) => {
    const payload = decodeJwt(activeToken);
    if (!payload?.sub) throw new Error("Invalid session");
    const profile = await apiFetch<User>(`/users/${payload.sub}`, {
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

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refreshUser }}
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

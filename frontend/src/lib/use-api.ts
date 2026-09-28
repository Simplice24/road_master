"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export function useApi<T>(path: string | null) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!token || !path) return;
    setIsLoading(true);
    setError(null);
    apiFetch<T>(path, { token })
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Something went wrong."),
      )
      .finally(() => setIsLoading(false));
  }, [token, path]);

  useEffect(() => {
    // Intentionally flips isLoading/error synchronously so consumers see a loading
    // state immediately on mount/path change, before the async request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return { data, error, isLoading, refetch };
}

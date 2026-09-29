"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "@/lib/permissions";
import { NotAuthorized } from "@/components/app/not-authorized";

interface RequirePermissionProps {
  /** Passes if the user has at least one of these. */
  anyOf?: Permission[];
  /** Passes only if the user has every one of these. */
  allOf?: Permission[];
  children: ReactNode;
}

/**
 * Page-level guard: renders a "not authorized" page instead of the page (and before any of
 * its data fetches mount) when the user lacks access — typing the URL directly lands here
 * rather than on a crash or a blank screen. UX only; the backend enforces every request.
 */
export function RequirePermission({ anyOf = [], allOf = [], children }: RequirePermissionProps) {
  const { can, canAny } = useAuth();

  const allowed = (anyOf.length === 0 || canAny(...anyOf)) && allOf.every((permission) => can(permission));

  return allowed ? children : <NotAuthorized />;
}

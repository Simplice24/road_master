/**
 * Permission names the frontend checks, mirroring backend/src/access/access.config.ts (the
 * source of truth — GET /auth/me returns the caller's effective names from it). Listed here
 * only so a typo in a `can()` call is a type error; the role picker renders whatever the
 * backend catalog returns, so a new backend permission needs no change here unless the UI
 * starts checking it.
 *
 * These checks are UX only (hiding links/buttons, "not authorized" pages). The backend
 * enforces every action on its own.
 */
export const PERMISSIONS = [
  "categories.view",
  "categories.create",
  "categories.update",
  "categories.delete",
  "questions.view",
  "questions.create",
  "questions.update",
  "questions.delete",
  "examConfig.view",
  "examConfig.create",
  "examConfig.update",
  "examConfig.delete",
  "examAttempts.viewOwn",
  "examAttempts.start",
  "examAttempts.answerOwn",
  "examAttempts.view",
  "transactions.viewOwn",
  "transactions.topUpOwn",
  "transactions.view",
  "users.viewOwn",
  "users.updateOwn",
  "users.view",
  "users.create",
  "users.update",
  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",
  "roles.assign",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface PermissionHolder {
  isSuperAdmin: boolean;
  permissions: string[];
}

/** SuperAdmin passes every check, mirroring the backend bypass. */
export function hasPermission(holder: PermissionHolder | null, permission: Permission) {
  if (!holder) return false;
  return holder.isSuperAdmin || holder.permissions.includes(permission);
}

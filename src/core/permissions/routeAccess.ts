import type { Permission } from "@/core/enums/permission";

/**
 * The single source of truth for what a route requires — never scattered
 * per-component. `active-membership` means "any signed-in, active Workspace
 * member may enter" (no specific permission beyond that); `permission` means
 * the member's role must be granted that specific permission
 * (`role_permissions`, see docs/permissions.md).
 */
export type RouteAccessRequirement =
  | { kind: "active-membership" }
  | { kind: "permission"; permission: Permission };

export interface RouteAccessEntry {
  prefix: string;
  requirement: RouteAccessRequirement;
}

/**
 * Ordered by nothing in particular — `getRouteAccessRequirement` matches by
 * longest prefix, so entry order here doesn't affect resolution. `/settings`
 * has no real page yet (reserved for a future Workspace Settings screen);
 * it's modeled here now since section 4 of the Team Portal spec calls for it
 * in the canonical map, matching the same "reserve the shape ahead of the
 * feature" precedent as `core/permissions`/`core/guards` themselves.
 */
export const ROUTE_ACCESS_MAP: RouteAccessEntry[] = [
  { prefix: "/dashboard", requirement: { kind: "active-membership" } },
  { prefix: "/account", requirement: { kind: "active-membership" } },
  { prefix: "/leads", requirement: { kind: "permission", permission: "leads.view" } },
  { prefix: "/clients", requirement: { kind: "permission", permission: "clients.view" } },
  { prefix: "/events", requirement: { kind: "permission", permission: "events.view" } },
  { prefix: "/contracts", requirement: { kind: "permission", permission: "contracts.view" } },
  { prefix: "/finance", requirement: { kind: "permission", permission: "finance.view" } },
  { prefix: "/documents", requirement: { kind: "permission", permission: "documents.view" } },
  { prefix: "/team", requirement: { kind: "permission", permission: "team.view" } },
  { prefix: "/settings", requirement: { kind: "permission", permission: "workspace.manage" } },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Null for a route not listed here — callers treat that as "no specific requirement beyond authentication and active membership," never as "forbidden." */
export function getRouteAccessRequirement(pathname: string): RouteAccessRequirement | null {
  const matches = ROUTE_ACCESS_MAP.filter((entry) => matchesPrefix(pathname, entry.prefix));
  if (matches.length === 0) return null;
  const longest = matches.reduce((best, entry) => (entry.prefix.length > best.prefix.length ? entry : best));
  return longest.requirement;
}

/**
 * Convenience wrapper for anything that just needs a yes/no against a
 * target path and a `can()` predicate — e.g. filtering Dashboard metric
 * cards by the route each one links to (`DashboardMetric.href`), so a card
 * pointing at `/finance` is hidden for a member without `finance.view`
 * without duplicating the permission mapping anywhere else.
 */
export function canAccessRoute(pathname: string, can: (permission: Permission) => boolean): boolean {
  const requirement = getRouteAccessRequirement(pathname);
  if (!requirement || requirement.kind === "active-membership") return true;
  return can(requirement.permission);
}

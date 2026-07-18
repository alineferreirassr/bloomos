import type { DataMode } from "@/lib/env";

/** Every business-module route this phase — kept in sync manually with `src/app/(app)`. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/leads",
  "/clients",
  "/events",
  "/contracts",
  "/finance",
  "/documents",
  "/team",
] as const;

/** Never redirect these — doing so would create a redirect loop. Invitation acceptance is intentionally an auth route: the page must render (and offer sign-up/sign-in) before the visitor has any session at all. */
export const AUTH_ROUTE_PREFIXES = [
  "/sign-in",
  "/reset-password",
  "/update-password",
  "/auth/callback",
  "/invitations",
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedRoute(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_ROUTE_PREFIXES);
}

export function isAuthRoute(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_ROUTE_PREFIXES);
}

export type RouteProtectionDecision = { action: "allow" } | { action: "redirect"; to: string };

export interface RouteProtectionInput {
  pathname: string;
  dataMode: DataMode;
  hasSession: boolean;
}

/**
 * Pure decision function — no Next.js request/response objects, so it's
 * testable without a live server. `middleware.ts` is a thin wrapper around
 * this plus the Supabase session refresh side effect.
 *
 * - Mock mode: always allow. Route protection only ever activates when
 *   `NEXT_PUBLIC_DATA_MODE=supabase` — local development never requires a
 *   login.
 * - Auth routes themselves are always allowed, regardless of session state,
 *   so a signed-out visitor can always reach `/sign-in` without looping.
 * - Unprotected routes (anything not in `PROTECTED_ROUTE_PREFIXES`) are
 *   always allowed.
 * - A protected route with no session redirects to `/sign-in`, preserving
 *   the original destination in `redirectTo` so sign-in can return the user
 *   there afterward.
 */
export function resolveRouteProtectionDecision(input: RouteProtectionInput): RouteProtectionDecision {
  const { pathname, dataMode, hasSession } = input;

  if (dataMode !== "supabase") return { action: "allow" };
  if (isAuthRoute(pathname)) return { action: "allow" };
  if (!isProtectedRoute(pathname)) return { action: "allow" };
  if (hasSession) return { action: "allow" };

  const params = new URLSearchParams({ redirectTo: pathname });
  return { action: "redirect", to: `/sign-in?${params.toString()}` };
}

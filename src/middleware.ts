import { NextResponse, type NextRequest } from "next/server";
import { getDataMode } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRouteProtectionDecision } from "@/lib/middleware/routeProtection";

/**
 * Route protection activates only when NEXT_PUBLIC_DATA_MODE=supabase — see
 * docs/permissions.md. In mock mode (the default), every route is open and
 * no Supabase client is ever constructed, so local development never
 * requires credentials or a login.
 */
export async function middleware(request: NextRequest) {
  // Checkpoint 16 — the Public API (`/api/v1/*`) authenticates via its own
  // API Key scheme (`core/api/auth.ts`), never a member's Supabase auth
  // cookie. Refreshing that cookie here would be wasted work (and touches
  // cookies) for a stateless, API-key-authenticated request that never
  // has one — `/api/health` already made `/api` implicitly unprotected
  // via `routeProtection.ts`'s own prefix list, this just also skips the
  // Supabase session-refresh call itself, not only the redirect decision.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const dataMode = getDataMode();

  if (dataMode !== "supabase") {
    return NextResponse.next();
  }

  const { response, userId } = await updateSession(request);

  const decision = resolveRouteProtectionDecision({
    pathname: request.nextUrl.pathname,
    dataMode,
    hasSession: userId !== null,
  });

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

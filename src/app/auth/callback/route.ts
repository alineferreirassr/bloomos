import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Exchanges the PKCE `code` Supabase Auth sends in password-reset (and any
 * future magic-link/OAuth) email links for a session, then redirects to
 * `next` (defaulting to `/update-password`, the only flow that uses this
 * callback today — no social providers, no invitations yet).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/update-password";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/update-password";

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthActionResult = { success: true } | { success: false; error: string };

const NOT_CONFIGURED_ERROR =
  'Supabase is not configured. Set NEXT_PUBLIC_DATA_MODE=supabase and provide NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY to sign in.';

/** Same-origin path only — never redirect to an attacker-supplied external URL from a `redirectTo` query param. */
function safeRedirectTarget(redirectTo: string | undefined, fallback: string): string {
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    return redirectTo;
  }
  return fallback;
}

async function getSiteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "http://localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: NOT_CONFIGURED_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    return { success: false, error: normalizeSupabaseError(error).message };
  }

  redirect(safeRedirectTarget(input.redirectTo, "/dashboard"));
}

/**
 * Self-service account creation, used only from the invitation-acceptance
 * page (`/invitations/[token]`) — the invited person sets their own
 * password here, BloomOS never generates or emails one. Redirects back to
 * `redirectTo` (the invitation page itself, by convention) only when
 * Supabase returns an immediate session — if the project requires email
 * confirmation, no session exists yet and the caller shows a "check your
 * email" state instead of redirecting into one.
 */
export async function signUpWithPassword(input: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: NOT_CONFIGURED_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password });
  if (error) {
    return { success: false, error: normalizeSupabaseError(error).message };
  }

  if (data.session) {
    redirect(safeRedirectTarget(input.redirectTo, "/dashboard"));
  }

  return { success: true };
}

export async function signOut(): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: normalizeSupabaseError(error).message };
  }

  redirect("/sign-in");
}

export async function requestPasswordReset(input: { email: string }): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: NOT_CONFIGURED_ERROR };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });
  if (error) {
    return { success: false, error: normalizeSupabaseError(error).message };
  }

  return { success: true };
}

export async function updatePassword(input: { password: string }): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: NOT_CONFIGURED_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    return { success: false, error: normalizeSupabaseError(error).message };
  }

  return { success: true };
}

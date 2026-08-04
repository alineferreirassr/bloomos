import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isMissingAuthSessionError, normalizeSupabaseError } from "@/lib/supabase/errors";

/** Server-side only. Returns null when signed out — never throws for "no session," only for a real Supabase/network failure. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeSupabaseError(error);
  return data.session;
}

/**
 * Prefer this over `getSession()` for anything auth-gating — `getUser()`
 * revalidates the token against Supabase Auth instead of trusting the
 * (spoofable) session cookie alone. Returns null when signed out.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (isMissingAuthSessionError(error)) return null;
    throw normalizeSupabaseError(error);
  }
  return data.user;
}

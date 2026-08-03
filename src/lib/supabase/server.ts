import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseConfigured, getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Factory, not a singleton — call this fresh in every Server Component,
 * Server Action, or Route Handler that needs it (the official Supabase SSR
 * pattern). A module-scoped client would leak one request's cookies/session
 * into another's.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which can't mutate cookies — safe to
          // ignore because middleware refreshes the session on every request.
        }
      },
    },
  });
}

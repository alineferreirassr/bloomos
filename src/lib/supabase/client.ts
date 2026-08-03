import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured, getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Factory, not a singleton — call this once per component/hook that needs
 * it (the official Supabase SSR pattern), never hoist the result to module
 * scope. For use in Client Components only.
 */
export function createClient() {
  assertSupabaseConfigured();
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!);
}

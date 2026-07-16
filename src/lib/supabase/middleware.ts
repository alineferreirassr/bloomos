import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export interface SessionRefreshResult {
  response: NextResponse;
  userId: string | null;
}

/**
 * Refreshes the Supabase session cookies on every matched request (the
 * official SSR middleware pattern) and reports whether a user is currently
 * authenticated. Uses `getUser()`, not `getSession()` — `getUser()`
 * revalidates the token against Supabase Auth on every call, while
 * `getSession()` trusts the (spoofable) cookie alone.
 *
 * Callers must check `isSupabaseConfigured()`/`getDataMode()` before calling
 * this — it assumes both env vars are present and does not itself validate
 * configuration, to avoid every middleware invocation constructing then
 * discarding a `SupabaseConfigurationError`.
 */
export async function updateSession(request: NextRequest): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request });

  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return { response, userId: null };
  }

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, userId: user?.id ?? null };
}

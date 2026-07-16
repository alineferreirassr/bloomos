import { createClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";
import type { WorkspaceSession, WorkspaceSessionResult } from "@/lib/auth/workspaceSession";

export type { WorkspaceSession, WorkspaceSessionResult };

/**
 * Client Component-safe twin of lib/auth/workspaceSession.ts's
 * getWorkspaceSession() — same resolution logic (auth.uid() -> profile ->
 * active membership -> Workspace), same result shape, but built on the
 * browser Supabase client (lib/supabase/client.ts) instead of the server one,
 * since the server client's `next/headers` dependency is hard-gated by the
 * `server-only` package and cannot be imported into a Client Component
 * bundle. RLS is the actual enforcement boundary either way — this resolves
 * exactly what the database already allows the authenticated browser session
 * to see, nothing more.
 */
export async function getClientWorkspaceSession(): Promise<WorkspaceSessionResult> {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    if (userError.name === "AuthSessionMissingError") return { status: "unauthenticated" };
    throw normalizeSupabaseError(userError);
  }
  const user = userData.user;
  if (!user) return { status: "unauthenticated" };

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw normalizeSupabaseError(profileError);
  if (!profileRow) return { status: "no-workspace" };

  const { data: memberRows, error: memberError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (memberError) throw normalizeSupabaseError(memberError);
  const memberRow = memberRows?.[0];
  if (!memberRow) return { status: "no-workspace" };

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", memberRow.workspace_id)
    .maybeSingle();
  if (workspaceError) throw normalizeSupabaseError(workspaceError);
  if (!workspaceRow) return { status: "no-workspace" };

  return {
    status: "ok",
    session: {
      user,
      profile: mapProfileRow(profileRow),
      workspace: mapWorkspaceRow(workspaceRow),
      membership: mapWorkspaceMemberRow(memberRow),
    },
  };
}

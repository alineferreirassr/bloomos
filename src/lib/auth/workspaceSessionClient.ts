import { createClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";
import type { WorkspaceSession, WorkspaceSessionResult } from "@/lib/auth/workspaceSession";
import type { Permission } from "@/core/enums/permission";

export type { WorkspaceSession, WorkspaceSessionResult };

/**
 * Client Component-safe twin of lib/auth/workspaceSession.ts's
 * getWorkspaceSession() — same resolution logic (auth.uid() -> profile ->
 * membership, any status, preferring an active one -> Workspace ->
 * permissions), same result shape, but built on the browser Supabase client
 * (lib/supabase/client.ts) instead of the server one, since the server
 * client's `next/headers` dependency is hard-gated by the `server-only`
 * package and cannot be imported into a Client Component bundle. RLS is the
 * actual enforcement boundary either way — this resolves exactly what the
 * database already allows the authenticated browser session to see, nothing
 * more.
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
    .eq("user_id", user.id);
  if (memberError) throw normalizeSupabaseError(memberError);
  const memberRow = memberRows?.find((row) => row.status === "active") ?? memberRows?.[0];
  if (!memberRow) return { status: "no-workspace" };

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", memberRow.workspace_id)
    .maybeSingle();
  if (workspaceError) throw normalizeSupabaseError(workspaceError);
  if (!workspaceRow) return { status: "no-workspace" };

  let permissions: Permission[] = [];
  if (memberRow.status === "active") {
    const { data: permissionRows, error: permissionError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", memberRow.role);
    if (permissionError) throw normalizeSupabaseError(permissionError);
    permissions = (permissionRows ?? []).map((row) => row.permission_id as Permission);
  }

  return {
    status: "ok",
    session: {
      user,
      profile: mapProfileRow(profileRow),
      workspace: mapWorkspaceRow(workspaceRow),
      membership: mapWorkspaceMemberRow(memberRow),
      permissions,
    },
  };
}

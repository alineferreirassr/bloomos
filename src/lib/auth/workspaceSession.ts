import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";

export interface WorkspaceSession {
  user: User;
  profile: Profile;
  workspace: Workspace;
  membership: WorkspaceMember;
}

export type WorkspaceSessionResult =
  | { status: "unauthenticated" }
  | { status: "no-workspace" }
  | { status: "ok"; session: WorkspaceSession };

/**
 * Server-side only. Resolves the full authenticated session — user, profile,
 * active Workspace membership, and the Workspace itself — entirely from the
 * database via `auth.uid()`-scoped RLS, never from a client-supplied ID.
 * A signed-in user with no active membership (removed, suspended, or never
 * assigned) resolves to "no-workspace" rather than throwing, so callers can
 * render a safe empty state instead of leaking which case applies.
 */
export async function getWorkspaceSession(): Promise<WorkspaceSessionResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unauthenticated" };

  const supabase = await createClient();

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

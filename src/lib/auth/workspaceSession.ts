import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";
import { UnauthorizedError, ForbiddenError } from "@/core/errors";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";
import type { Permission } from "@/core/enums/permission";
import type { Database } from "@/types/database.types";

export interface WorkspaceSession {
  user: User;
  profile: Profile;
  workspace: Workspace;
  membership: WorkspaceMember;
  /** Empty when `membership.status !== "active"` — an inactive member has no effective permissions regardless of what their role would otherwise grant. */
  permissions: Permission[];
}

export type WorkspaceSessionResult =
  | { status: "unauthenticated" }
  | { status: "no-workspace" }
  | { status: "ok"; session: WorkspaceSession };

/**
 * Server-side only. Resolves the full authenticated session — user, profile,
 * Workspace membership (whatever its status), the Workspace itself, and the
 * member's effective permissions — entirely from the database via
 * `auth.uid()`-scoped RLS, never from a client-supplied ID. A signed-in user
 * with no membership row at all resolves to "no-workspace" rather than
 * throwing, so callers can render a safe empty state. A signed-in user with
 * an existing but non-active (suspended) membership still resolves to "ok" —
 * unlike the Team foundation phase's original active-only query, this lets
 * `session.membership.status` distinguish "never assigned"/"removed"
 * (no-workspace) from "assigned but deactivated" (ok, inactive membership),
 * which the Team Portal's inactive-member handling depends on. If the caller
 * has memberships in more than one Workspace, an active one is preferred;
 * only if none is active does the first (necessarily inactive) row apply —
 * this MVP still assumes one meaningful Workspace per user in practice.
 */
export const getWorkspaceSession = cache(async (): Promise<WorkspaceSessionResult> => {
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
});

export interface ServerRepositoryContext {
  supabase: SupabaseClient<Database>;
  session: WorkspaceSession;
}

/**
 * Resolves both a genuinely server-authenticated Supabase client and the
 * caller's Workspace session together, for repository functions that need
 * to run real, authenticated Supabase queries from a Server Component or
 * Server Action. This is the server-side counterpart callers should inject
 * into repository functions that otherwise default to
 * `getClientWorkspaceSession()` (`lib/auth/workspaceSessionClient.ts`) — the
 * browser client that resolves as "unauthenticated" during SSR regardless
 * of the real session, since it has no `document.cookie` to read there.
 * Cached per request (`getWorkspaceSession` above is too), so calling this
 * more than once in one render doesn't re-run the underlying queries.
 */
export const getServerRepositoryContext = cache(async (): Promise<ServerRepositoryContext> => {
  const supabase = await createClient();
  const result = await getWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return { supabase, session: result.session };
});

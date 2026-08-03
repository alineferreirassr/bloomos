import { cache } from "react";
import { getDataMode } from "@/lib/env";
import { getWorkspaceSession } from "@/lib/auth/workspaceSession";
import { getCurrentWorkspaceMember, getWorkspaceMemberPermissions } from "@/lib/data";
import { getWorkspaceDisplayName } from "@/lib/workspaceDisplayName";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";
import type { Permission } from "@/core/enums/permission";
import type { MemberAccessState } from "@/core/guards/memberAccess";

export interface MemberSessionUser {
  id: string;
  email: string;
}

export interface MemberSessionProfile {
  full_name: string | null;
  avatar_url: string | null;
}

export interface MemberSessionWorkspace {
  id: string;
  name: string;
}

export interface MemberSessionMembership {
  id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  created_at: string;
}

interface MemberSessionData {
  user: MemberSessionUser;
  profile: MemberSessionProfile;
  workspace: MemberSessionWorkspace;
  membership: MemberSessionMembership;
  /** Always empty when the membership itself isn't active. */
  permissions: Permission[];
  workspaceDisplayName: string;
}

/**
 * Server-resolved once per navigation (in `(app)/layout.tsx`) and seeded into
 * `MemberSessionProvider` — no page independently re-fetches this. `kind`
 * mirrors `core/guards/memberAccess.ts`'s `MemberAccessState` deliberately
 * (see `toMemberAccessState` below), so a route guard can reuse the exact
 * same snapshot a page already has instead of resolving session state twice.
 */
export type MemberSessionSnapshot =
  | { kind: "unauthenticated" }
  | { kind: "no-workspace" }
  | ({ kind: "inactive" } & Omit<MemberSessionData, "permissions">)
  | ({ kind: "active" } & MemberSessionData);

const DEFAULT_WORKSPACE_NAME = "Amoré Bloom";

/**
 * Resolves the current member's full session snapshot, branching on data
 * mode exactly like `(app)/layout.tsx` used to do for `workspaceDisplayName`
 * alone — mock mode has no real authentication, so it always resolves
 * through `TeamRepository`'s mock implementation (`getCurrentWorkspaceMember`,
 * always the seeded owner, `member_1`); Supabase mode resolves through the
 * real, `auth.uid()`-scoped `getWorkspaceSession()`. Both paths reuse the
 * exact same repository/session functions every other part of this app
 * already uses — this is not a parallel permission system.
 *
 * Wrapped in React's `cache()` so calling this from both `(app)/layout.tsx`
 * (to seed `MemberSessionProvider`) and again from an individual page's own
 * route guard resolves to the same in-flight/already-resolved result within
 * one request, instead of two independent round trips for the same data.
 */
export const resolveMemberSessionSnapshot = cache(async (): Promise<MemberSessionSnapshot> => {
  if (getDataMode() !== "supabase") {
    const member = await getCurrentWorkspaceMember();
    if (!member) return { kind: "no-workspace" };

    const workspaceDisplayName = getWorkspaceDisplayName(
      member.status === "active" ? member.role : null,
      DEFAULT_WORKSPACE_NAME,
    );
    const base: MemberSessionData = {
      user: { id: member.user_id, email: member.email },
      profile: { full_name: member.full_name, avatar_url: member.avatar_url },
      workspace: { id: member.workspace_id, name: DEFAULT_WORKSPACE_NAME },
      membership: { id: member.id, role: member.role, status: member.status, created_at: member.created_at },
      permissions: member.status === "active" ? await getWorkspaceMemberPermissions(member.id) : [],
      workspaceDisplayName,
    };

    if (member.status !== "active") {
      const { permissions: _permissions, ...inactiveBase } = base;
      return { kind: "inactive", ...inactiveBase };
    }
    return { kind: "active", ...base };
  }

  const result = await getWorkspaceSession();
  if (result.status === "unauthenticated") return { kind: "unauthenticated" };
  if (result.status === "no-workspace") return { kind: "no-workspace" };

  const { user, profile, workspace, membership, permissions } = result.session;
  const workspaceDisplayName = getWorkspaceDisplayName(
    membership.status === "active" ? membership.role : null,
    workspace.name,
  );
  const base: MemberSessionData = {
    user: { id: user.id, email: user.email ?? profile.email },
    profile: { full_name: profile.full_name, avatar_url: profile.avatar_url },
    workspace: { id: workspace.id, name: workspace.name },
    membership: { id: membership.id, role: membership.role, status: membership.status, created_at: membership.created_at },
    permissions,
    workspaceDisplayName,
  };

  if (membership.status !== "active") {
    const { permissions: _permissions, ...inactiveBase } = base;
    return { kind: "inactive", ...inactiveBase };
  }
  return { kind: "active", ...base };
});

/** Maps a resolved snapshot onto the pure access-decision input shape (`core/guards/memberAccess.ts`) — kept as a separate, tiny function rather than merging the two types, so the guard stays fully decoupled from how a snapshot is produced. */
export function toMemberAccessState(snapshot: MemberSessionSnapshot): MemberAccessState {
  if (snapshot.kind === "active") return { kind: "active", permissions: snapshot.permissions };
  return { kind: snapshot.kind };
}

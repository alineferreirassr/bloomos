"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type {
  MemberSessionSnapshot,
  MemberSessionUser,
  MemberSessionProfile,
  MemberSessionWorkspace,
  MemberSessionMembership,
} from "@/lib/auth/memberSessionSnapshot";

export interface MemberSessionValue {
  status: MemberSessionSnapshot["kind"];
  user: MemberSessionUser | null;
  profile: MemberSessionProfile | null;
  workspace: MemberSessionWorkspace | null;
  membership: MemberSessionMembership | null;
  role: WorkspaceMemberRole | null;
  permissions: Permission[];
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  can: (permission: Permission) => boolean;
  workspaceDisplayName: string;
  /**
   * Always `false` in this MVP — the snapshot is resolved server-side once
   * per navigation (`(app)/layout.tsx`) and seeded into this provider before
   * the client ever renders, so there is no client-side fetch to wait on.
   * Kept as a real field (not removed) so a future client-triggered refresh
   * (e.g. after an admin changes their own role) has somewhere to report
   * progress without changing this hook's shape.
   */
  loading: false;
}

const DEFAULT_WORKSPACE_DISPLAY_NAME = "Amoré Bloom Team";

const MemberSessionContext = createContext<MemberSessionValue | null>(null);

function toValue(snapshot: MemberSessionSnapshot): MemberSessionValue {
  if (snapshot.kind === "unauthenticated" || snapshot.kind === "no-workspace") {
    return {
      status: snapshot.kind,
      user: null,
      profile: null,
      workspace: null,
      membership: null,
      role: null,
      permissions: [],
      isOwner: false,
      isAdmin: false,
      isManager: false,
      isStaff: false,
      can: () => false,
      workspaceDisplayName: DEFAULT_WORKSPACE_DISPLAY_NAME,
      loading: false,
    };
  }

  const permissions = snapshot.kind === "active" ? snapshot.permissions : [];
  const role = snapshot.kind === "active" ? snapshot.membership.role : null;

  return {
    status: snapshot.kind,
    user: snapshot.user,
    profile: snapshot.profile,
    workspace: snapshot.workspace,
    membership: snapshot.membership,
    role,
    permissions,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isManager: role === "manager",
    isStaff: role === "staff",
    can: (permission: Permission) => permissions.includes(permission),
    workspaceDisplayName: snapshot.workspaceDisplayName,
    loading: false,
  };
}

/** Wraps the app shell once, seeded with a server-resolved snapshot — see `resolveMemberSessionSnapshot()`. Never independently re-fetches; every consumer reads the same already-resolved value. */
export function MemberSessionProvider({
  snapshot,
  children,
}: {
  snapshot: MemberSessionSnapshot;
  children: ReactNode;
}) {
  return <MemberSessionContext.Provider value={toValue(snapshot)}>{children}</MemberSessionContext.Provider>;
}

/** Throws if rendered outside `MemberSessionProvider` — every route under `(app)` is expected to be wrapped by it via the shared layout, so a missing provider is a real bug, not a state to render around. */
export function useMemberSession(): MemberSessionValue {
  const value = useContext(MemberSessionContext);
  if (!value) throw new Error("useMemberSession must be used within a MemberSessionProvider");
  return value;
}

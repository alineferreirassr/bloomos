import type { Permission } from "@/core/enums/permission";
import type { RouteAccessRequirement } from "@/core/permissions/routeAccess";

/**
 * The current member's coarse access state — deliberately a closed union
 * rather than reusing `WorkspaceSessionResult` directly, so this guard has
 * no dependency on Supabase types and stays testable in complete isolation
 * (mirrors the existing `lib/middleware/routeProtection.ts` precedent: a
 * pure decision function, framework- and backend-agnostic).
 */
export type MemberAccessState =
  | { kind: "unauthenticated" }
  | { kind: "no-workspace" }
  | { kind: "inactive" }
  | { kind: "active"; permissions: Permission[] };

export type MemberAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "no-workspace" | "inactive" | "forbidden" };

/**
 * Given the current member's access state and a route's requirement (or
 * `null` for an unlisted route), decides whether they may proceed. Order of
 * checks matters: authentication and membership state are checked before
 * the specific permission requirement, so an inactive member is always
 * reported as "inactive," never as "forbidden" for lacking some permission
 * they'd have had if active.
 */
export function resolveMemberAccessDecision(
  state: MemberAccessState,
  requirement: RouteAccessRequirement | null,
): MemberAccessDecision {
  if (state.kind === "unauthenticated") return { allowed: false, reason: "unauthenticated" };
  if (state.kind === "no-workspace") return { allowed: false, reason: "no-workspace" };
  if (state.kind === "inactive") return { allowed: false, reason: "inactive" };

  if (!requirement || requirement.kind === "active-membership") return { allowed: true };
  if (state.permissions.includes(requirement.permission)) return { allowed: true };
  return { allowed: false, reason: "forbidden" };
}

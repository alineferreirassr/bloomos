import type { ReactNode } from "react";
import { resolveMemberSessionSnapshot, toMemberAccessState } from "@/lib/auth/memberSessionSnapshot";
import { getRouteAccessRequirement } from "@/core/permissions/routeAccess";
import { resolveMemberAccessDecision } from "@/core/guards/memberAccess";
import { ForbiddenState } from "@/components/layout/ForbiddenState";

/**
 * Wraps an entire module's route subtree (via that module's own
 * `layout.tsx` — e.g. `(app)/finance/layout.tsx` covers `/finance`,
 * `/finance/invoices`, `/finance/invoices/new`, etc. all at once) so no
 * individual page has to repeat this check. `resolveMemberSessionSnapshot()`
 * is `cache()`-wrapped, so this reuses the exact same resolution the parent
 * `(app)/layout.tsx` already performed for this request — no second round
 * trip.
 *
 * `unauthenticated`/`no-workspace`/`inactive` are never actually reachable
 * here in practice — the parent `(app)/layout.tsx` already short-circuits
 * before rendering any nested route in those cases — this only meaningfully
 * renders `ForbiddenState` for an active member who lacks the one permission
 * `routePath` requires.
 */
export async function RouteGuard({ routePath, children }: { routePath: string; children: ReactNode }) {
  const snapshot = await resolveMemberSessionSnapshot();
  const state = toMemberAccessState(snapshot);
  const requirement = getRouteAccessRequirement(routePath);
  const decision = resolveMemberAccessDecision(state, requirement);

  if (!decision.allowed) {
    return <ForbiddenState />;
  }

  return <>{children}</>;
}

import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

// No entry exists for "/workflows" in `core/permissions/routeAccess.ts` —
// deliberately, the same precedent `/automation`'s own layout already
// established (see that file's own doc comment): any active Workspace
// member may view Workflows and edit a draft; only *publishing* (Step 15's
// own "elevated permission") is gated, inside `publishWorkflowAction.ts`
// itself, on `workspace.manage`.
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/workflows">{children}</RouteGuard>;
}

import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";

// No entry exists for "/automation" in `core/permissions/routeAccess.ts` —
// deliberately, matching `/finance-assistant`'s/`/bloom-ai`'s own precedent
// (see `getBloomAIOverview.ts`'s doc comment): any active Workspace member
// may view the Dashboard. This is a read model spanning every domain at
// once (Proposals/Invoices/Contracts/Events/CRM/Finance), so no single
// existing granular permission fits it, and no `automation.*` permission
// exists yet (adding one would need a Supabase migration seeding it into
// the `permissions` table, out of scope for this checkpoint). Per-Automation
// enforcement — permission, role, feature flag, approval — still happens on
// every real execution inside `executeAutomation()`; this route only gates
// *viewing* the Dashboard, matching Step 12's "Workspace scoped" (every
// query is scoped to the resolved session's own `workspaceId`) without
// conflating it with the deeper per-Automation "Role aware. Approval aware."
// checks the Engine itself already owns.
export default function AutomationLayout({ children }: { children: ReactNode }) {
  return <RouteGuard routePath="/automation">{children}</RouteGuard>;
}

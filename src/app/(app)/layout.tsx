import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getDataMode } from "@/lib/env";
import { getWorkspaceSession } from "@/lib/auth/workspaceSession";
import { getWorkspaceDisplayName } from "@/lib/workspaceDisplayName";

const DEFAULT_WORKSPACE_NAME = "Amoré Bloom";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let workspaceDisplayName = getWorkspaceDisplayName(null, DEFAULT_WORKSPACE_NAME);

  // Mirrors WorkspaceSessionPanel's guard — getWorkspaceSession() talks to a
  // real Supabase project, so it's only called in supabase mode. Mock mode
  // (the default, needs zero configuration) keeps the prior static label.
  if (getDataMode() === "supabase") {
    const result = await getWorkspaceSession();
    if (result.status === "ok") {
      workspaceDisplayName = getWorkspaceDisplayName(
        result.session.membership.role,
        result.session.workspace.name,
      );
    }
  }

  return <AppShell workspaceDisplayName={workspaceDisplayName}>{children}</AppShell>;
}

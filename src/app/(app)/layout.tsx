import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AccessBlockedPage } from "@/components/layout/AccessBlockedPage";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CopilotProvider } from "@/modules/ai/copilot/CopilotProvider";
import { CopilotPageContextProvider } from "@/modules/ai/copilot/CopilotPageContextProvider";
import { DeferredFloatingWidgets } from "@/components/providers/DeferredFloatingWidgets";
import { GlobalCommandRegistrar } from "@/components/providers/GlobalCommandRegistrar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const snapshot = await resolveMemberSessionSnapshot();

  if (snapshot.kind === "unauthenticated") {
    // Defensive only — `src/middleware.ts` already redirects an unauthenticated
    // visitor away from every route under `(app)` in supabase mode. This
    // covers the same route being reached anyway (e.g. a session that expired
    // mid-navigation), without ever falling through to render page content.
    redirect("/sign-in");
  }

  if (snapshot.kind === "no-workspace") {
    return (
      <AccessBlockedPage
        title="No Workspace access"
        message="Your account isn't a member of any Workspace yet. If you were expecting access, ask a Workspace owner to send you an invitation."
      />
    );
  }

  if (snapshot.kind === "inactive") {
    return (
      <AccessBlockedPage
        title="Account inactive"
        message={`Your access to ${snapshot.workspace.name} has been deactivated. Contact a Workspace owner or admin if you believe this is a mistake.`}
      />
    );
  }

  return (
    <QueryProvider>
      <MemberSessionProvider snapshot={snapshot}>
        <CopilotPageContextProvider>
          <CopilotProvider>
            <AppShell workspaceDisplayName={snapshot.workspaceDisplayName}>{children}</AppShell>
            <DeferredFloatingWidgets workspaceId={snapshot.workspace.id} />{/* v2.0 Checkpoint 38 — CommandPalette existed since v2 Checkpoint 1 but was never mounted anywhere in production (confirmed via repo-wide import search); mounting it here gives every page in BloomOS a working mod+k, not just the new Workspace Home. Checkpoint 45A — code-split from the initial route bundle via next/dynamic(ssr:false), see DeferredFloatingWidgets. */}
            <GlobalCommandRegistrar />{/* v2.0 Checkpoint 40 — registers every "Open X"/"Create X" navigation command globally, once, so they're findable from the Command Palette above on every route. */}
          </CopilotProvider>
        </CopilotPageContextProvider>
      </MemberSessionProvider>
    </QueryProvider>
  );
}

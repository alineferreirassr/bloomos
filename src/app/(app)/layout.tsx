import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AccessBlockedPage } from "@/components/layout/AccessBlockedPage";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

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
    <MemberSessionProvider snapshot={snapshot}>
      <AppShell workspaceDisplayName={snapshot.workspaceDisplayName}>{children}</AppShell>
    </MemberSessionProvider>
  );
}

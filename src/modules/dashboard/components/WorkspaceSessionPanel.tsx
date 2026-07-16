import { getDataMode } from "@/lib/env";
import { getWorkspaceSession } from "@/lib/auth/workspaceSession";
import { Card } from "@/components/ui/Card";

/**
 * Temporary internal verification surface for the Supabase Foundation
 * checkpoint — confirms user/profile/Workspace/role resolve end-to-end after
 * a real login. Renders nothing in mock mode, where there is no real session
 * to resolve.
 */
export async function WorkspaceSessionPanel() {
  if (getDataMode() !== "supabase") return null;

  const result = await getWorkspaceSession();

  if (result.status === "unauthenticated") return null;

  if (result.status === "no-workspace") {
    return (
      <Card className="mb-6">
        <p className="text-xs text-text-muted">
          Signed in, but no active Workspace membership was found for this account.
        </p>
      </Card>
    );
  }

  const { user, workspace, membership } = result.session;

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1">
      <p className="text-xs text-text-muted">{user.email}</p>
      <p className="text-xs text-text-muted">
        Workspace: <span className="font-medium text-text">{workspace.name}</span>
      </p>
      <p className="text-xs text-text-muted">
        Role: <span className="font-medium text-text">{membership.role}</span>
      </p>
    </Card>
  );
}

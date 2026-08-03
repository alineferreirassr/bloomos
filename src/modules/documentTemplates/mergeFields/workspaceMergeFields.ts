import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"workspace"` Merge Field domain (Step 4) — the Workspace's own
 * identity, resolved via `resolveMemberSessionSnapshot()`, the same
 * session-derived source every other module already reads workspace
 * identity from. Wrapped in React's own `cache()`, so calling it here
 * costs nothing extra within a request already resolving a session for
 * permission checks. Configurable Workspace values (timezone, currency,
 * date format) live under the `"settings"` domain instead
 * (`settingsMergeFields.ts`) — they're registered Settings (Checkpoint 11),
 * not workspace identity.
 */
export const workspaceMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "workspace_name", label: "Workspace Name", description: "The business operating this Workspace.", domain: "workspace", valueType: "string", required: true },
];

export function registerWorkspaceMergeFields(): void {
  for (const definition of workspaceMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("workspace_name", async (context) => {
    const session = await resolveMemberSessionSnapshot();
    if (session.kind !== "active" || session.workspace.id !== context.workspaceId) return null;
    return session.workspace.name;
  });
}

import { registerCommand, unregisterCommand } from "@/core/commandPalette/registry";
import { NAVIGATION_COMMANDS } from "@/core/commandPalette/navigationCommands";
import { listWorkspaceQuickActions } from "@/core/workspace/quickActionsRegistry";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Bridges
 * two already-real, data-only registries — `NAVIGATION_COMMANDS` (this
 * checkpoint) and `listWorkspaceQuickActions()` (Checkpoint 38's Smart
 * Workspace Platform) — into real `CommandAction`s, the one thing neither
 * registry could do on its own since `CommandAction.run()` needs a router,
 * which only exists client-side.
 *
 * Every id is prefixed `nav-`/`quick-` — deliberately its own namespace,
 * never reusing a page-scoped registrant's own id (e.g.
 * `WorkflowsListView.tsx`'s own `open-workflow-monitoring-center`). Two
 * different registrants sharing one id would mean whichever page-scoped
 * component unmounts first silently deletes this global command too, since
 * `core/commandPalette/registry.ts`'s registry is one shared `Map` keyed by
 * id — this file's own ids can never collide with that.
 *
 * Called once, from a single always-mounted client component (see
 * `GlobalCommandRegistrar.tsx`) — never per-page, so "Open Business Health"
 * is findable from anywhere, not only after visiting `/workspace` once.
 */
export function registerGlobalCommands(navigate: (href: string) => void): () => void {
  const registeredIds: string[] = [];

  for (const nav of NAVIGATION_COMMANDS) {
    registerCommand({
      id: nav.id,
      label: nav.label,
      group: nav.group,
      keywords: nav.keywords,
      run: () => navigate(nav.href),
    });
    registeredIds.push(nav.id);
  }

  for (const action of listWorkspaceQuickActions()) {
    const id = `quick-${action.id}`;
    registerCommand({
      id,
      label: action.label,
      group: action.group,
      keywords: [action.description],
      run: () => navigate(action.href),
    });
    registeredIds.push(id);
  }

  return () => {
    for (const id of registeredIds) unregisterCommand(id);
  };
}

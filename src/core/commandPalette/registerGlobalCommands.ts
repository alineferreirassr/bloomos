import { registerCommand, unregisterCommand } from "@/core/commandPalette/registry";
import { SUPPLEMENTARY_NAVIGATION_COMMANDS } from "@/core/commandPalette/navigationCommands";
import { getVisibleNavigationModules, NAV_GROUP_LABELS } from "@/config/navigation";
import { canAccessRoute } from "@/core/permissions/routeAccess";
import { listWorkspaceQuickActions } from "@/core/workspace/quickActionsRegistry";
import type { Permission } from "@/core/enums/permission";

/**
 * v2.0 Checkpoint 40, then the App Shell architecture cleanup — bridges
 * three sources into real `CommandAction`s, the one thing none of them can
 * do on their own since `CommandAction.run()` needs a router, which only
 * exists client-side:
 *
 * 1. `getVisibleNavigationModules(can)` — the exact same permission-filtered
 *    list `LuxurySidebar`/`LuxuryMobileNavigation` render. This is the fix
 *    for the pre-existing drift: the Command Palette used to maintain its
 *    own hand-typed, already-stale 30-entry route list
 *    (`NAVIGATION_COMMANDS`, now deleted) that both missed real destinations
 *    (Leads, Clients, Vendors, Finance, Team, Reports, ...) and — critically
 *    — was never permission-filtered at all, so Cmd+K disclosed every
 *    Founder-only route to every signed-in member regardless of role. Now
 *    there is exactly one array of "what routes exist," and the Command
 *    Palette can only ever show a subset of what the sidebar already shows.
 * 2. `SUPPLEMENTARY_NAVIGATION_COMMANDS` — a small, deliberately additive
 *    list of real destinations that are NOT sidebar modules (one level
 *    deeper than the top-level nav, or Search/Command Center's own
 *    meta-pages). Filtered through the same `canAccessRoute()` the sidebar's
 *    own `isVisible()` calls internally — same permission oracle, not a
 *    second one.
 * 3. `listWorkspaceQuickActions()` — Checkpoint 38's Smart Workspace
 *    Platform "New X" shortcuts, unchanged by this cleanup.
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
export function registerGlobalCommands(navigate: (href: string) => void, can: (permission: Permission) => boolean): () => void {
  const registeredIds: string[] = [];

  for (const navModule of getVisibleNavigationModules(can)) {
    if (!navModule.href || navModule.disabled) continue;
    const href = navModule.href;
    const id = `nav-${navModule.id}`;
    registerCommand({
      id,
      label: `Open ${navModule.label}`,
      group: NAV_GROUP_LABELS[navModule.group],
      keywords: navModule.keywords,
      run: () => navigate(href),
    });
    registeredIds.push(id);
  }

  for (const extra of SUPPLEMENTARY_NAVIGATION_COMMANDS) {
    if (!canAccessRoute(extra.href, can)) continue;
    registerCommand({
      id: extra.id,
      label: extra.label,
      group: NAV_GROUP_LABELS[extra.group],
      keywords: extra.keywords,
      run: () => navigate(extra.href),
    });
    registeredIds.push(extra.id);
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

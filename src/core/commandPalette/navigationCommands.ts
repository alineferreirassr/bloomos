import type { NavGroupId } from "@/config/navigation";

/**
 * App Shell architecture cleanup — this file previously held
 * `NAVIGATION_COMMANDS`, a 30-entry hand-typed catalog that duplicated (and
 * had already drifted from) `src/config/navigation.ts`'s own 45-entry
 * `navigationModules` — e.g. it was missing Leads/Clients/Vendors/Finance/
 * Team/Reports entirely, and separately carried two different commands
 * ("Open Executive Dashboard" and "Open Analytics") pointing at the exact
 * same `/analytics` href. That duplication is gone: every Command Palette
 * "Open X" entry for a route that already has a sidebar module is now
 * *derived* from `navigationModules` itself (see `registerGlobalCommands.ts`),
 * reusing that module's own `label`/`group`/`keywords` — never re-typed here.
 *
 * What's left in this file is a small, deliberately additive list of real
 * destinations that are NOT sidebar modules at all — either because they're
 * one level deeper than the top-level nav (a sub-page of `/assets` or
 * `/finance`) or because they're the Command Center/Search's own meta-pages.
 * This is not a second route catalog: none of these hrefs exist in
 * `navigationModules` (enforced by
 * `registerGlobalCommands.test.ts`'s own drift-prevention test), so there is
 * nothing here for the two lists to disagree about.
 *
 * Each entry's `group` reuses the same `NavGroupId` vocabulary the sidebar
 * uses (via `NAV_GROUP_LABELS`) rather than inventing a parallel set of
 * group names — Command Palette group headers now match sidebar group
 * headers exactly, which they didn't before this cleanup (the old file used
 * ad-hoc labels like "Executive"/"Assets"/"Client Portal" found nowhere in
 * `NAV_GROUP_LABELS`).
 */
export interface SupplementaryNavigationCommand {
  id: string;
  label: string;
  group: NavGroupId;
  href: string;
  keywords?: string[];
}

export const SUPPLEMENTARY_NAVIGATION_COMMANDS: SupplementaryNavigationCommand[] = [
  { id: "nav-business-health", label: "Open Business Health", group: "insights", href: "/assets/business-health", keywords: ["health", "score"] },
  { id: "nav-executive-decisions", label: "Open Executive Decisions", group: "insights", href: "/assets/executive-decisions", keywords: ["decisions", "priorities"] },
  { id: "nav-knowledge-graph", label: "Open Knowledge Graph", group: "insights", href: "/assets/knowledge-graph", keywords: ["graph", "relationships"] },
  { id: "nav-workflow-builder", label: "Open Workflow Builder", group: "system", href: "/workflows", keywords: ["workflows", "automation"] },
  { id: "nav-workflow-monitoring", label: "Open Workflow Monitoring", group: "system", href: "/workflows/monitoring", keywords: ["monitoring center", "executions"] },
  { id: "nav-finance-reports", label: "Open Finance Reports", group: "business", href: "/finance/reports", keywords: ["reports"] },
  { id: "nav-global-search", label: "Open Global Search", group: "system", href: "/search", keywords: ["search", "find"] },
  { id: "nav-command-center", label: "Open Command Center", group: "system", href: "/command-center", keywords: ["commands", "shortcuts"] },
  { id: "nav-search-analytics", label: "Open Search Analytics", group: "system", href: "/search/analytics", keywords: ["search health", "coverage"] },
];

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. A plain
 * data list of every major platform's own real route — the "Open X" half
 * of the Universal Command Registry — mirroring `SearchableEntityConfig`'s
 * shape (`core/search/types.ts`) on purpose, the same "commands and search
 * results share one rendering shape" precedent `CommandAction`'s own doc
 * comment already states. Every `href` here is a route already confirmed
 * live in the route catalog audited for this checkpoint — never a
 * placeholder.
 *
 * Deliberately data, not `CommandAction[]` directly: turning a `href` into
 * a real `run()` needs a router, which only exists client-side — see
 * `registerDefaultNavigationCommands` below, which is the one place that
 * gap gets closed.
 */
export interface NavigationCommandConfig {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  href: string;
}

export const NAVIGATION_COMMANDS: NavigationCommandConfig[] = [
  { id: "nav-workspace-home", label: "Open Workspace Home", group: "Navigation", href: "/workspace", keywords: ["home", "dashboard"] },
  { id: "nav-dashboard", label: "Open Dashboard", group: "Navigation", href: "/dashboard" },
  { id: "nav-executive-dashboard", label: "Open Executive Dashboard", group: "Executive", href: "/analytics", keywords: ["executive", "kpi", "revenue"] },
  { id: "nav-business-health", label: "Open Business Health", group: "Executive", href: "/assets/business-health", keywords: ["health", "score"] },
  { id: "nav-executive-decisions", label: "Open Executive Decisions", group: "Executive", href: "/assets/executive-decisions", keywords: ["decisions", "priorities"] },
  { id: "nav-knowledge-graph", label: "Open Knowledge Graph", group: "Executive", href: "/assets/knowledge-graph", keywords: ["graph", "relationships"] },
  { id: "nav-workflow-builder", label: "Open Workflow Builder", group: "Automation", href: "/workflows", keywords: ["workflows", "automation"] },
  { id: "nav-workflow-monitoring", label: "Open Workflow Monitoring", group: "Automation", href: "/workflows/monitoring", keywords: ["monitoring center", "executions"] },
  { id: "nav-automation-center", label: "Open Automation Center", group: "Automation", href: "/automation" },
  { id: "nav-dam", label: "Open Digital Asset Library", group: "Assets", href: "/assets", keywords: ["dam", "assets", "media"] },
  { id: "nav-operational-planning", label: "Open Operational Planning", group: "Operations", href: "/operational-planning", keywords: ["plans"] },
  { id: "nav-execution-packages", label: "Open Execution Packages", group: "Operations", href: "/execution-packages", keywords: ["packages"] },
  { id: "nav-dispatch", label: "Open Dispatch", group: "Operations", href: "/dispatch" },
  { id: "nav-route-optimization", label: "Open Route Optimization", group: "Operations", href: "/route-optimization", keywords: ["routes"] },
  { id: "nav-operations-center", label: "Open Operations Center", group: "Operations", href: "/operations-center", keywords: ["alerts", "incidents"] },
  { id: "nav-allocations", label: "Open Resource Allocation", group: "Operations", href: "/allocations", keywords: ["bundles", "resources"] },
  { id: "nav-calendar", label: "Open Calendar", group: "Scheduling", href: "/calendar" },
  { id: "nav-finance-reports", label: "Open Finance Reports", group: "Finance", href: "/finance/reports", keywords: ["reports"] },
  { id: "nav-notifications", label: "Open Notifications", group: "Communication", href: "/communications", keywords: ["notification center"] },
  { id: "nav-inbox", label: "Open Inbox", group: "Communication", href: "/inbox" },
  { id: "nav-client-portal", label: "Open Client Portal Accounts", group: "Client Portal", href: "/client-portal/accounts", keywords: ["client portal", "portal"] },
  { id: "nav-proposals", label: "Open Proposals", group: "CRM", href: "/proposals" },
  { id: "nav-contracts", label: "Open Contracts", group: "CRM", href: "/contracts" },
  { id: "nav-client-journeys", label: "Open Client Journeys", group: "CRM", href: "/client-journeys" },
  { id: "nav-analytics", label: "Open Analytics", group: "Executive", href: "/analytics" },
  { id: "nav-settings", label: "Open Settings", group: "Workspace", href: "/settings" },
  { id: "nav-marketplace", label: "Open Marketplace", group: "Workspace", href: "/marketplace" },
  { id: "nav-developer-console", label: "Open Developer Console", group: "Workspace", href: "/developer" },
  // v2.0 Checkpoint 40 — Global Search & Universal Command Center's own three routes, reachable from within itself like every other platform above.
  { id: "nav-global-search", label: "Open Global Search", group: "Workspace", href: "/search", keywords: ["search", "find"] },
  { id: "nav-command-center", label: "Open Command Center", group: "Workspace", href: "/command-center", keywords: ["commands", "shortcuts"] },
  { id: "nav-search-analytics", label: "Open Search Analytics", group: "Workspace", href: "/search/analytics", keywords: ["search health", "coverage"] },
];

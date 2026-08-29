import {
  AnalyticsIcon,
  AssetsIcon,
  AutomationIcon,
  BloomAiIcon,
  CommunicationsIcon,
  CrmIcon,
  DashboardIcon,
  DeveloperIcon,
  DocumentsIcon,
  DocumentTemplatesIcon,
  EventsIcon,
  FinanceIcon,
  GridViewIcon,
  InboxIcon,
  IntegrationsIcon,
  InventoryIcon,
  MarketplaceIcon,
  NotificationsIcon,
  PurchasesIcon,
  ReportsIcon,
  SchedulingIcon,
  ServicesIcon,
  SettingsIcon,
  TeamIcon,
  VendorsIcon,
} from "@/components/ui/icons";
import { canAccessRoute } from "@/core/permissions/routeAccess";
import type { Permission } from "@/core/enums/permission";
import type { ComponentType, SVGProps } from "react";

/**
 * The permanent BloomOS sidebar architecture — one flat, data-driven array of
 * top-level modules. This is the shape every future module plugs into:
 * adding one is "append an entry with an `href` and a `group`," never a
 * change to `Sidebar`/`MobileNav`/`TopBar` themselves.
 *
 * `disabled` marks a module whose page hasn't shipped yet (none currently).
 */
export interface NavLeaf {
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
}

/**
 * The calm, domain-level grouping the Founder+Team App Shell redesign
 * introduced — every destination below is assigned exactly one group, and
 * the sidebar renders one collapsible accordion per group (see
 * `LuxuryNavGroupList.tsx`) instead of one long flat list. "Workspace" is
 * the only group that always renders open/un-collapsible, mirroring the
 * reference product's persistent home-context items above its own
 * accordions. Group membership is a pure presentation concern — it never
 * changes a route, a permission, or what a role can reach; permission
 * filtering (`getVisibleNavigationModules`) still runs first, and a group
 * left with zero visible items after that simply doesn't render, which is
 * what makes a lower-permission role's sidebar naturally shorter.
 */
export const NAV_GROUP_ORDER = [
  "workspace",
  "today",
  "relationships",
  "events",
  "operations",
  "business",
  "knowledge",
  "team",
  "insights",
  "system",
] as const;

export type NavGroupId = (typeof NAV_GROUP_ORDER)[number];

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  workspace: "Workspace",
  today: "Today",
  relationships: "Relationships",
  events: "Events",
  operations: "Operations",
  business: "Business",
  knowledge: "Knowledge",
  team: "Team",
  insights: "Insights",
  system: "System",
};

export interface NavModule {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
  disabled?: boolean;
  group: NavGroupId;
  /** Whether this module's children render expanded on first load. Irrelevant for a module with no `children`. */
  defaultExpanded?: boolean;
  children?: NavLeaf[];
  /**
   * Search synonyms for this destination — never rendered in the sidebar
   * itself, only consumed by the Command Palette (`registerGlobalCommands.ts`)
   * so "Cmd+K → type 'kpi'" can still find "Open Analytics" without a second,
   * independently-maintained route catalog. Metadata layered on the
   * canonical definition, not a parallel list keyed by id.
   */
  keywords?: string[];
}

/**
 * Every real, shipped destination in BloomOS, each carrying its own
 * `group`. Previously CRM and Events were two `children`-holding wrapper
 * modules whose sub-items (Leads, Clients, Contracts, Operational
 * Pipeline, ...) never actually rendered in the sidebar — the old
 * flattening logic collapsed each wrapper to a single row pointing at its
 * first child's href. Those sub-items are now real top-level entries in
 * their own right (`relationships`/`events` groups), which both makes them
 * reachable from the sidebar for the first time and matches the reference
 * product's one-level-deep accordion depth (no nested sub-accordions).
 * This changes no route, no permission, and no page — same 45 real,
 * already-shipped destinations as before, just regrouped and, for the 11
 * that were hidden inside `children`, made visible. One new destination,
 * `relationships-home` (`/relationships`), was added during the
 * Relationships/CRM UX phase as the group's landing experience — see
 * `RelationshipsLandingView.tsx`.
 */
export const navigationModules: NavModule[] = [
  { id: "workspace", label: "Workspace", icon: GridViewIcon, href: "/workspace", group: "workspace", keywords: ["home"] },
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/dashboard", group: "workspace" },

  { id: "calendar", label: "Calendar", icon: EventsIcon, href: "/calendar", group: "today", keywords: ["month", "week", "day", "agenda"] },
  { id: "scheduling", label: "Scheduling", icon: SchedulingIcon, href: "/scheduling", group: "today", keywords: ["availability", "reservations", "capacity"] },

  { id: "relationships-home", label: "Relationships", icon: CrmIcon, href: "/relationships", group: "relationships", keywords: ["crm", "overview", "who needs my attention"] },
  { id: "leads", label: "Leads", icon: CrmIcon, href: "/leads", group: "relationships" },
  { id: "clients", label: "Clients", icon: CrmIcon, href: "/clients", group: "relationships" },
  { id: "commercial-pipeline", label: "Commercial Pipeline", icon: CrmIcon, href: "/pipeline/commercial", group: "relationships" },
  { id: "contracts", label: "Contracts", icon: CrmIcon, href: "/contracts", group: "relationships" },
  { id: "client-accounts", label: "Client Accounts", icon: CrmIcon, href: "/client-portal/accounts", group: "relationships" },
  { id: "client-invitations", label: "Client Invitations", icon: CrmIcon, href: "/client-portal/invitations", group: "relationships" },
  { id: "crm-assistant", label: "CRM Assistant", icon: CrmIcon, href: "/crm-assistant", group: "relationships" },
  { id: "client-journeys", label: "Client Journeys", icon: CrmIcon, href: "/client-journeys", group: "relationships" },

  { id: "events", label: "Events", icon: EventsIcon, href: "/events", group: "events" },
  { id: "operational-pipeline", label: "Operational Pipeline", icon: EventsIcon, href: "/pipeline/operational", group: "events" },
  { id: "operations-dashboard", label: "Operations Dashboard", icon: EventsIcon, href: "/operations", group: "events" },
  { id: "operations-reports", label: "Operations Reports", icon: EventsIcon, href: "/operations/reports", group: "events" },

  { id: "allocations", label: "Resource Allocation", icon: AssetsIcon, href: "/allocations", group: "operations", keywords: ["bundles", "resources"] },
  { id: "operational-planning", label: "Operational Planning", icon: DocumentTemplatesIcon, href: "/operational-planning", group: "operations", keywords: ["plans"] },
  { id: "execution-packages", label: "Execution Packages", icon: InventoryIcon, href: "/execution-packages", group: "operations", keywords: ["packages"] },
  { id: "dispatch", label: "Dispatch", icon: VendorsIcon, href: "/dispatch", group: "operations" },
  { id: "field-operations", label: "Field Operations", icon: VendorsIcon, href: "/field-operations", group: "operations" },
  { id: "route-optimization", label: "Route Optimization", icon: VendorsIcon, href: "/route-optimization", group: "operations", keywords: ["routes"] },
  { id: "operations-center", label: "Operations Center", icon: VendorsIcon, href: "/operations-center", group: "operations", keywords: ["alerts", "incidents"] },

  { id: "proposals", label: "Proposals", icon: DocumentTemplatesIcon, href: "/proposals", group: "business" },
  { id: "inventory", label: "Inventory", icon: InventoryIcon, href: "/inventory", group: "business" },
  { id: "vendors", label: "Vendors", icon: VendorsIcon, href: "/vendors", group: "business" },
  { id: "purchases", label: "Purchases", icon: PurchasesIcon, href: "/purchases", group: "business" },
  { id: "finance", label: "Finance", icon: FinanceIcon, href: "/finance", group: "business" },
  { id: "services", label: "Services", icon: ServicesIcon, href: "/services", group: "business" },

  { id: "documents", label: "Documents", icon: DocumentsIcon, href: "/documents", group: "knowledge" },
  { id: "assets", label: "Asset Library", icon: AssetsIcon, href: "/assets", group: "knowledge", keywords: ["dam", "media"] },
  { id: "document-templates", label: "Document Templates", icon: DocumentTemplatesIcon, href: "/document-templates", group: "knowledge" },

  { id: "team", label: "Team", icon: TeamIcon, href: "/team", group: "team" },
  { id: "team-operations", label: "Team Operations", icon: TeamIcon, href: "/team/operations", group: "team" },

  { id: "analytics", label: "Analytics", icon: AnalyticsIcon, href: "/analytics", group: "insights", keywords: ["executive", "kpi", "revenue", "dashboard"] },
  { id: "communications", label: "Communications", icon: CommunicationsIcon, href: "/communications", group: "insights", keywords: ["notification center"] },
  { id: "notifications", label: "Notifications", icon: NotificationsIcon, href: "/notifications", group: "insights" },
  { id: "reports", label: "Reports", icon: ReportsIcon, href: "/reports", group: "insights" },
  { id: "inbox", label: "Inbox", icon: InboxIcon, href: "/inbox", group: "insights" },

  { id: "bloom-ai", label: "Bloom AI", icon: BloomAiIcon, href: "/bloom-ai", group: "system" },
  { id: "automation", label: "Automation", icon: AutomationIcon, href: "/automation", group: "system" },
  { id: "developer", label: "Developer", icon: DeveloperIcon, href: "/developer", group: "system" },
  { id: "marketplace", label: "Marketplace", icon: MarketplaceIcon, href: "/marketplace", group: "system" },
  { id: "integrations", label: "Integrations", icon: IntegrationsIcon, href: "/integrations", group: "system" },
  { id: "settings", label: "Settings", icon: SettingsIcon, href: "/settings", group: "system" },
];

function isVisible(entry: { href?: string }, can: (permission: Permission) => boolean): boolean {
  if (!entry.href) return true;
  return canAccessRoute(entry.href, can);
}

/**
 * The single visibility pass every nav-rendering surface (`Sidebar`,
 * `MobileNav`) shares — permission comes from `routeAccess.ts`, never a
 * second, nav-specific permission field. A module with `children` is dropped
 * entirely once every one of its children is hidden by permission, matching
 * how a permission-gated top-level module already disappears.
 */
export function getVisibleNavigationModules(can: (permission: Permission) => boolean): NavModule[] {
  return navigationModules
    .map((navModule): NavModule | null => {
      if (!isVisible(navModule, can)) return null;
      if (!navModule.children) return navModule;
      const children = navModule.children.filter((child) => isVisible(child, can));
      if (children.length === 0) return null;
      return { ...navModule, children };
    })
    .filter((navModule): navModule is NavModule => navModule !== null);
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  modules: NavModule[];
}

/**
 * The Founder+Team App Shell redesign's grouping pass — buckets the
 * already permission-filtered `getVisibleNavigationModules(can)` result by
 * `group`, in `NAV_GROUP_ORDER`, and drops any group left with zero
 * visible modules. This is why a lower-permission role's sidebar is
 * naturally shorter without a single route ever being hidden on purpose:
 * e.g. staff loses Analytics (so "Insights" shrinks by one) and loses
 * Developer/Marketplace/Integrations/Settings (so "System" shrinks to
 * just Bloom AI + Automation) purely because `getVisibleNavigationModules`
 * already excluded those entries — this function never re-implements or
 * duplicates that permission check.
 */
export function groupVisibleNavigationModules(can: (permission: Permission) => boolean): NavGroup[] {
  const visible = getVisibleNavigationModules(can);
  return NAV_GROUP_ORDER.map((groupId) => ({
    id: groupId,
    label: NAV_GROUP_LABELS[groupId],
    modules: visible.filter((navModule) => navModule.group === groupId),
  })).filter((group) => group.modules.length > 0);
}

/**
 * Flattened `{ label, href }` pairs for every real, navigable destination
 * (top-level direct links and every child leaf) — used by `TopBar` to look
 * up the current page's title without duplicating the tree-walk. Disabled
 * and childless-group entries are excluded since neither is ever the active
 * route. Matches the longest-prefix-wins rule `routeAccess.ts` uses, so a
 * sub-page like `/leads/123` still resolves to the "Leads" entry.
 */
export function getNavigableLabelEntries(): { label: string; href: string }[] {
  const entries: { label: string; href: string }[] = [];
  for (const navModule of navigationModules) {
    if (navModule.href && !navModule.disabled) {
      entries.push({ label: navModule.label, href: navModule.href });
    }
    for (const child of navModule.children ?? []) {
      if (child.href && !child.disabled) {
        entries.push({ label: child.label, href: child.href });
      }
    }
  }
  return entries;
}

export function findActiveNavLabel(pathname: string): string | null {
  const matches = getNavigableLabelEntries().filter(
    (entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, entry) => (entry.href.length > best.href.length ? entry : best)).label;
}

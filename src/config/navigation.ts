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
 * top-level modules, each optionally holding nested children. This is the
 * shape every future module plugs into: adding one is "append an entry with
 * an `href` (a direct link) or a `children` array (an expandable group),"
 * never a change to `Sidebar`/`MobileNav`/`TopBar` themselves.
 *
 * A module/leaf is one of two things, never both:
 * - a **direct link** (`href` set, no `children`) — clicking it navigates.
 * - an **expandable group** (`children` set, no `href` of its own) — clicking
 *   it only toggles expand/collapse; every actual destination lives in a
 *   child leaf.
 *
 * `disabled` marks a module/leaf whose module hasn't shipped yet (none
 * currently — Bloom AI activated in v2.0 Checkpoint 3's post-checkpoint
 * navigation polish once the Proposal Generator existed; Settings activated
 * in Checkpoint 11 once the Settings Platform itself existed) —
 * it renders in the permanent structure so the sidebar's shape doesn't shift
 * again when a future module ships, but isn't a real link (no `href`, or an
 * `href` that intentionally has no page behind it yet). Flipping `disabled`
 * off (and adding a real `href` if it doesn't have one already) is the
 * entire activation step for that module.
 */
export interface NavLeaf {
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
}

export interface NavModule {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
  disabled?: boolean;
  /** Whether this module's children render expanded on first load. Irrelevant for a module with no `children`. */
  defaultExpanded?: boolean;
  children?: NavLeaf[];
}

/**
 * Where Leads/Clients/Commercial Pipeline/Contracts/Client Portal
 * administration all live now that CRM is a fixed top-level module in this
 * architecture — the prior flat "Sales"/"Pipeline"/"Client Portal" groups
 * are folded into it. This moves *where* these already-shipped links sit in
 * the sidebar; it changes no route, no permission, and no page.
 */
export const navigationModules: NavModule[] = [
  // v2.0 Checkpoint 38 — Smart Workspace Platform. The new unified entry
  // point, first in the sidebar per the checkpoint's own "the Workspace
  // should become the home of BloomOS." `dashboard` (below) is unchanged
  // and stays — it's the Checkpoint 19 Luxury role-based welcome
  // experience (Owner/Team/Client variants), a different, still-real
  // surface this checkpoint composes into a widget rather than replaces.
  { id: "workspace", label: "Workspace", icon: GridViewIcon, href: "/workspace" },
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/dashboard" },
  {
    id: "crm",
    label: "CRM",
    icon: CrmIcon,
    defaultExpanded: true,
    children: [
      { id: "leads", label: "Leads", href: "/leads" },
      { id: "clients", label: "Clients", href: "/clients" },
      { id: "commercial-pipeline", label: "Commercial Pipeline", href: "/pipeline/commercial" },
      { id: "contracts", label: "Contracts", href: "/contracts" },
      { id: "client-accounts", label: "Client Accounts", href: "/client-portal/accounts" },
      { id: "client-invitations", label: "Client Invitations", href: "/client-portal/invitations" },
      { id: "crm-assistant", label: "CRM Assistant", href: "/crm-assistant" },
    ],
  },
  {
    id: "events",
    label: "Events",
    icon: EventsIcon,
    defaultExpanded: true,
    children: [
      { id: "events-list", label: "Events", href: "/events" },
      { id: "operational-pipeline", label: "Operational Pipeline", href: "/pipeline/operational" },
      { id: "operations-dashboard", label: "Operations Dashboard", href: "/operations" },
      { id: "operations-reports", label: "Operations Reports", href: "/operations/reports" },
    ],
  },
  { id: "calendar", label: "Calendar", icon: EventsIcon, href: "/calendar" },
  { id: "allocations", label: "Resource Allocation", icon: AssetsIcon, href: "/allocations" },
  { id: "operational-planning", label: "Operational Planning", icon: DocumentTemplatesIcon, href: "/operational-planning" },
  { id: "execution-packages", label: "Execution Packages", icon: InventoryIcon, href: "/execution-packages" },
  { id: "dispatch", label: "Dispatch", icon: VendorsIcon, href: "/dispatch" },
  { id: "field-operations", label: "Field Operations", icon: VendorsIcon, href: "/field-operations" },
  { id: "route-optimization", label: "Route Optimization", icon: VendorsIcon, href: "/route-optimization" },
  { id: "operations-center", label: "Operations Center", icon: VendorsIcon, href: "/operations-center" },
  { id: "client-journeys", label: "Client Journeys", icon: CrmIcon, href: "/client-journeys" },
  { id: "proposals", label: "Proposals", icon: DocumentTemplatesIcon, href: "/proposals" },
  { id: "inventory", label: "Inventory", icon: InventoryIcon, href: "/inventory" },
  { id: "vendors", label: "Vendors", icon: VendorsIcon, href: "/vendors" },
  { id: "purchases", label: "Purchases", icon: PurchasesIcon, href: "/purchases" },
  { id: "finance", label: "Finance", icon: FinanceIcon, href: "/finance" },
  { id: "documents", label: "Documents", icon: DocumentsIcon, href: "/documents" },
  { id: "assets", label: "Asset Library", icon: AssetsIcon, href: "/assets" },
  { id: "document-templates", label: "Document Templates", icon: DocumentTemplatesIcon, href: "/document-templates" },
  { id: "team", label: "Team", icon: TeamIcon, href: "/team" },
  { id: "team-operations", label: "Team Operations", icon: TeamIcon, href: "/team/operations" },
  { id: "services", label: "Services", icon: ServicesIcon, href: "/services" },
  { id: "bloom-ai", label: "Bloom AI", icon: BloomAiIcon, href: "/bloom-ai" },
  { id: "automation", label: "Automation", icon: AutomationIcon, href: "/automation" },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon, href: "/analytics" },
  { id: "communications", label: "Communications", icon: CommunicationsIcon, href: "/communications" },
  { id: "notifications", label: "Notifications", icon: NotificationsIcon, href: "/notifications" },
  { id: "reports", label: "Reports", icon: ReportsIcon, href: "/reports" },
  { id: "inbox", label: "Inbox", icon: InboxIcon, href: "/inbox" },
  { id: "developer", label: "Developer", icon: DeveloperIcon, href: "/developer" },
  { id: "marketplace", label: "Marketplace", icon: MarketplaceIcon, href: "/marketplace" },
  { id: "integrations", label: "Integrations", icon: IntegrationsIcon, href: "/integrations" },
  { id: "settings", label: "Settings", icon: SettingsIcon, href: "/settings" },
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

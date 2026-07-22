import {
  BloomAiIcon,
  CrmIcon,
  DashboardIcon,
  DocumentsIcon,
  EventsIcon,
  FinanceIcon,
  InventoryIcon,
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
 * `disabled` marks a module/leaf whose module hasn't shipped yet (Inventory,
 * Vendors, Services, Bloom AI, Settings, the future Operational Pipeline) —
 * it renders in the permanent structure so the sidebar's shape doesn't shift
 * again when that module ships, but isn't a real link (no `href`, or an
 * `href` that intentionally has no page behind it yet — see `settings`
 * below). Flipping `disabled` off (and adding a real `href` if it doesn't
 * have one already) is the entire activation step for that module.
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
    ],
  },
  {
    id: "events",
    label: "Events",
    icon: EventsIcon,
    defaultExpanded: true,
    children: [
      { id: "events-list", label: "Events", href: "/events" },
      { id: "operational-pipeline", label: "Operational Pipeline", disabled: true },
    ],
  },
  { id: "inventory", label: "Inventory", icon: InventoryIcon, disabled: true },
  { id: "vendors", label: "Vendors", icon: VendorsIcon, href: "/vendors" },
  { id: "finance", label: "Finance", icon: FinanceIcon, href: "/finance" },
  { id: "documents", label: "Documents", icon: DocumentsIcon, href: "/documents" },
  { id: "team", label: "Team", icon: TeamIcon, href: "/team" },
  { id: "services", label: "Services", icon: ServicesIcon, disabled: true },
  { id: "bloom-ai", label: "Bloom AI", icon: BloomAiIcon, disabled: true },
  // `/settings` is already reserved in core/permissions/routeAccess.ts (workspace.manage)
  // ahead of the page existing, so its href is kept here too — permission
  // visibility resolves identically to every shipped module even though
  // there's nothing to navigate to yet. `disabled: true` is what actually
  // prevents it from rendering as a clickable link.
  { id: "settings", label: "Settings", icon: SettingsIcon, href: "/settings", disabled: true },
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

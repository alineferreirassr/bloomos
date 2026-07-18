import {
  ClientPortalIcon,
  ClientsIcon,
  ContractsIcon,
  DashboardIcon,
  DocumentsIcon,
  EventsIcon,
  FinanceIcon,
  LeadsIcon,
  TeamIcon,
} from "@/components/ui/icons";
import { getRouteAccessRequirement } from "@/core/permissions/routeAccess";
import type { Permission } from "@/core/enums/permission";
import type { ComponentType, SVGProps } from "react";

/**
 * `group` is the only thing distinguishing a flat list from a grouped one —
 * `null` renders with no header (Dashboard). Adding a future item is always
 * "append to this array with a `group`," never a change to Sidebar/MobileNav
 * themselves — see `getVisibleNavigationGroups()`.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  group: string | null;
}

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon, group: null },
  { label: "Leads", href: "/leads", icon: LeadsIcon, group: "Sales" },
  { label: "Clients", href: "/clients", icon: ClientsIcon, group: "Sales" },
  { label: "Events", href: "/events", icon: EventsIcon, group: "Operations" },
  { label: "Contracts", href: "/contracts", icon: ContractsIcon, group: "Operations" },
  { label: "Finance", href: "/finance", icon: FinanceIcon, group: "Operations" },
  { label: "Documents", href: "/documents", icon: DocumentsIcon, group: "Operations" },
  {
    label: "Accounts",
    href: "/client-portal/accounts",
    icon: ClientPortalIcon,
    group: "Client Portal",
  },
  {
    label: "Invitations",
    href: "/client-portal/invitations",
    icon: ClientPortalIcon,
    group: "Client Portal",
  },
  { label: "Team", href: "/team", icon: TeamIcon, group: "Team" },
];

/**
 * Sidebar/MobileNav share this one filter instead of each re-deriving
 * visibility — the requirement itself always comes from
 * `core/permissions/routeAccess.ts` (the single route-access map), never a
 * second, nav-specific permission field on `NavItem`. An item whose route
 * only requires active membership (or isn't listed at all) is always shown;
 * `Sidebar`/`MobileNav` only ever render once the member is already known to
 * be active (see `(app)/layout.tsx`), so the only real filtering that
 * happens here is by specific permission.
 */
export function getVisibleNavigationItems(can: (permission: Permission) => boolean): NavItem[] {
  return navigationItems.filter((item) => {
    const requirement = getRouteAccessRequirement(item.href);
    if (!requirement || requirement.kind === "active-membership") return true;
    return can(requirement.permission);
  });
}

export interface NavGroup {
  /** `null` = the ungrouped top-level items (Dashboard) — rendered with no group header. */
  label: string | null;
  items: NavItem[];
}

/**
 * Groups the same permission-filtered items `getVisibleNavigationItems`
 * already computes — never a second, independent filtering pass. Group
 * order follows each item's first appearance in `navigationItems`; a group
 * that ends up with zero visible items (every item inside it hidden by
 * permission) is dropped entirely rather than rendered as an empty header.
 */
export function getVisibleNavigationGroups(can: (permission: Permission) => boolean): NavGroup[] {
  const visible = getVisibleNavigationItems(can);
  const groups: NavGroup[] = [];
  for (const item of visible) {
    let group = groups.find((g) => g.label === item.group);
    if (!group) {
      group = { label: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

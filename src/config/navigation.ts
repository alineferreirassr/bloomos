import {
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

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Leads", href: "/leads", icon: LeadsIcon },
  { label: "Clients", href: "/clients", icon: ClientsIcon },
  { label: "Events", href: "/events", icon: EventsIcon },
  { label: "Contracts", href: "/contracts", icon: ContractsIcon },
  { label: "Finance", href: "/finance", icon: FinanceIcon },
  { label: "Documents", href: "/documents", icon: DocumentsIcon },
  { label: "Team", href: "/team", icon: TeamIcon },
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

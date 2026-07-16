import {
  ClientsIcon,
  ContractsIcon,
  DashboardIcon,
  DocumentsIcon,
  EventsIcon,
  FinanceIcon,
  LeadsIcon,
} from "@/components/ui/icons";
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
];

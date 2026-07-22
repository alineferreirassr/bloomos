import type { SVGProps } from "react";
import {
  Home,
  Users,
  User,
  Calendar,
  FileText,
  DollarSign,
  Folder,
  Menu,
  X,
  UserCog,
  KeyRound,
  Kanban,
  Handshake,
  Package,
  Truck,
  Wrench,
  Sparkles,
  Settings,
  ChevronRight,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

/* Icon choice per nav item matches the approved Sidebar.dc.html exactly:
   dashboard=home, leads=users (group), clients=user (single person),
   events=calendar, contracts=file, financial=dollar. */
export function DashboardIcon(props: IconProps) {
  return <Home strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LeadsIcon(props: IconProps) {
  return <Users strokeWidth={2} aria-hidden="true" {...props} />;
}

export function ClientsIcon(props: IconProps) {
  return <User strokeWidth={2} aria-hidden="true" {...props} />;
}

export function EventsIcon(props: IconProps) {
  return <Calendar strokeWidth={2} aria-hidden="true" {...props} />;
}

export function ContractsIcon(props: IconProps) {
  return <FileText strokeWidth={2} aria-hidden="true" {...props} />;
}

export function FinanceIcon(props: IconProps) {
  return <DollarSign strokeWidth={2} aria-hidden="true" {...props} />;
}

export function DocumentsIcon(props: IconProps) {
  return <Folder strokeWidth={2} aria-hidden="true" {...props} />;
}

export function TeamIcon(props: IconProps) {
  return <UserCog strokeWidth={2} aria-hidden="true" {...props} />;
}

export function PipelineIcon(props: IconProps) {
  return <Kanban strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Distinct from ClientsIcon (the CRM record) — this represents external account/access administration, not the client relationship itself. */
export function ClientPortalIcon(props: IconProps) {
  return <KeyRound strokeWidth={2} aria-hidden="true" {...props} />;
}

/** CRM (top-level nav module) — distinct from ClientsIcon/LeadsIcon, which represent the individual record types nested inside it. */
export function CrmIcon(props: IconProps) {
  return <Handshake strokeWidth={2} aria-hidden="true" {...props} />;
}

export function InventoryIcon(props: IconProps) {
  return <Package strokeWidth={2} aria-hidden="true" {...props} />;
}

export function VendorsIcon(props: IconProps) {
  return <Truck strokeWidth={2} aria-hidden="true" {...props} />;
}

export function ServicesIcon(props: IconProps) {
  return <Wrench strokeWidth={2} aria-hidden="true" {...props} />;
}

export function BloomAiIcon(props: IconProps) {
  return <Sparkles strokeWidth={2} aria-hidden="true" {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Settings strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Expand/collapse affordance for a nav module with nested children — rotates via a CSS transform, never swapped for a separate "collapsed" icon component. */
export function NavChevronIcon(props: IconProps) {
  return <ChevronRight strokeWidth={2} aria-hidden="true" {...props} />;
}

export function MenuIcon(props: IconProps) {
  return <Menu strokeWidth={2} aria-hidden="true" {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <X strokeWidth={2} aria-hidden="true" {...props} />;
}

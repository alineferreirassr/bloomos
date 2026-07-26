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
  ShoppingCart,
  Wrench,
  Sparkles,
  Settings,
  ChevronRight,
  Lock,
  LayoutGrid,
  List,
  GripVertical,
  ChevronDown,
  Plus,
  Check,
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

export function PurchasesIcon(props: IconProps) {
  return <ShoppingCart strokeWidth={2} aria-hidden="true" {...props} />;
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

/** A published (immutable) ServiceVersion or a locked/read-only row — e.g. TemplateItemRow's published-version lock state. */
export function LockIcon(props: IconProps) {
  return <Lock strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Grid/card view mode — e.g. the Services Catalog's ViewToggle. */
export function GridViewIcon(props: IconProps) {
  return <LayoutGrid strokeWidth={2} aria-hidden="true" {...props} />;
}

/** List/table view mode — e.g. the Services Catalog's ViewToggle. */
export function ListViewIcon(props: IconProps) {
  return <List strokeWidth={2} aria-hidden="true" {...props} />;
}

/** A drag handle affordance — e.g. TemplateItemRow's reorder grip. */
export function GripIcon(props: IconProps) {
  return <GripVertical strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Expand/collapse affordance — rotate via className for the collapsed state. */
export function ChevronDownIcon(props: IconProps) {
  return <ChevronDown strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Add-item affordance — e.g. a Template category's "Add item" button. */
export function PlusIcon(props: IconProps) {
  return <Plus strokeWidth={2} aria-hidden="true" {...props} />;
}

/** A success confirmation — e.g. the shared Toast's success tone. */
export function CheckIcon(props: IconProps) {
  return <Check strokeWidth={2} aria-hidden="true" {...props} />;
}

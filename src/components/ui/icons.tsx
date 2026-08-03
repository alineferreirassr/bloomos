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
  Zap,
  Plug,
  LayoutTemplate,
  BarChart3,
  FileBarChart2,
  Terminal,
  Store,
  Bell,
  BellRing,
  Inbox,
  Image,
  Search,
  Command,
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

/** Automation Engine (top-level nav module, Checkpoint 9) — distinct from BloomAiIcon: this represents deterministic, triggered execution, not AI generation. */
export function AutomationIcon(props: IconProps) {
  return <Zap strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Document Intelligence Platform (top-level nav module, Checkpoint 12) — distinct from DocumentsIcon: this represents template-driven generation, not file storage/upload. */
export function DocumentTemplatesIcon(props: IconProps) {
  return <LayoutTemplate strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Executive Analytics Platform (top-level nav module, Checkpoint 15) — cross-module KPIs/trends, distinct from every single-domain icon above. */
export function AnalyticsIcon(props: IconProps) {
  return <BarChart3 strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Reporting & Business Intelligence Platform (top-level nav module, Checkpoint 42) — the unified Reporting Center, distinct from AnalyticsIcon's plain bar chart: this is composed, saved, and shareable reports over every module's own metrics. */
export function ReportsIcon(props: IconProps) {
  return <FileBarChart2 strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Communication & Collaboration Platform (top-level nav module, Checkpoint 24) — Notification Center/Activity Feed/Announcements/Reminders. */
export function CommunicationsIcon(props: IconProps) {
  return <Bell strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Notification Center (top-level nav module, Checkpoint 41) — the dedicated `/notifications` dashboard, distinct from CommunicationsIcon's plain Bell (the `/communications` tab it lives alongside). */
export function NotificationsIcon(props: IconProps) {
  return <BellRing strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Unified Inbox (top-level nav module, Checkpoint 24) — Internal Messaging + Client Portal threads merged, distinct from CommunicationsIcon: this is conversations, not alerts. */
export function InboxIcon(props: IconProps) {
  return <Inbox strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Public API Developer Console (top-level nav module, Checkpoint 16) — API Keys/scopes/usage, distinct from SettingsIcon: this is a developer-facing credential surface, not a Workspace configuration screen. */
export function DeveloperIcon(props: IconProps) {
  return <Terminal strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Marketplace & Integrations Platform (top-level nav module, Checkpoint 18) — Browse/Installed connectors, distinct from DeveloperIcon: this is a Workspace-owner-facing catalog, not a credential/API surface. */
export function MarketplaceIcon(props: IconProps) {
  return <Store strokeWidth={2} aria-hidden="true" {...props} />;
}

/** Enterprise Integration Platform (top-level nav module, v2 Checkpoint 22) — the workspace-wide connection health dashboard, distinct from MarketplaceIcon (a Browse/Install catalog) and DeveloperIcon (API Keys/Webhooks/config): this is a read-only health view of installed provider connections. */
export function IntegrationsIcon(props: IconProps) {
  return <Plug strokeWidth={2} aria-hidden="true" {...props} />;
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

/* v2.0 Checkpoint 25 — Digital Asset Management Platform. */
export function AssetsIcon(props: IconProps) {
  return <Image strokeWidth={2} aria-hidden="true" {...props} />;
}

/* v2.0 Checkpoint 40 — Global Search & Universal Command Center. */
export function SearchIcon(props: IconProps) {
  return <Search strokeWidth={2} aria-hidden="true" {...props} />;
}

export function CommandCenterIcon(props: IconProps) {
  return <Command strokeWidth={2} aria-hidden="true" {...props} />;
}

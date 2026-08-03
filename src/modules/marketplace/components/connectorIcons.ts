import {
  Calendar,
  HardDrive,
  Mail,
  Inbox,
  Hash,
  MessageCircle,
  CreditCard,
  Wallet,
  Zap,
  Workflow,
  FileText,
  Building2,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/** `ConnectorDefinition.icon` is a plain string (never a component reference — keeps the Connector Registry importable from server code), the same reasoning `modules/analytics/components/metricIcons.ts` already established for Metrics. `HelpCircle` is the fallback for a name not in this map. */
const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  Calendar,
  HardDrive,
  Mail,
  Inbox,
  Hash,
  MessageCircle,
  CreditCard,
  Wallet,
  Zap,
  Workflow,
  FileText,
  Building2,
};

export function resolveConnectorIcon(name: string): LucideIcon {
  return CONNECTOR_ICONS[name] ?? HelpCircle;
}

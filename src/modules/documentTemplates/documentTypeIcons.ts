import {
  FileSignature,
  FileText,
  Receipt,
  ReceiptText,
  BookOpen,
  ClipboardList,
  ListChecks,
  CalendarClock,
  HelpCircle,
  Library,
  Map,
  MessageCircleQuestion,
  Heart,
  Star,
  Handshake,
  Mail,
  type LucideIcon,
} from "lucide-react";

/**
 * `DocumentTypeDefinition.icon` is a plain string (never a React component
 * reference — see that field's own doc comment in `types/documentPlatform.ts`),
 * so the Document Type Registry stays importable from server code. This is
 * the one place that string is resolved to a real icon, mirroring
 * `modules/settings/sectionIcons.ts`'s own `resolveSectionIcon` exactly.
 * `HelpCircle` is the fallback for a name not in this map — should only
 * happen for a future document type whose own icon string hasn't been
 * added here yet, never for one of the Step 2 built-ins.
 */
const DOCUMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  FileSignature,
  FileText,
  Receipt,
  ReceiptText,
  BookOpen,
  ClipboardList,
  ListChecks,
  CalendarClock,
  Library,
  Map,
  MessageCircleQuestion,
  Heart,
  Star,
  Handshake,
  Mail,
};

export function resolveDocumentTypeIcon(name: string): LucideIcon {
  return DOCUMENT_TYPE_ICONS[name] ?? HelpCircle;
}

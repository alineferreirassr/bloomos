import {
  LuxuryDashboardIcon,
  LuxuryCalendarIcon,
  LuxuryScheduleIcon,
  LuxuryChecklistIcon,
  LuxuryPaymentIcon,
  LuxuryMessageIcon,
  LuxuryDocumentIcon,
  LuxuryBellIcon,
  LuxurySparklesIcon,
  LuxurySettingsIcon,
} from "@/modules/dashboard/luxury/luxuryIcons";
import { ContractsIcon, DocumentTemplatesIcon, InboxIcon } from "@/components/ui/icons";
import type { LuxuryNavEntry } from "@/modules/dashboard/luxury/components/LuxuryNavRows";

/**
 * Checkpoint 19, Step 9/11 — the Client Dashboard's own flat nav list.
 * Every entry is a real, existing `(client-portal)/client-access/*`
 * route (`ClientPortalShell.tsx`'s own `NAV_ITEMS`, mirrored here with
 * Luxury labels/icons) — the reference image also names "Design &
 * Inspiration" and "Gallery," neither of which have a real page yet, so
 * they're not invented here; see docs/client-dashboard-experience.md's
 * Known limitations.
 *
 * Checkpoint 36, Step 18 — "Journey," "Proposals," "Communication," and
 * "Settings" were added here once their own Centers existed (Steps 2, 3,
 * 7, 12); `ClientPortalShell.tsx`'s classical `NAV_ITEMS` already carried
 * all four, so this was a real gap in the Luxury-themed nav, not a
 * deliberate omission. "Account" stays off this list, matching that same
 * classical shell's own pattern of keeping it out of the primary nav.
 */
export const CLIENT_NAV_ENTRIES: LuxuryNavEntry[] = [
  { id: "dashboard", label: "Dashboard", href: "/client-access", icon: LuxuryDashboardIcon },
  { id: "journey", label: "My Journey", href: "/client-access/journey", icon: LuxurySparklesIcon },
  { id: "my-event", label: "My Event", href: "/client-access/events", icon: LuxuryCalendarIcon },
  { id: "timeline", label: "Timeline", href: "/client-access/timeline", icon: LuxuryScheduleIcon },
  { id: "proposals", label: "Proposals", href: "/client-access/proposals", icon: DocumentTemplatesIcon },
  { id: "contracts", label: "Contracts", href: "/client-access/contracts", icon: ContractsIcon },
  { id: "checklist", label: "Planning Checklist", href: "/client-access/checklist", icon: LuxuryChecklistIcon },
  { id: "payments", label: "Payments", href: "/client-access/invoices", icon: LuxuryPaymentIcon },
  { id: "messages", label: "Messages", href: "/client-access/messages", icon: LuxuryMessageIcon },
  { id: "communication", label: "Communication", href: "/client-access/communication", icon: InboxIcon },
  { id: "documents", label: "Documents", href: "/client-access/documents", icon: LuxuryDocumentIcon },
  { id: "notifications", label: "Notifications", href: "/client-access/notifications", icon: LuxuryBellIcon },
  { id: "settings", label: "Settings", href: "/client-access/settings", icon: LuxurySettingsIcon },
];

import { HelpCircle } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import {
  LuxuryHeartIcon,
  LuxuryBellIcon,
  LuxuryMessageIcon,
  LuxuryCalendarIcon,
  LuxuryScheduleIcon,
  LuxuryChecklistIcon,
  LuxuryTaskIcon,
  LuxuryRevenueIcon,
  LuxuryPaymentIcon,
  LuxuryCameraIcon,
  LuxuryWeatherIcon,
  LuxuryPhoneIcon,
  LuxuryMailIcon,
  LuxuryLocationIcon,
  LuxurySparklesIcon,
  LuxuryUsersIcon,
  LuxuryDocumentIcon,
} from "@/modules/dashboard/luxury/luxuryIcons";

/** String-keyed icon lookup — the same reasoning `resolveMetricIcon`/`resolveConnectorIcon` already established: a dashboard data DTO carries a plain icon *name*, never a component reference, so it stays serializable across the server/client boundary (see the Analytics checkpoint's own serialization bug, documented in docs/luxury-design-system.md). `HelpCircle` is the fallback for an unrecognized name. */
type LuxuryIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const LUXURY_ICONS: Record<string, LuxuryIconComponent> = {
  Heart: LuxuryHeartIcon,
  Bell: LuxuryBellIcon,
  Message: LuxuryMessageIcon,
  Calendar: LuxuryCalendarIcon,
  Schedule: LuxuryScheduleIcon,
  Checklist: LuxuryChecklistIcon,
  Task: LuxuryTaskIcon,
  Revenue: LuxuryRevenueIcon,
  Payment: LuxuryPaymentIcon,
  Camera: LuxuryCameraIcon,
  Weather: LuxuryWeatherIcon,
  Phone: LuxuryPhoneIcon,
  Mail: LuxuryMailIcon,
  Location: LuxuryLocationIcon,
  Sparkles: LuxurySparklesIcon,
  Users: LuxuryUsersIcon,
  Document: LuxuryDocumentIcon,
};

export function resolveLuxuryIcon(name: string): LuxuryIconComponent {
  return LUXURY_ICONS[name] ?? HelpCircle;
}

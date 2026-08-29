import type { SVGProps } from "react";
import {
  Heart,
  Bell,
  MessageCircle,
  ChevronDown,
  Calendar,
  CalendarClock,
  Clock,
  ClipboardCheck,
  ListChecks,
  TrendingUp,
  DollarSign,
  Camera,
  CloudSun,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  CheckCircle2,
  Circle,
  Users,
  ChevronRight,
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
  Settings,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Checkpoint 19 — icons specific to the Luxury Dashboard experience, kept
 * separate from `components/ui/icons.tsx` (that file is specifically the
 * Sidebar nav-module icon set). Every icon here is a thin, documented
 * lucide-react wrapper, the same one-icon-per-function convention every
 * other icon file in this codebase already follows.
 */
export function LuxuryHeartIcon(props: IconProps) {
  return <Heart strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryBellIcon(props: IconProps) {
  return <Bell strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryMessageIcon(props: IconProps) {
  return <MessageCircle strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryChevronDownIcon(props: IconProps) {
  return <ChevronDown strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryChevronRightIcon(props: IconProps) {
  return <ChevronRight strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryCalendarIcon(props: IconProps) {
  return <Calendar strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryScheduleIcon(props: IconProps) {
  return <CalendarClock strokeWidth={2} aria-hidden="true" {...props} />;
}

/** The World Clock card's small per-city decorative mark — a restrained round clock face rather than a full illustrated icon, matching the "subtle round time-of-day icon" option (WorldClockCard.tsx). */
export function LuxuryClockIcon(props: IconProps) {
  return <Clock strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryChecklistIcon(props: IconProps) {
  return <ClipboardCheck strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryTaskIcon(props: IconProps) {
  return <ListChecks strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryRevenueIcon(props: IconProps) {
  return <TrendingUp strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryPaymentIcon(props: IconProps) {
  return <DollarSign strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryCameraIcon(props: IconProps) {
  return <Camera strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryWeatherIcon(props: IconProps) {
  return <CloudSun strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryPhoneIcon(props: IconProps) {
  return <Phone strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryMailIcon(props: IconProps) {
  return <Mail strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryLocationIcon(props: IconProps) {
  return <MapPin strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxurySparklesIcon(props: IconProps) {
  return <Sparkles strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryCheckedCircleIcon(props: IconProps) {
  return <CheckCircle2 strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryUncheckedCircleIcon(props: IconProps) {
  return <Circle strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryUsersIcon(props: IconProps) {
  return <Users strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryDashboardIcon(props: IconProps) {
  return <LayoutDashboard strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryDocumentIcon(props: IconProps) {
  return <FileText strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxuryGalleryIcon(props: IconProps) {
  return <ImageIcon strokeWidth={2} aria-hidden="true" {...props} />;
}

export function LuxurySettingsIcon(props: IconProps) {
  return <Settings strokeWidth={2} aria-hidden="true" {...props} />;
}

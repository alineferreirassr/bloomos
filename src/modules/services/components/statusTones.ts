import type { BadgeTone } from "@/components/ui/Badge";
import type { ServiceStatus } from "@/core/enums/serviceStatus";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";

/**
 * One centralized status→tone mapping per domain status family, so
 * ServiceStatusBadge/EventServiceStatusBadge never duplicate this logic (or
 * drift out of sync with each other) the way a copy-pasted mapping in each
 * badge component would. No traffic-light red/yellow/green — tone is
 * expressed only through Badge's existing outline/accent/neutral/danger
 * vocabulary, and `danger` is reserved for a genuinely terminal, unwanted
 * state (cancelled), never for a normal step in a lifecycle.
 */
export const SERVICE_STATUS_TONES: Record<ServiceStatus, BadgeTone> = {
  draft: "neutral",
  active: "accent",
  inactive: "outline",
  archived: "neutral",
};

export const EVENT_SERVICE_STATUS_TONES: Record<EventServiceStatus, BadgeTone> = {
  proposed: "outline",
  confirmed: "accent",
  in_progress: "accent",
  completed: "neutral",
  cancelled: "danger",
};

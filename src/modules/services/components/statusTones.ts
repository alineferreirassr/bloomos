import type { BadgeTone } from "@/components/ui/Badge";
import type { ServiceStatus } from "@/core/enums/serviceStatus";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";

/**
 * One centralized status→tone mapping per domain status family, so
 * ServiceStatusBadge/EventServiceStatusBadge never duplicate this logic (or
 * drift out of sync with each other) the way a copy-pasted mapping in each
 * badge component would. Checkpoint 19.3 — Bloom Status Badge system:
 * `cancelled` now maps to `neutral`, matching the convention every other
 * *StatusBadge component in the app already uses for a lifecycle's own
 * terminal-but-not-alarming state (see docs/bloom-design-language.md) —
 * `danger` is reserved for something that actively needs attention right
 * now (e.g. an overdue payment), not a step that already reached its end.
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
  cancelled: "neutral",
};

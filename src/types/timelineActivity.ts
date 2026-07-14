import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

export interface TimelineActivity {
  id: string;
  lead_id: string;
  type: TimelineActivityType;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
}

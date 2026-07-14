import type { EventScheduleItem } from "@/types/eventScheduleItem";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * event_3 and event_5 intentionally have zero schedule items — event_3
 * (awaiting deposit) has checklist items but no day-of schedule yet, and
 * event_5 (draft) has neither. Both demonstrate the "no schedule items yet"
 * state that getEventNextRecommendedAction reacts to.
 */
const SEED_SCHEDULE_ITEMS: EventScheduleItem[] = [
  // event_1 — Malibu Sunset Proposal
  {
    id: "schedule_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Team arrival & setup",
    description: null,
    start_time: "17:00",
    end_time: "17:45",
    location: "El Matador State Beach",
    assigned_to: "Amoré Bloom Team",
    category: "arrival",
    status: "confirmed",
    sort_order: 0,
    created_at: "2026-06-25T09:00:00.000Z",
    updated_at: "2026-06-25T09:00:00.000Z",
  },
  {
    id: "schedule_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Florals + signage placed",
    description: null,
    start_time: "17:45",
    end_time: "18:15",
    location: "El Matador State Beach",
    assigned_to: "Amoré Bloom Team",
    category: "setup",
    status: "confirmed",
    sort_order: 1,
    created_at: "2026-06-25T09:01:00.000Z",
    updated_at: "2026-06-25T09:01:00.000Z",
  },
  {
    id: "schedule_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Photographer arrives",
    description: null,
    start_time: "18:00",
    end_time: "18:15",
    location: "El Matador State Beach",
    assigned_to: null,
    category: "photography",
    status: "confirmed",
    sort_order: 2,
    created_at: "2026-06-25T09:02:00.000Z",
    updated_at: "2026-06-25T09:02:00.000Z",
  },
  {
    id: "schedule_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Jordan & Sam arrive (surprise walk)",
    description: null,
    start_time: "18:25",
    end_time: "18:35",
    location: "El Matador State Beach",
    assigned_to: null,
    category: "surprise",
    status: "planned",
    sort_order: 3,
    created_at: "2026-06-25T09:03:00.000Z",
    updated_at: "2026-06-25T09:03:00.000Z",
  },
  {
    id: "schedule_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Breakdown & departure",
    description: null,
    start_time: "20:00",
    end_time: "20:30",
    location: "El Matador State Beach",
    assigned_to: "Amoré Bloom Team",
    category: "departure",
    status: "planned",
    sort_order: 4,
    created_at: "2026-06-25T09:04:00.000Z",
    updated_at: "2026-06-25T09:04:00.000Z",
  },

  // event_2 — Casey's Birthday Hotel Suite
  {
    id: "schedule_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    title: "Decor team hotel arrival",
    description: null,
    start_time: "14:30",
    end_time: "15:00",
    location: "Fairmont San Francisco",
    assigned_to: "Amoré Bloom Team",
    category: "arrival",
    status: "planned",
    sort_order: 0,
    created_at: "2026-07-08T14:05:00.000Z",
    updated_at: "2026-07-08T14:05:00.000Z",
  },
  {
    id: "schedule_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    title: "Room decorated & staged",
    description: null,
    start_time: "15:00",
    end_time: "16:30",
    location: "Fairmont San Francisco",
    assigned_to: "Amoré Bloom Team",
    category: "setup",
    status: "planned",
    sort_order: 1,
    created_at: "2026-07-08T14:06:00.000Z",
    updated_at: "2026-07-08T14:06:00.000Z",
  },

  // event_4 — Whitfield In-Home Romantic Setup (completed)
  {
    id: "schedule_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    title: "Setup team arrival",
    description: null,
    start_time: "17:30",
    end_time: "18:00",
    location: "Client residence",
    assigned_to: "Amoré Bloom Team",
    category: "arrival",
    status: "completed",
    sort_order: 0,
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-18T18:00:00.000Z",
  },
  {
    id: "schedule_9",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    title: "Candlelight + florals staged",
    description: null,
    start_time: "18:00",
    end_time: "18:45",
    location: "Client residence",
    assigned_to: "Amoré Bloom Team",
    category: "setup",
    status: "completed",
    sort_order: 1,
    created_at: "2026-06-10T10:01:00.000Z",
    updated_at: "2026-06-18T18:45:00.000Z",
  },
  {
    id: "schedule_10",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    title: "Cleanup",
    description: null,
    start_time: "20:45",
    end_time: "21:15",
    location: "Client residence",
    assigned_to: "Amoré Bloom Team",
    category: "cleanup",
    status: "completed",
    sort_order: 2,
    created_at: "2026-06-10T10:02:00.000Z",
    updated_at: "2026-06-18T21:15:00.000Z",
  },
];

let scheduleItems: EventScheduleItem[] = SEED_SCHEDULE_ITEMS.map((item) => ({ ...item }));

export function readScheduleItems(): EventScheduleItem[] {
  return scheduleItems;
}

export function writeScheduleItems(next: EventScheduleItem[]): void {
  scheduleItems = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetScheduleStore(): void {
  scheduleItems = SEED_SCHEDULE_ITEMS.map((item) => ({ ...item }));
}

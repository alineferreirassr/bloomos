import type { TimelineActivity } from "@/types/timelineActivity";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso } from "@/lib/data/utils";

const SEED_ACTIVITIES: TimelineActivity[] = [
  {
    id: "activity_1",
    lead_id: "lead_1",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-02T14:30:00.000Z",
  },
  {
    id: "activity_2",
    lead_id: "lead_1",
    type: "note_added",
    description: 'Note added: "Shellfish allergy"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T15:00:00.000Z",
  },
  {
    id: "activity_3",
    lead_id: "lead_1",
    type: "note_pinned",
    description: 'Note pinned: "Shellfish allergy"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T15:01:00.000Z",
  },
  {
    id: "activity_4",
    lead_id: "lead_1",
    type: "note_added",
    description: 'Note added: "Prefers string quartet"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-10T10:30:00.000Z",
  },
  {
    id: "activity_5",
    lead_id: "lead_1",
    type: "status_changed",
    description: "Status changed from Contacted to Qualified",
    actor: "Aline Ferreira",
    timestamp: "2026-06-20T09:15:00.000Z",
    metadata: { from: "contacted", to: "qualified" },
  },
  {
    id: "activity_6",
    lead_id: "lead_2",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-18T18:05:00.000Z",
  },
  {
    id: "activity_7",
    lead_id: "lead_2",
    type: "status_changed",
    description: "Status changed from New to Contacted",
    actor: "Aline Ferreira",
    timestamp: "2026-06-19T10:00:00.000Z",
    metadata: { from: "new", to: "contacted" },
  },
  {
    id: "activity_8",
    lead_id: "lead_3",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-05-28T12:00:00.000Z",
  },
  {
    id: "activity_9",
    lead_id: "lead_3",
    type: "note_added",
    description: 'Note added: "Drone footage idea"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "activity_10",
    lead_id: "lead_3",
    type: "status_changed",
    description: "Status changed from Qualified to Proposal Sent",
    actor: "Aline Ferreira",
    timestamp: "2026-06-15T16:45:00.000Z",
    metadata: { from: "qualified", to: "proposal_sent" },
  },
  {
    id: "activity_11",
    lead_id: "lead_4",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-07-10T08:20:00.000Z",
  },
  {
    id: "activity_12",
    lead_id: "lead_5",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-04-01T11:00:00.000Z",
  },
  {
    id: "activity_13",
    lead_id: "lead_5",
    type: "status_changed",
    description: "Status changed from Proposal Sent to Lost",
    actor: "Aline Ferreira",
    timestamp: "2026-04-22T13:30:00.000Z",
    metadata: { from: "proposal_sent", to: "lost" },
  },
];

let activities: TimelineActivity[] = SEED_ACTIVITIES.map((activity) => ({
  ...activity,
}));

export function readActivities(): TimelineActivity[] {
  return activities;
}

export function writeActivities(next: TimelineActivity[]): void {
  activities = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetTimelineStore(): void {
  activities = SEED_ACTIVITIES.map((activity) => ({ ...activity }));
}

/**
 * The single mechanism for recording a timeline entry — the data layer and
 * every module-level service (e.g. LeadConversionService) call this rather
 * than constructing a TimelineActivity by hand.
 */
export function recordTimelineActivity(
  leadId: string,
  type: TimelineActivity["type"],
  description: string,
  metadata?: TimelineActivity["metadata"],
): TimelineActivity {
  const activity: TimelineActivity = {
    id: generateId("activity"),
    lead_id: leadId,
    type,
    description,
    actor: CURRENT_ACTOR,
    timestamp: nowIso(),
    ...(metadata ? { metadata } : {}),
  };
  writeActivities([...readActivities(), activity]);
  return activity;
}

import type { TimelineActivity } from "@/types/timelineActivity";
import type { EntityType } from "@/core/enums/entityType";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { generateId, nowIso } from "@/lib/data/utils";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { getLogger } from "@/core/observability/logger";

const SEED_ACTIVITIES: TimelineActivity[] = [
  {
    id: "activity_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-02T14:30:00.000Z",
  },
  {
    id: "activity_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "note_added",
    description: 'Note added: "Shellfish allergy"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T15:00:00.000Z",
  },
  {
    id: "activity_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "note_pinned",
    description: 'Note pinned: "Shellfish allergy"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T15:01:00.000Z",
  },
  {
    id: "activity_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "note_added",
    description: 'Note added: "Prefers string quartet"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-10T10:30:00.000Z",
  },
  {
    id: "activity_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "status_changed",
    description: "Status changed from Contacted to Qualified",
    actor: "Aline Ferreira",
    timestamp: "2026-06-20T09:15:00.000Z",
    metadata: { from: "contacted", to: "qualified" },
  },
  {
    id: "activity_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_2",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-18T18:05:00.000Z",
  },
  {
    id: "activity_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_2",
    type: "status_changed",
    description: "Status changed from New to Contacted",
    actor: "Aline Ferreira",
    timestamp: "2026-06-19T10:00:00.000Z",
    metadata: { from: "new", to: "contacted" },
  },
  {
    id: "activity_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_3",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-05-28T12:00:00.000Z",
  },
  {
    id: "activity_9",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_3",
    type: "note_added",
    description: 'Note added: "Drone footage idea"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "activity_10",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_3",
    type: "status_changed",
    description: "Status changed from Qualified to Proposal Sent",
    actor: "Aline Ferreira",
    timestamp: "2026-06-15T16:45:00.000Z",
    metadata: { from: "qualified", to: "proposal_sent" },
  },
  {
    id: "activity_11",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_4",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-07-10T08:20:00.000Z",
  },
  {
    id: "activity_12",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_5",
    type: "lead_created",
    description: "Lead created",
    actor: "Aline Ferreira",
    timestamp: "2026-04-01T11:00:00.000Z",
  },
  {
    id: "activity_13",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_5",
    type: "status_changed",
    description: "Status changed from Proposal Sent to Lost",
    actor: "Aline Ferreira",
    timestamp: "2026-04-22T13:30:00.000Z",
    metadata: { from: "proposal_sent", to: "lost" },
  },
  {
    id: "client_activity_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    type: "client_created",
    description: "Client created",
    actor: "Aline Ferreira",
    timestamp: "2022-01-10T09:00:00.000Z",
  },
  {
    id: "client_activity_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    type: "note_added",
    description: 'Note added: "Tree nut allergy"',
    actor: "Aline Ferreira",
    timestamp: "2022-01-12T11:00:00.000Z",
  },
  {
    id: "client_activity_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    type: "note_pinned",
    description: 'Note pinned: "Tree nut allergy"',
    actor: "Aline Ferreira",
    timestamp: "2022-01-12T11:01:00.000Z",
  },
  {
    id: "client_activity_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    type: "vip_status_changed",
    description: "Marked as VIP",
    actor: "Aline Ferreira",
    timestamp: "2026-06-01T10:00:00.000Z",
  },

  // event_1 — Malibu Sunset Proposal
  {
    id: "event_activity_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "event_created",
    description: "Event created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T10:00:00.000Z",
  },
  {
    id: "event_activity_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "checklist_item_created",
    description: 'Checklist item created: "Confirm final headcount with Jordan"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-05T10:30:00.000Z",
  },
  {
    id: "event_activity_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "checklist_item_completed",
    description: 'Checklist item completed: "Confirm final headcount with Jordan"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-19T15:00:00.000Z",
  },
  {
    id: "event_activity_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "checklist_item_completed",
    description: 'Checklist item completed: "Book photographer"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-24T12:00:00.000Z",
  },
  {
    id: "event_activity_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "status_changed",
    description: "Status changed from Awaiting Deposit to Confirmed",
    actor: "Aline Ferreira",
    timestamp: "2026-06-24T12:30:00.000Z",
    metadata: { from: "awaiting_deposit", to: "confirmed" },
  },
  {
    id: "event_activity_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    type: "schedule_item_created",
    description: 'Schedule item created: "Team arrival & setup"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-25T09:00:00.000Z",
  },

  // event_2 — Casey's Birthday Hotel Suite
  {
    id: "event_activity_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    type: "event_created",
    description: "Event created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-12T09:00:00.000Z",
  },
  {
    id: "event_activity_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    type: "checklist_item_created",
    description: 'Checklist item created: "Confirm hotel key access with front desk"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-12T09:30:00.000Z",
  },
  {
    id: "event_activity_9",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    type: "lifecycle_stage_changed",
    description: "Lifecycle stage changed from Intake to Planning",
    actor: "Aline Ferreira",
    timestamp: "2026-07-01T10:00:00.000Z",
    metadata: { from: "intake", to: "planning" },
  },
  {
    id: "event_activity_10",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    type: "schedule_item_created",
    description: 'Schedule item created: "Decor team hotel arrival"',
    actor: "Aline Ferreira",
    timestamp: "2026-07-08T14:05:00.000Z",
  },

  // event_3 — Whitfield Anniversary Dinner
  {
    id: "event_activity_11",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_3",
    type: "event_created",
    description: "Event created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-20T11:00:00.000Z",
  },
  {
    id: "event_activity_12",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_3",
    type: "checklist_item_created",
    description: 'Checklist item created: "Send deposit invoice to James"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-20T11:30:00.000Z",
  },
  {
    id: "event_activity_13",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_3",
    type: "checklist_item_completed",
    description: 'Checklist item completed: "Send deposit invoice to James"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-24T10:00:00.000Z",
  },
  {
    id: "event_activity_14",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_3",
    type: "priority_changed",
    description: "Priority changed from Low to Normal",
    actor: "Aline Ferreira",
    timestamp: "2026-07-02T10:00:00.000Z",
    metadata: { from: "low", to: "normal" },
  },

  // event_4 — Whitfield In-Home Romantic Setup (completed)
  {
    id: "event_activity_15",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    type: "event_created",
    description: "Event created",
    actor: "Aline Ferreira",
    timestamp: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "event_activity_16",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    type: "schedule_item_created",
    description: 'Schedule item created: "Setup team arrival"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-10T10:00:00.000Z",
  },
  {
    id: "event_activity_17",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    type: "checklist_item_completed",
    description: 'Checklist item completed: "Deliver peonies and candles"',
    actor: "Aline Ferreira",
    timestamp: "2026-06-18T17:00:00.000Z",
  },
  {
    id: "event_activity_18",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    type: "event_completed",
    description: "Event completed",
    actor: "Aline Ferreira",
    timestamp: "2026-06-18T22:00:00.000Z",
  },

  // event_5 — Sonoma Vineyard Picnic (draft)
  {
    id: "event_activity_19",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_5",
    type: "event_created",
    description: "Event created",
    actor: "Aline Ferreira",
    timestamp: "2026-07-10T09:00:00.000Z",
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
 * than constructing a TimelineActivity by hand. Callers must pass the
 * owning Lead/Client's own workspace_id (never assume CURRENT_WORKSPACE_ID)
 * so every row is workspace-scoped from creation, ready for multi-tenancy.
 */
export function recordTimelineActivity(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  type: TimelineActivity["type"],
  description: string,
  metadata?: TimelineActivity["metadata"],
): TimelineActivity {
  const activity: TimelineActivity = {
    id: generateId("activity"),
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor: CURRENT_ACTOR,
    timestamp: nowIso(),
    ...(metadata ? { metadata } : {}),
  };
  writeActivities([...readActivities(), activity]);

  // v2.0 Checkpoint 39 — the generic "Timeline Event" Workflow Trigger
  // (`trigger.timeline-event`, `types/automation.ts`'s own
  // `"timeline_event"` AutomationTriggerType) fires from here, the one
  // real place every module's own Timeline write already passes through —
  // not from ~15 separately-wired call sites. `activityType` is the exact
  // generic condition field name the Compiler auto-injects
  // (`core/workflow/compiler.ts`'s own `activityTypeCondition`) and the
  // Condition Engine already reads generically from `trigger.facts`
  // (`core/automation/conditions.ts`), so this one dispatch call is what
  // makes every current and future Timeline activity type usable as a
  // Workflow Trigger with zero further engine changes. Never lets a
  // dispatch failure surface as a Timeline write failure.
  dispatchAutomationTrigger(
    {
      type: "timeline_event",
      workspaceId,
      occurredAt: activity.timestamp,
      actorMemberId: null,
      facts: { activityType: type, ownerType, ownerId, description },
    },
    { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
  ).catch((error: unknown) => getLogger().error("timeline_event trigger dispatch failed", { workspaceId, type, error: error instanceof Error ? error.message : "Unknown error" }));

  return activity;
}

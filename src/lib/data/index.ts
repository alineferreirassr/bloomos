import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { EntityType } from "@/core/enums/entityType";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { EVENT_TYPE_LABELS, type EventType } from "@/core/enums/eventType";
import type { EventPriority } from "@/core/enums/eventPriority";
import { EVENT_PRIORITY_LABELS } from "@/core/enums/eventPriority";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "@/core/enums/scheduleStatus";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { NotFoundError } from "@/core/errors";
import { canTransition, isTerminalStatus } from "@/core/workflows/leadWorkflow";
import { getClientNextRecommendedAction } from "@/core/workflows/clientWorkflow";
import {
  canTransitionEventStatus,
  canTransitionLifecycleStage,
  isEventTerminal,
  getEventNextRecommendedAction,
  EVENT_STATUS_LABELS,
  EVENT_LIFECYCLE_STAGE_LABELS,
  type EventStatus,
  type EventLifecycleStage,
} from "@/core/workflows/eventWorkflow";
import { leadDataSchema, type LeadFormInput } from "@/modules/leads/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { clientDataSchema, type ClientFormInput } from "@/modules/clients/schema";
import { eventDataSchema, scheduleItemSchema, type EventFormInput, type ScheduleItemInput } from "@/modules/events/schema";
import { checklistItemSchema, type ChecklistItemInput } from "@/modules/checklist/schema";
import { DEFAULT_CHECKLIST_TEMPLATES } from "@/modules/events/constants/checklistTemplates";
import { convertLeadToClient as convertLeadToClientService } from "@/modules/leads/services/LeadConversionService";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { delay, generateId, nowIso } from "@/lib/data/utils";
import {
  readLeads,
  writeLeads,
  resetLeadsStore,
} from "@/lib/data/mock/leadsStore";
import {
  readNotes,
  writeNotes,
  resetNotesStore,
} from "@/lib/data/mock/notesStore";
import {
  readActivities,
  recordTimelineActivity,
  resetTimelineStore,
} from "@/lib/data/mock/timelineStore";
import {
  readClients,
  writeClients,
  resetClientsStore,
} from "@/lib/data/mock/clientsStore";
import {
  readEvents,
  writeEvents,
  resetEventsStore,
} from "@/lib/data/mock/eventsStore";
import {
  readChecklistItems,
  writeChecklistItems,
  resetChecklistStore,
} from "@/lib/data/mock/checklistStore";
import {
  readScheduleItems,
  writeScheduleItems,
  resetScheduleStore,
} from "@/lib/data/mock/scheduleStore";

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | "all";
  source?: string | "all";
  eventType?: string | "all";
  includeArchived?: boolean;
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  await delay(200);
  const { search, status, source, eventType, includeArchived = false } = filters;

  return readLeads().filter((lead) => {
    if (!includeArchived && lead.status === "archived") return false;
    if (status && status !== "all" && lead.status !== status) return false;
    if (source && source !== "all" && lead.source !== source) return false;
    if (eventType && eventType !== "all" && lead.event_type !== eventType) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = `${lead.first_name} ${lead.last_name} ${lead.email}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getLeadById(id: string): Promise<Lead> {
  await delay(150);
  const lead = readLeads().find((l) => l.id === id);
  if (!lead) {
    throw new NotFoundError(`Lead ${id} was not found`);
  }
  return lead;
}

export async function createLead(input: LeadFormInput): Promise<DataResult<Lead>> {
  const parsed = leadDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const timestamp = nowIso();
  const lead: Lead = {
    id: generateId("lead"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...parsed.data,
    status: "new",
    converted_client_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeLeads([...readLeads(), lead]);
  recordTimelineActivity(lead.workspace_id, "lead", lead.id, "lead_created", "Lead created");

  return ok(lead);
}

export async function updateLead(
  id: string,
  input: LeadFormInput,
): Promise<DataResult<Lead>> {
  const existing = readLeads().find((l) => l.id === id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (existing.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }

  const parsed = leadDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: Lead = {
    ...existing,
    ...parsed.data,
    updated_at: nowIso(),
  };

  writeLeads(readLeads().map((l) => (l.id === id ? updated : l)));
  recordTimelineActivity(existing.workspace_id, "lead", id, "lead_updated", "Lead information updated");

  return ok(updated);
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<DataResult<Lead>> {
  const existing = readLeads().find((l) => l.id === id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (!canTransition(existing.status, status)) {
    return fail(
      `Cannot move a lead from "${LEAD_STATUS_LABELS[existing.status]}" to "${LEAD_STATUS_LABELS[status]}".`,
    );
  }

  const updated: Lead = { ...existing, status, updated_at: nowIso() };
  writeLeads(readLeads().map((l) => (l.id === id ? updated : l)));
  recordTimelineActivity(
    existing.workspace_id,
    "lead",
    id,
    "status_changed",
    `Status changed from ${LEAD_STATUS_LABELS[existing.status]} to ${LEAD_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

export async function archiveLead(id: string): Promise<DataResult<Lead>> {
  const existing = readLeads().find((l) => l.id === id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (existing.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }
  if (existing.status === "archived") {
    return fail("This lead is already archived.");
  }

  const timestamp = nowIso();
  const updated: Lead = {
    ...existing,
    status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeLeads(readLeads().map((l) => (l.id === id ? updated : l)));
  recordTimelineActivity(existing.workspace_id, "lead", id, "lead_archived", "Lead archived");

  return ok(updated);
}

export async function markWelcomeGuideSent(id: string): Promise<DataResult<Lead>> {
  const existing = readLeads().find((l) => l.id === id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (isTerminalStatus(existing.status)) {
    return fail("This lead is read-only and can't be updated.");
  }

  const shouldAdvanceStatus = existing.status === "new" || existing.status === "contacted";
  const updated: Lead = {
    ...existing,
    status: shouldAdvanceStatus ? "welcome_guide_sent" : existing.status,
    updated_at: nowIso(),
  };

  writeLeads(readLeads().map((l) => (l.id === id ? updated : l)));
  recordTimelineActivity(
    existing.workspace_id,
    "lead",
    id,
    "welcome_guide_sent",
    "Welcome Guide marked as sent (mock email service — no real email sent)",
  );

  return ok(updated);
}

/**
 * Conversion's business logic lives entirely in LeadConversionService — this
 * is a thin re-export so the UI keeps importing everything from one place.
 */
export const convertLeadToClient = convertLeadToClientService;

// ---------------------------------------------------------------------------
// Notes (shared by Leads and Clients — one Note shape, keyed by owner_type/owner_id)
//
// owner_id is polymorphic (a lead id on one row, a client id on the next), so
// it can never carry a normal foreign-key constraint. Every query below scopes
// by workspace_id together with owner_type/owner_id — never owner_id alone —
// so a workspace can't ever see another workspace's notes even if two ids
// happened to collide. See docs/database.md's `notes` section and Supabase
// RLS policies (once connected) for how this gets enforced at the DB layer.
// ---------------------------------------------------------------------------

async function getNotesByOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<Note[]> {
  await delay(150);
  return readNotes()
    .filter(
      (note) =>
        note.workspace_id === workspaceId && note.owner_type === ownerType && note.owner_id === ownerId,
    )
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
}

async function createNoteForOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const timestamp = nowIso();
  const note: Note = {
    id: generateId("note"),
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    ...parsed.data,
    is_pinned: false,
    attachments: [],
    created_by: CURRENT_ACTOR,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeNotes([...readNotes(), note]);
  recordTimelineActivity(workspaceId, ownerType, ownerId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

export async function getNotesByLeadId(leadId: string): Promise<Note[]> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) return [];
  return getNotesByOwner(lead.workspace_id, "lead", leadId);
}

export async function createNote(
  leadId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) {
    return fail("Lead not found.");
  }
  if (lead.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }
  return createNoteForOwner(lead.workspace_id, "lead", leadId, input);
}

export async function getNotesByClientId(clientId: string): Promise<Note[]> {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) return [];
  return getNotesByOwner(client.workspace_id, "client", clientId);
}

export async function createClientNote(
  clientId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) {
    return fail("Client not found.");
  }
  return createNoteForOwner(client.workspace_id, "client", clientId, input);
}

export async function togglePinNote(noteId: string): Promise<DataResult<Note>> {
  const existing = readNotes().find((n) => n.id === noteId);
  if (!existing) {
    return fail("Note not found.");
  }
  if (existing.owner_type === "lead") {
    const lead = readLeads().find((l) => l.id === existing.owner_id);
    if (lead?.status === "converted") {
      return fail("This lead was converted to a Client and is read-only.");
    }
  }

  const updated: Note = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Timeline (shared by Leads and Clients — one shape, keyed by owner_type/owner_id)
//
// Same polymorphic-owner caveat as Notes above: owner_id alone is never a
// safe scope, so every read filters by workspace_id + owner_type + owner_id.
// ---------------------------------------------------------------------------

async function getTimelineByOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<TimelineActivity[]> {
  await delay(150);
  return readActivities()
    .filter(
      (activity) =>
        activity.workspace_id === workspaceId &&
        activity.owner_type === ownerType &&
        activity.owner_id === ownerId,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getTimelineByLeadId(leadId: string): Promise<TimelineActivity[]> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) return [];
  return getTimelineByOwner(lead.workspace_id, "lead", leadId);
}

export async function getTimelineByClientId(clientId: string): Promise<TimelineActivity[]> {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) return [];
  return getTimelineByOwner(client.workspace_id, "client", clientId);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface ClientFilters {
  search?: string;
  status?: ClientStatus | "all";
  source?: string | "all";
  tags?: string[];
  vipOnly?: boolean;
  includeArchived?: boolean;
}

export async function getClients(filters: ClientFilters = {}): Promise<Client[]> {
  await delay(200);
  const { search, status, source, tags, vipOnly, includeArchived = false } = filters;

  return readClients().filter((client) => {
    if (!includeArchived && client.internal_status === "archived") return false;
    if (status && status !== "all" && client.internal_status !== status) return false;
    if (source && source !== "all" && client.source !== source) return false;
    if (vipOnly && !client.is_vip) return false;
    if (tags && tags.length > 0 && !tags.some((tag) => client.tags.includes(tag))) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = `${client.first_name} ${client.last_name} ${client.email} ${client.phone ?? ""} ${client.partner_name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getClientById(id: string): Promise<Client> {
  await delay(150);
  const client = readClients().find((c) => c.id === id);
  if (!client) {
    throw new NotFoundError(`Client ${id} was not found`);
  }
  return client;
}

export async function createClient(input: ClientFormInput): Promise<DataResult<Client>> {
  const parsed = clientDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const timestamp = nowIso();
  const client: Client = {
    id: generateId("client"),
    workspace_id: CURRENT_WORKSPACE_ID,
    originating_lead_id: null,
    ...parsed.data,
    preferred_contact_method: null,
    tags: [],
    internal_status: "active",
    is_returning: false,
    is_vip: false,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeClients([...readClients(), client]);
  recordTimelineActivity(client.workspace_id, "client", client.id, "client_created", "Client created");

  return ok(client);
}

export async function updateClient(
  id: string,
  input: ClientFormInput,
): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const parsed = clientDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: Client = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "client_updated", "Client information updated");

  return ok(updated);
}

export async function updateClientStatus(
  id: string,
  status: ClientStatus,
): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const updated: Client = { ...existing, internal_status: status, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "client",
    id,
    "status_changed",
    `Status changed from ${CLIENT_STATUS_LABELS[existing.internal_status]} to ${CLIENT_STATUS_LABELS[status]}`,
    { from: existing.internal_status, to: status },
  );

  return ok(updated);
}

export async function updateClientTags(id: string, tags: string[]): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const updated: Client = { ...existing, tags, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "tags_changed", "Tags updated", {
    tags: tags.join(", "),
  });

  return ok(updated);
}

export async function setClientVipStatus(
  id: string,
  isVip: boolean,
): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const updated: Client = { ...existing, is_vip: isVip, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "client",
    id,
    "vip_status_changed",
    isVip ? "Marked as VIP" : "Removed VIP status",
  );

  return ok(updated);
}

export async function updateClientContactPreference(
  id: string,
  method: ContactMethod | null,
): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const updated: Client = { ...existing, preferred_contact_method: method, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "client",
    id,
    "communication_preference_changed",
    method
      ? `Preferred contact method set to ${CONTACT_METHOD_LABELS[method]}`
      : "Preferred contact method cleared",
  );

  return ok(updated);
}

export async function archiveClient(id: string): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (existing.archived_at) {
    return fail("This client is already archived.");
  }

  const timestamp = nowIso();
  const updated: Client = {
    ...existing,
    internal_status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "client_archived", "Client archived");

  return ok(updated);
}

export async function restoreClient(id: string): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (!existing.archived_at) {
    return fail("This client is not archived.");
  }

  const updated: Client = {
    ...existing,
    internal_status: "active",
    archived_at: null,
    updated_at: nowIso(),
  };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "client_restored", "Client restored");

  return ok(updated);
}

/** Events doesn't exist yet, so hasRelatedEvent is always false until that module is built. */
export async function getClientNextAction(clientId: string): Promise<string | null> {
  const [client, notes] = await Promise.all([getClientById(clientId), getNotesByClientId(clientId)]);
  return getClientNextRecommendedAction(client, { hasNotes: notes.length > 0, hasRelatedEvent: false });
}

// ---------------------------------------------------------------------------
// Events — the operational center of BloomOS. Every Event belongs to a
// Client (client_id is required; there is no such thing as an ownerless
// Event) and optionally preserves the Lead it originated from.
//
// status and lifecycle_stage are independent state machines (see
// core/workflows/eventWorkflow.ts) — each has its own setter and its own
// timeline activity type, never inferred from the other.
// ---------------------------------------------------------------------------

export interface EventFilters {
  search?: string;
  status?: EventStatus | "all";
  eventType?: EventType | "all";
  priority?: EventPriority | "all";
  clientId?: string;
  includeArchived?: boolean;
}

export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  await delay(200);
  const { search, status, eventType, priority, clientId, includeArchived = false } = filters;

  return readEvents().filter((event) => {
    if (!includeArchived && event.status === "archived") return false;
    if (status && status !== "all" && event.status !== status) return false;
    if (eventType && eventType !== "all" && event.event_type !== eventType) return false;
    if (priority && priority !== "all" && event.priority !== priority) return false;
    if (clientId && event.client_id !== clientId) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = `${event.title} ${event.location_name ?? ""} ${event.city ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getEventById(id: string): Promise<Event> {
  await delay(150);
  const event = readEvents().find((e) => e.id === id);
  if (!event) {
    throw new NotFoundError(`Event ${id} was not found`);
  }
  return event;
}

/**
 * Internal batch initializer for a default checklist template — not
 * exported for UI use (createEvent() is the only caller; test-only access
 * is exported separately at the bottom of this file, same convention as
 * resetAllMockData). Treats populating the template as one atomic
 * initialization operation rather than N independent createChecklistItem
 * calls:
 *
 * 1. validates every template item first (checklistItemSchema) — if any
 *    fails, nothing is written and the function returns fail();
 * 2. only then builds the full ChecklistItem[] and writes it as one batch;
 * 3. records exactly one summarized timeline activity afterward (not one
 *    per item) — an 11-item template would otherwise bury a fresh Event's
 *    timeline in noise a user never asked to see.
 *
 * Manually created checklist items (createChecklistItem, the public
 * function below) are unaffected and continue recording their own
 * individual checklist_item_created activity as before.
 */
async function applyDefaultChecklistTemplate(
  event: Event,
  templateItems: ChecklistItemInput[],
): Promise<DataResult<ChecklistItem[]>> {
  const parsedItems: ChecklistItemInput[] = [];
  for (const templateItem of templateItems) {
    const parsed = checklistItemSchema.safeParse(templateItem);
    if (!parsed.success) {
      return fail(
        "The default checklist template failed validation; no items were created.",
        fieldErrorsFromZod(parsed.error),
      );
    }
    parsedItems.push(parsed.data);
  }

  const timestamp = nowIso();
  const newItems: ChecklistItem[] = parsedItems.map((data, index) => ({
    id: generateId("checklist"),
    workspace_id: event.workspace_id,
    owner_type: "event",
    owner_id: event.id,
    ...data,
    status: "pending",
    completed_at: null,
    sort_order: index,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  writeChecklistItems([...readChecklistItems(), ...newItems]);
  recordTimelineActivity(
    event.workspace_id,
    "event",
    event.id,
    "checklist_template_applied",
    `Default ${EVENT_TYPE_LABELS[event.event_type]} checklist created with ${newItems.length} item${newItems.length === 1 ? "" : "s"}.`,
  );

  return ok(newItems);
}

/**
 * Events can be created from an existing Client or from a converted Lead's
 * Client — either way, the caller passes client_id (and, for the latter,
 * originating_lead_id, typically the Client's own originating_lead_id).
 * client_id is required and must reference a real Client; workspace_id is
 * derived from that Client rather than assumed, so an Event can never be
 * silently created in the wrong workspace.
 */
export async function createEvent(input: EventFormInput): Promise<DataResult<Event>> {
  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  const timestamp = nowIso();
  const event: Event = {
    id: generateId("event"),
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: "draft",
    lifecycle_stage: "intake",
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
    completed_at: null,
    cancelled_at: null,
  };

  writeEvents([...readEvents(), event]);
  recordTimelineActivity(event.workspace_id, "event", event.id, "event_created", "Event created");

  const defaultChecklist = DEFAULT_CHECKLIST_TEMPLATES[event.event_type];
  if (defaultChecklist) {
    await applyDefaultChecklistTemplate(event, defaultChecklist);
  }

  return ok(event);
}

export async function updateEvent(id: string, input: EventFormInput): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }

  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  const updated: Event = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_updated", "Event information updated");

  return ok(updated);
}

export async function updateEventStatus(id: string, status: EventStatus): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionEventStatus(existing.status, status)) {
    return fail(
      `Cannot move an event from "${EVENT_STATUS_LABELS[existing.status]}" to "${EVENT_STATUS_LABELS[status]}".`,
    );
  }

  const updated: Event = { ...existing, status, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "status_changed",
    `Status changed from ${EVENT_STATUS_LABELS[existing.status]} to ${EVENT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

export async function updateEventLifecycleStage(
  id: string,
  stage: EventLifecycleStage,
): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionLifecycleStage(existing.lifecycle_stage, stage)) {
    return fail(
      `Cannot move an event from "${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]}" to "${EVENT_LIFECYCLE_STAGE_LABELS[stage]}".`,
    );
  }

  const updated: Event = { ...existing, lifecycle_stage: stage, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "lifecycle_stage_changed",
    `Lifecycle stage changed from ${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]} to ${EVENT_LIFECYCLE_STAGE_LABELS[stage]}`,
    { from: existing.lifecycle_stage, to: stage },
  );

  return ok(updated);
}

export async function updateEventPriority(
  id: string,
  priority: EventPriority,
): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }

  const updated: Event = { ...existing, priority, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "priority_changed",
    `Priority changed from ${EVENT_PRIORITY_LABELS[existing.priority]} to ${EVENT_PRIORITY_LABELS[priority]}`,
    { from: existing.priority, to: priority },
  );

  return ok(updated);
}

export async function archiveEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status === "archived") {
    return fail("This event is already archived.");
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_archived", "Event archived");

  return ok(updated);
}

/**
 * Restoring returns the Event to "planning" — a reasonable resumption
 * point. The pre-archive status isn't tracked separately (mirrors
 * restoreClient, which always resumes to "active"), so a genuinely
 * different resumption status is a manual updateEventStatus call away.
 */
export async function restoreEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status !== "archived") {
    return fail("This event is not archived.");
  }

  const updated: Event = {
    ...existing,
    status: "planning",
    archived_at: null,
    updated_at: nowIso(),
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_restored", "Event restored");

  return ok(updated);
}

export async function cancelEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`);
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "cancelled",
    cancelled_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_cancelled", "Event cancelled");

  return ok(updated);
}

export async function completeEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be completed.`);
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "completed",
    completed_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_completed", "Event completed");

  return ok(updated);
}

/** No post-event-review entity/module exists yet, so hasPostEventReview is always false until that's built. */
export async function getEventNextAction(eventId: string): Promise<string | null> {
  const [event, checklist, schedule] = await Promise.all([
    getEventById(eventId),
    getChecklistByEventId(eventId),
    getScheduleByEventId(eventId),
  ]);

  const now = Date.now();
  const daysUntilEvent = event.event_date
    ? Math.floor((new Date(event.event_date).getTime() - now) / (1000 * 60 * 60 * 24))
    : null;
  const hasOverdueChecklistItems = checklist.some(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled" &&
      item.due_date !== null &&
      new Date(item.due_date).getTime() < now,
  );

  return getEventNextRecommendedAction(event, {
    hasChecklistItems: checklist.length > 0,
    hasOverdueChecklistItems,
    hasScheduleItems: schedule.length > 0,
    hasPostEventReview: false,
    daysUntilEvent,
  });
}

// ---------------------------------------------------------------------------
// Checklist — reusable across owner types (only "event" is a real owner
// today; see types/checklistItem.ts). Same polymorphic-owner scoping rule
// as Notes/Timeline: every query filters by workspace_id together with
// owner_type/owner_id, never owner_id alone.
// ---------------------------------------------------------------------------

export async function getChecklistByEventId(eventId: string): Promise<ChecklistItem[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  await delay(150);
  return readChecklistItems()
    .filter(
      (item) =>
        item.workspace_id === event.workspace_id &&
        item.owner_type === "event" &&
        item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function createChecklistItem(
  eventId: string,
  input: ChecklistItemInput,
): Promise<DataResult<ChecklistItem>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownItems = readChecklistItems().filter(
    (item) =>
      item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );

  const timestamp = nowIso();
  const item: ChecklistItem = {
    id: generateId("checklist"),
    workspace_id: event.workspace_id,
    owner_type: "event",
    owner_id: eventId,
    ...parsed.data,
    status: "pending",
    completed_at: null,
    sort_order: ownItems.length,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeChecklistItems([...readChecklistItems(), item]);
  recordTimelineActivity(
    event.workspace_id,
    "event",
    eventId,
    "checklist_item_created",
    `Checklist item created: "${item.title}"`,
  );

  return ok(item);
}

export async function updateChecklistItem(
  id: string,
  input: ChecklistItemInput,
): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: ChecklistItem = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));

  return ok(updated);
}

export async function updateChecklistItemStatus(
  id: string,
  status: ChecklistStatus,
): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const updated: ChecklistItem = {
    ...existing,
    status,
    completed_at: status === "completed" ? (existing.completed_at ?? nowIso()) : null,
    updated_at: nowIso(),
  };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));

  return ok(updated);
}

export async function completeChecklistItem(id: string): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("This checklist item is already completed.");
  }

  const timestamp = nowIso();
  const updated: ChecklistItem = {
    ...existing,
    status: "completed",
    completed_at: timestamp,
    updated_at: timestamp,
  };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "checklist_item_completed",
    `Checklist item completed: "${existing.title}"`,
  );

  return ok(updated);
}

/** Refuses to delete a completed checklist item — it's part of the event's completed history, not a mistake to undo. */
export async function deleteChecklistItem(id: string): Promise<DataResult<null>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("Completed checklist items can't be deleted.");
  }

  writeChecklistItems(readChecklistItems().filter((item) => item.id !== id));

  return ok(null);
}

export async function reorderChecklistItems(
  eventId: string,
  orderedIds: string[],
): Promise<DataResult<ChecklistItem[]>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = readChecklistItems().filter(
    (item) =>
      item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's checklist items.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeChecklistItems(
    readChecklistItems().map((item) =>
      order.has(item.id) ? { ...item, sort_order: order.get(item.id) as number, updated_at: timestamp } : item,
    ),
  );

  const updatedItems = readChecklistItems()
    .filter(
      (item) =>
        item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  return ok(updatedItems);
}

// ---------------------------------------------------------------------------
// Schedule — reusable across owner types, generalized the same way as
// Checklist (only "event" is a real owner today; see
// types/eventScheduleItem.ts). Same polymorphic-owner scoping rule as
// Notes/Timeline/Checklist: every query filters by workspace_id together
// with owner_type/owner_id, never owner_id alone.
// ---------------------------------------------------------------------------

async function getScheduleByOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<EventScheduleItem[]> {
  await delay(150);
  return readScheduleItems()
    .filter(
      (item) =>
        item.workspace_id === workspaceId && item.owner_type === ownerType && item.owner_id === ownerId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function createScheduleItemForOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  input: ScheduleItemInput,
): Promise<DataResult<EventScheduleItem>> {
  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownItems = readScheduleItems().filter(
    (item) => item.workspace_id === workspaceId && item.owner_type === ownerType && item.owner_id === ownerId,
  );

  const timestamp = nowIso();
  const item: EventScheduleItem = {
    id: generateId("schedule"),
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    ...parsed.data,
    status: "planned",
    sort_order: ownItems.length,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeScheduleItems([...readScheduleItems(), item]);
  recordTimelineActivity(
    workspaceId,
    ownerType,
    ownerId,
    "schedule_item_created",
    `Schedule item created: "${item.title}"`,
  );

  return ok(item);
}

export async function getScheduleByEventId(eventId: string): Promise<EventScheduleItem[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  return getScheduleByOwner(event.workspace_id, "event", eventId);
}

export async function createScheduleItem(
  eventId: string,
  input: ScheduleItemInput,
): Promise<DataResult<EventScheduleItem>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }
  return createScheduleItemForOwner(event.workspace_id, "event", eventId, input);
}

export async function updateScheduleItem(
  id: string,
  input: ScheduleItemInput,
): Promise<DataResult<EventScheduleItem>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: EventScheduleItem = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeScheduleItems(readScheduleItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item updated: "${updated.title}"`,
  );

  return ok(updated);
}

export async function updateScheduleItemStatus(
  id: string,
  status: ScheduleStatus,
): Promise<DataResult<EventScheduleItem>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const updated: EventScheduleItem = { ...existing, status, updated_at: nowIso() };
  writeScheduleItems(readScheduleItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item status changed to ${SCHEDULE_STATUS_LABELS[status]}: "${existing.title}"`,
  );

  return ok(updated);
}

export async function deleteScheduleItem(id: string): Promise<DataResult<null>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  writeScheduleItems(readScheduleItems().filter((item) => item.id !== id));

  return ok(null);
}

export async function reorderScheduleItems(
  eventId: string,
  orderedIds: string[],
): Promise<DataResult<EventScheduleItem[]>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = readScheduleItems().filter(
    (item) =>
      item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's schedule items.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeScheduleItems(
    readScheduleItems().map((item) =>
      order.has(item.id) ? { ...item, sort_order: order.get(item.id) as number, updated_at: timestamp } : item,
    ),
  );

  const updatedItems = readScheduleItems()
    .filter(
      (item) =>
        item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  return ok(updatedItems);
}

// ---------------------------------------------------------------------------
// Event Notes and Timeline — reuse the shared owner_type/owner_id Notes and
// Timeline architecture (getNotesByOwner/createNoteForOwner/getTimelineByOwner,
// defined above in the Notes/Timeline sections) rather than duplicating it.
// ---------------------------------------------------------------------------

export async function getNotesByEventId(eventId: string): Promise<Note[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  return getNotesByOwner(event.workspace_id, "event", eventId);
}

export async function createEventNote(eventId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }
  return createNoteForOwner(event.workspace_id, "event", eventId, input);
}

export async function getTimelineByEventId(eventId: string): Promise<TimelineActivity[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  return getTimelineByOwner(event.workspace_id, "event", eventId);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardMetric {
  label: string;
  value: string;
  href: string;
}

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  const [leads, clients, events] = await Promise.all([
    getLeads({ includeArchived: true }),
    getClients({ includeArchived: true }),
    getEvents({ includeArchived: true }),
  ]);
  const activeLeads = leads.filter((lead) => lead.status !== "archived");
  const activeClients = clients.filter((client) => client.internal_status === "active");
  const vipClients = clients.filter((client) => client.is_vip);
  const archivedClients = clients.filter((client) => client.internal_status === "archived");

  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const activeEvents = events.filter((event) => event.status !== "archived");
  const upcomingEvents = activeEvents.filter(
    (event) =>
      event.event_date !== null &&
      event.status !== "cancelled" &&
      event.status !== "completed" &&
      new Date(event.event_date).getTime() >= now,
  );
  const eventsThisWeek = upcomingEvents.filter(
    (event) => new Date(event.event_date as string).getTime() - now <= oneWeekMs,
  );
  const eventsAwaitingContract = activeEvents.filter((event) => event.status === "awaiting_contract");
  const eventsAwaitingDeposit = activeEvents.filter((event) => event.status === "awaiting_deposit");
  const eventsInPlanning = activeEvents.filter((event) => event.status === "planning");
  const eventsReady = activeEvents.filter((event) => event.status === "ready");
  const nowDate = new Date();
  const eventsCompletedThisMonth = events.filter(
    (event) =>
      event.status === "completed" &&
      event.completed_at !== null &&
      new Date(event.completed_at).getUTCFullYear() === nowDate.getUTCFullYear() &&
      new Date(event.completed_at).getUTCMonth() === nowDate.getUTCMonth(),
  );
  const criticalEvents = activeEvents.filter((event) => event.priority === "critical");
  const eventOwnedChecklistItems = readChecklistItems().filter((item) => item.owner_type === "event");
  const overdueChecklistItems = eventOwnedChecklistItems.filter(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled" &&
      item.due_date !== null &&
      new Date(item.due_date).getTime() < now,
  );

  const isSameUtcDate = (isoDate: string, reference: Date) => {
    const d = new Date(isoDate);
    return (
      d.getUTCFullYear() === reference.getUTCFullYear() &&
      d.getUTCMonth() === reference.getUTCMonth() &&
      d.getUTCDate() === reference.getUTCDate()
    );
  };
  const nonTerminalActiveEvents = activeEvents.filter(
    (event) => event.event_date !== null && event.status !== "cancelled" && event.status !== "completed",
  );
  const tomorrowDate = new Date(now + 24 * 60 * 60 * 1000);
  const todaysEvents = nonTerminalActiveEvents.filter((event) =>
    isSameUtcDate(event.event_date as string, nowDate),
  );
  const tomorrowsEvents = nonTerminalActiveEvents.filter((event) =>
    isSameUtcDate(event.event_date as string, tomorrowDate),
  );
  const weekendEvents = nonTerminalActiveEvents.filter((event) => {
    const eventDate = new Date(event.event_date as string);
    const diffDays = Math.floor((eventDate.getTime() - now) / (24 * 60 * 60 * 1000));
    if (diffDays < 0 || diffDays > 7) return false;
    const dayOfWeek = eventDate.getUTCDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  });

  const countableChecklistItems = eventOwnedChecklistItems.filter((item) => item.status !== "cancelled");
  const completedChecklistItems = countableChecklistItems.filter((item) => item.status === "completed");
  const checklistCompletionPercent =
    countableChecklistItems.length === 0
      ? null
      : Math.round((completedChecklistItems.length / countableChecklistItems.length) * 100);

  return [
    { label: "Leads", value: String(activeLeads.length), href: "/leads" },
    { label: "Total Clients", value: String(clients.length), href: "/clients" },
    { label: "Active Clients", value: String(activeClients.length), href: "/clients" },
    { label: "VIP Clients", value: String(vipClients.length), href: "/clients" },
    { label: "Archived Clients", value: String(archivedClients.length), href: "/clients" },
    { label: "Upcoming Events", value: String(upcomingEvents.length), href: "/events" },
    { label: "Events This Week", value: String(eventsThisWeek.length), href: "/events" },
    { label: "Events Awaiting Contract", value: String(eventsAwaitingContract.length), href: "/events" },
    { label: "Events Awaiting Deposit", value: String(eventsAwaitingDeposit.length), href: "/events" },
    { label: "Events In Planning", value: String(eventsInPlanning.length), href: "/events" },
    { label: "Events Ready", value: String(eventsReady.length), href: "/events" },
    { label: "Events Completed This Month", value: String(eventsCompletedThisMonth.length), href: "/events" },
    { label: "Critical Events", value: String(criticalEvents.length), href: "/events" },
    { label: "Overdue Checklist Items", value: String(overdueChecklistItems.length), href: "/events" },
    { label: "Today's Events", value: String(todaysEvents.length), href: "/events" },
    { label: "Tomorrow's Events", value: String(tomorrowsEvents.length), href: "/events" },
    { label: "Weekend Events", value: String(weekendEvents.length), href: "/events" },
    {
      label: "Checklist Completion %",
      value: checklistCompletionPercent === null ? "—" : `${checklistCompletionPercent}%`,
      href: "/events",
    },
    // Placeholder — no Weather API integration exists yet (out of scope per this phase's restrictions).
    { label: "Weather Alert", value: "—", href: "/events" },
    // Placeholder — no Team Management / Employee module exists yet to compute real assignment coverage.
    { label: "Assigned Staff %", value: "—", href: "/events" },
    { label: "Contracts", value: "—", href: "/contracts" },
    { label: "Finance", value: "—", href: "/finance" },
  ];
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------

/** Test-only: resets every in-memory mock store to its seeded state. Never call from app code. */
export function resetAllMockData(): void {
  resetLeadsStore();
  resetNotesStore();
  resetTimelineStore();
  resetClientsStore();
  resetEventsStore();
  resetChecklistStore();
  resetScheduleStore();
}

/**
 * Test-only: exercises the internal default-checklist batch initializer
 * directly (e.g. to verify atomicity on a deliberately invalid template).
 * Never imported by UI — createEvent() is the only real caller.
 */
export const __applyDefaultChecklistTemplateForTests = applyDefaultChecklistTemplate;

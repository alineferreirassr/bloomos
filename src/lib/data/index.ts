import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Contract, ContractVersionSnapshot } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { EntityType } from "@/core/enums/entityType";
import type { ContractTemplateCategory } from "@/core/enums/contractTemplateCategory";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { EVENT_TYPE_LABELS, type EventType } from "@/core/enums/eventType";
import type { EventPriority } from "@/core/enums/eventPriority";
import { EVENT_PRIORITY_LABELS } from "@/core/enums/eventPriority";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import {
  canTransitionContractStatus,
  isContractClosed,
  getContractNextRecommendedAction,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from "@/core/workflows/contractWorkflow";
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
import {
  contractSchema,
  contractExhibitSchema,
  type ContractInput,
  type ContractExhibitInput,
} from "@/modules/contracts/schema";
import { computeContractStats } from "@/modules/contracts/contractStats";
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
import {
  readContracts,
  writeContracts,
  resetContractsStore,
} from "@/lib/data/mock/contractsStore";
import {
  readContractTemplates,
  resetContractTemplatesStore,
} from "@/lib/data/mock/contractTemplatesStore";
import {
  readContractExhibits,
  writeContractExhibits,
  resetContractExhibitsStore,
} from "@/lib/data/mock/contractExhibitsStore";

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
  lifecycleStage?: EventLifecycleStage | "all";
  eventType?: EventType | "all";
  priority?: EventPriority | "all";
  clientId?: string;
  /** Inclusive; events with no event_date never match when either bound is set. */
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
}

export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  await delay(200);
  const {
    search,
    status,
    lifecycleStage,
    eventType,
    priority,
    clientId,
    dateFrom,
    dateTo,
    includeArchived = false,
  } = filters;
  const clientsById = new Map(readClients().map((client) => [client.id, client]));

  return readEvents().filter((event) => {
    if (!includeArchived && event.status === "archived") return false;
    if (status && status !== "all" && event.status !== status) return false;
    if (lifecycleStage && lifecycleStage !== "all" && event.lifecycle_stage !== lifecycleStage) return false;
    if (eventType && eventType !== "all" && event.event_type !== eventType) return false;
    if (priority && priority !== "all" && event.priority !== priority) return false;
    if (clientId && event.client_id !== clientId) return false;
    if (dateFrom || dateTo) {
      if (!event.event_date) return false;
      if (dateFrom && event.event_date < dateFrom) return false;
      if (dateTo && event.event_date > dateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(event.client_id);
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
      const haystack = `${event.title} ${clientName} ${event.location_name ?? ""} ${event.city ?? ""}`.toLowerCase();
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
// Contracts — closes the commercial cycle: Lead -> Client -> Event ->
// Contract -> Invoice (future) -> Payments (future). A Contract always
// belongs to a Client; event_id is deliberately optional — a Contract can
// stand on its own (e.g. a retainer) ahead of or without a dedicated Event
// record. Reusable across every Workspace, never designed around a single
// business.
//
// status and signature_status are independent state machines (see
// core/workflows/contractWorkflow.ts) — each has its own setter(s) and its
// own timeline activity types, never inferred from the other.
// ---------------------------------------------------------------------------

export interface ContractFilters {
  search?: string;
  status?: ContractStatus | "all";
  signatureStatus?: SignatureStatus | "all";
  clientId?: string;
  eventId?: string;
  /** Inclusive; contracts with no effective_date never match when either bound is set. */
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  includeArchived?: boolean;
}

export async function getContracts(filters: ContractFilters = {}): Promise<Contract[]> {
  await delay(200);
  const {
    search,
    status,
    signatureStatus,
    clientId,
    eventId,
    effectiveDateFrom,
    effectiveDateTo,
    includeArchived = false,
  } = filters;
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));

  return readContracts().filter((contract) => {
    if (!includeArchived && contract.status === "archived") return false;
    if (status && status !== "all" && contract.status !== status) return false;
    if (signatureStatus && signatureStatus !== "all" && contract.signature_status !== signatureStatus) return false;
    if (clientId && contract.client_id !== clientId) return false;
    if (eventId && contract.event_id !== eventId) return false;
    if (effectiveDateFrom || effectiveDateTo) {
      if (!contract.effective_date) return false;
      if (effectiveDateFrom && contract.effective_date < effectiveDateFrom) return false;
      if (effectiveDateTo && contract.effective_date > effectiveDateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(contract.client_id);
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
      const event = contract.event_id ? eventsById.get(contract.event_id) : undefined;
      const haystack = `${contract.contract_number} ${contract.title} ${clientName} ${event?.title ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getContract(id: string): Promise<Contract> {
  await delay(150);
  const contract = readContracts().find((c) => c.id === id);
  if (!contract) {
    throw new NotFoundError(`Contract ${id} was not found`);
  }
  return contract;
}

/**
 * Workspace-scoped and collision-checked (not just "count + 1") so two
 * contracts can never end up with the same contract_number even if the
 * store is mutated concurrently within a single mock session — the
 * "duplicate prevention" every Contract must satisfy.
 */
function generateContractNumber(workspaceId: string): string {
  const year = new Date().getUTCFullYear();
  const workspaceContracts = readContracts().filter((c) => c.workspace_id === workspaceId);
  const existingNumbers = new Set(workspaceContracts.map((c) => c.contract_number));

  let sequence = workspaceContracts.length + 1;
  let candidate = `CT-${year}-${String(sequence).padStart(4, "0")}`;
  while (existingNumbers.has(candidate)) {
    sequence += 1;
    candidate = `CT-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

function computeRemainingBalance(totalValue: number | null, depositAmount: number | null): number | null {
  if (totalValue === null) return null;
  return totalValue - (depositAmount ?? 0);
}

export async function createContract(input: ContractInput): Promise<DataResult<Contract>> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null && !readContractTemplates().some((t) => t.id === parsed.data.template_id)) {
    return fail("Please select a valid template.", { template_id: "Template not found." });
  }

  const timestamp = nowIso();
  const contract: Contract = {
    id: generateId("contract"),
    workspace_id: client.workspace_id,
    contract_number: generateContractNumber(client.workspace_id),
    ...parsed.data,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContracts([...readContracts(), contract]);
  recordTimelineActivity(
    contract.workspace_id,
    "contract",
    contract.id,
    "contract_created",
    `Contract created: "${contract.title}"`,
  );

  return ok(contract);
}

/**
 * General content edits — title/description/dates/value/deposit/currency/
 * notes/template_id/event_id. Never touches status/signature_status or any
 * of their timestamps; those move only through their own dedicated action
 * below. Every call bumps `version` and appends the pre-update state to
 * `version_history` — the minimal "support multiple versions" the model
 * needs, with no separate versions table.
 */
export async function updateContract(id: string, input: ContractInput): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status === "archived") {
    return fail("This contract is archived and read-only.");
  }

  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("A contract's client can't be changed after creation.", {
      client_id: "Client cannot be changed.",
    });
  }
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (event.client_id !== existing.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null && !readContractTemplates().some((t) => t.id === parsed.data.template_id)) {
    return fail("Please select a valid template.", { template_id: "Template not found." });
  }

  const snapshot: ContractVersionSnapshot = {
    version: existing.version,
    title: existing.title,
    description: existing.description,
    total_value: existing.total_value,
    deposit_amount: existing.deposit_amount,
    recorded_at: nowIso(),
  };

  const updated: Contract = {
    ...existing,
    ...parsed.data,
    version: existing.version + 1,
    version_history: [...existing.version_history, snapshot],
    remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
    updated_at: nowIso(),
  };

  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Contract updated: "${updated.title}"`,
  );

  return ok(updated);
}

/**
 * The plain status setter — legal only among draft/review/ready (see
 * WORKING_CONTRACT_STATUSES in contractWorkflow.ts). sent/viewed/signed/
 * completed/expired/cancelled/archived/declined each have their own
 * dedicated action below instead, so each gets its own specific timeline
 * activity type and timestamp field rather than a generic "status_changed".
 */
export async function updateContractStatus(id: string, status: ContractStatus): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (!canTransitionContractStatus(existing.status, status)) {
    return fail(
      `Cannot move a contract from "${CONTRACT_STATUS_LABELS[existing.status]}" to "${CONTRACT_STATUS_LABELS[status]}".`,
    );
  }

  const updated: Contract = { ...existing, status, updated_at: nowIso() };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Status changed from ${CONTRACT_STATUS_LABELS[existing.status]} to ${CONTRACT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

export async function sendContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "draft" && existing.status !== "review" && existing.status !== "ready") {
    return fail(`Cannot send a contract that is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "sent",
    signature_status: "sent",
    sent_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_sent", `Contract sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed contract keeps its original viewed_at. */
export async function markViewed(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract hasn't been sent yet.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "viewed",
    signature_status: "viewed",
    viewed_at: existing.viewed_at ?? timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_viewed",
    `Contract viewed: "${existing.title}"`,
  );

  return ok(updated);
}

/** Allowed from "sent" directly (a client can sign without a tracked "viewed" step in this mock) or from "viewed". */
export async function markSigned(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract must be sent before it can be signed.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "signed",
    signature_status: "signed",
    signed_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_signed",
    `Contract signed: "${existing.title}"`,
  );

  return ok(updated);
}

export async function markDeclined(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can be declined.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "declined",
    signature_status: "declined",
    declined_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_declined",
    `Contract declined: "${existing.title}"`,
  );

  return ok(updated);
}

/**
 * "expired" has no dedicated timeline activity type of its own (the phase
 * spec's Timeline list doesn't include it) — recorded as "contract_updated"
 * with a description that says so, the same way updateContractStatus's
 * generic moves are recorded.
 */
export async function expireContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can expire.");
  }

  const updated: Contract = {
    ...existing,
    status: "expired",
    signature_status: "expired",
    updated_at: nowIso(),
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Contract expired: "${existing.title}"`,
  );

  return ok(updated);
}

/** Allowed from any non-closed status (draft through signed) — a signed-but-unpaid contract can still be cancelled, unlike a completed one. */
export async function cancelContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (isContractClosed(existing.status)) {
    return fail(
      `This contract is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`,
    );
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "cancelled",
    signature_status: "cancelled",
    cancelled_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_cancelled",
    `Contract cancelled: "${existing.title}"`,
  );

  return ok(updated);
}

/** Only a signed contract can be marked completed — the natural end of the main flow, once nothing further is owed procedurally in this phase (no Invoice/Payments module exists yet). */
export async function completeContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "signed") {
    return fail("Only a signed contract can be marked completed.");
  }

  const updated: Contract = { ...existing, status: "completed", updated_at: nowIso() };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_completed",
    `Contract completed: "${existing.title}"`,
  );

  return ok(updated);
}

export async function archiveContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status === "archived") {
    return fail("This contract is already archived.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_archived", "Contract archived");

  return ok(updated);
}

/**
 * Restoring returns the Contract to "draft" — a reasonable resumption
 * point, same precedent as restoreEvent. The pre-archive status isn't
 * tracked separately, so a restored contract goes through send/view/sign
 * again for a clean audit trail rather than silently resuming mid-flow; a
 * genuinely different resumption status is a manual updateContractStatus
 * (or sendContract, etc.) call away.
 */
export async function restoreContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "archived") {
    return fail("This contract is not archived.");
  }

  const updated: Contract = {
    ...existing,
    status: "draft",
    archived_at: null,
    updated_at: nowIso(),
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_restored", "Contract restored");

  return ok(updated);
}

/**
 * Creates a fresh draft copy of a Contract's content (client, event,
 * template, value, deposit, dates, currency, notes) with a new id and a
 * guaranteed-unique contract_number, resetting status/signature_status/
 * version/version_history and every lifecycle timestamp — e.g. to start a
 * new negotiation round without losing the original's history. Recorded as
 * an ordinary "contract_created" activity (from the new Contract's own
 * perspective, it was created), noting its origin in the description.
 */
export async function duplicateContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }

  const timestamp = nowIso();
  const duplicate: Contract = {
    ...existing,
    id: generateId("contract"),
    contract_number: generateContractNumber(existing.workspace_id),
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContracts([...readContracts(), duplicate]);
  recordTimelineActivity(
    duplicate.workspace_id,
    "contract",
    duplicate.id,
    "contract_created",
    `Contract created (duplicated from ${existing.contract_number})`,
  );

  return ok(duplicate);
}

export async function getContractNextAction(contractId: string): Promise<string | null> {
  const contract = await getContract(contractId);
  return getContractNextRecommendedAction(contract);
}

// ---------------------------------------------------------------------------
// Contract Notes and Timeline — reuse the shared owner_type/owner_id Notes
// and Timeline architecture (getNotesByOwner/createNoteForOwner/
// getTimelineByOwner, defined above in the Notes/Timeline sections) rather
// than a dedicated ContractNote type.
// ---------------------------------------------------------------------------

export async function getNotesByContractId(contractId: string): Promise<Note[]> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return [];
  return getNotesByOwner(contract.workspace_id, "contract", contractId);
}

export async function createContractNote(
  contractId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) {
    return fail("Contract not found.");
  }
  return createNoteForOwner(contract.workspace_id, "contract", contractId, input);
}

export async function getTimelineByContractId(contractId: string): Promise<TimelineActivity[]> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return [];
  return getTimelineByOwner(contract.workspace_id, "contract", contractId);
}

// ---------------------------------------------------------------------------
// Contract Templates — read-only in this phase ("No editor yet"). A
// template is a real, workspace-scoped, reusable entity (not a hardcoded
// per-event-type constant like modules/events/constants/checklistTemplates.ts),
// so it lives in its own mock store rather than a static config file.
// ---------------------------------------------------------------------------

export interface ContractTemplateFilters {
  category?: ContractTemplateCategory | "all";
  activeOnly?: boolean;
}

export async function getContractTemplates(
  filters: ContractTemplateFilters = {},
): Promise<ContractTemplate[]> {
  await delay(150);
  const { category, activeOnly = false } = filters;
  return readContractTemplates().filter((template) => {
    if (activeOnly && !template.active) return false;
    if (category && category !== "all" && template.category !== category) return false;
    return true;
  });
}

export async function getContractTemplateById(id: string): Promise<ContractTemplate> {
  await delay(100);
  const template = readContractTemplates().find((t) => t.id === id);
  if (!template) {
    throw new NotFoundError(`Contract template ${id} was not found`);
  }
  return template;
}

// ---------------------------------------------------------------------------
// Contract Exhibits — no document upload yet (document_id stays null until a
// Documents module exists), but the UI does manage title/description/order.
// Read-only enforcement for locked/closed Contracts happens in the UI layer
// (which knows the Contract's status), the same precedent as
// deleteScheduleItem/deleteChecklistItem having no status check of their
// own — these functions stay generic and reusable.
// ---------------------------------------------------------------------------

export async function getContractExhibitsByContractId(contractId: string): Promise<ContractExhibit[]> {
  await delay(100);
  return readContractExhibits()
    .filter((exhibit) => exhibit.contract_id === contractId)
    .sort((a, b) => a.display_order - b.display_order);
}

export async function createContractExhibit(
  contractId: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) {
    return fail("Contract not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownExhibits = readContractExhibits().filter((e) => e.contract_id === contractId);
  const timestamp = nowIso();
  const exhibit: ContractExhibit = {
    id: generateId("exhibit"),
    contract_id: contractId,
    ...parsed.data,
    display_order: ownExhibits.length,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContractExhibits([...readContractExhibits(), exhibit]);

  return ok(exhibit);
}

export async function updateContractExhibit(
  id: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const existing = readContractExhibits().find((e) => e.id === id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: ContractExhibit = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeContractExhibits(readContractExhibits().map((e) => (e.id === id ? updated : e)));

  return ok(updated);
}

export async function deleteContractExhibit(id: string): Promise<DataResult<null>> {
  const existing = readContractExhibits().find((e) => e.id === id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  writeContractExhibits(readContractExhibits().filter((e) => e.id !== id));

  return ok(null);
}

export async function reorderContractExhibits(
  contractId: string,
  orderedIds: string[],
): Promise<DataResult<ContractExhibit[]>> {
  const ownExhibits = readContractExhibits().filter((e) => e.contract_id === contractId);
  if (orderedIds.length !== ownExhibits.length || !ownExhibits.every((e) => orderedIds.includes(e.id))) {
    return fail("The provided order doesn't match this contract's exhibits.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeContractExhibits(
    readContractExhibits().map((e) =>
      order.has(e.id) ? { ...e, display_order: order.get(e.id) as number, updated_at: timestamp } : e,
    ),
  );

  const updated = readContractExhibits()
    .filter((e) => e.contract_id === contractId)
    .sort((a, b) => a.display_order - b.display_order);

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardMetric {
  label: string;
  value: string;
  href: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  const [leads, clients, events, contracts] = await Promise.all([
    getLeads({ includeArchived: true }),
    getClients({ includeArchived: true }),
    getEvents({ includeArchived: true }),
    getContracts({ includeArchived: true }),
  ]);
  const contractStats = computeContractStats(contracts);
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
    { label: "Total Contracts", value: String(contractStats.total), href: "/contracts" },
    { label: "Draft Contracts", value: String(contractStats.draft), href: "/contracts" },
    { label: "Sent Contracts", value: String(contractStats.sent), href: "/contracts" },
    { label: "Viewed Contracts", value: String(contractStats.viewed), href: "/contracts" },
    { label: "Signed Contracts", value: String(contractStats.signed), href: "/contracts" },
    { label: "Pending Signature", value: String(contractStats.pendingSignature), href: "/contracts" },
    { label: "Expired Contracts", value: String(contractStats.expired), href: "/contracts" },
    { label: "Cancelled Contracts", value: String(contractStats.cancelled), href: "/contracts" },
    { label: "Contract Value", value: formatCurrency(contractStats.contractValue), href: "/contracts" },
    { label: "Deposit Pending", value: formatCurrency(contractStats.depositPending), href: "/contracts" },
    { label: "Completed Value", value: formatCurrency(contractStats.completedValue), href: "/contracts" },
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
  resetContractsStore();
  resetContractTemplatesStore();
  resetContractExhibitsStore();
}

/**
 * Test-only: exercises the internal default-checklist batch initializer
 * directly (e.g. to verify atomicity on a deliberately invalid template).
 * Never imported by UI — createEvent() is the only real caller.
 */
export const __applyDefaultChecklistTemplateForTests = applyDefaultChecklistTemplate;

import type { Lead } from "@/types/lead";
import type { LeadNote } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Client } from "@/types/client";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { NotFoundError } from "@/core/errors";
import { canTransition, isTerminalStatus } from "@/core/workflows/leadWorkflow";
import { leadDataSchema, noteFormSchema, type LeadFormInput, type NoteFormInput } from "@/modules/leads/schema";
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
  resetClientsStore,
} from "@/lib/data/mock/clientsStore";

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
  recordTimelineActivity(lead.id, "lead_created", "Lead created");

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
  recordTimelineActivity(id, "lead_updated", "Lead information updated");

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
  recordTimelineActivity(id, "lead_archived", "Lead archived");

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
// Notes
// ---------------------------------------------------------------------------

export async function getNotesByLeadId(leadId: string): Promise<LeadNote[]> {
  await delay(150);
  return readNotes()
    .filter((note) => note.lead_id === leadId)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
}

export async function createNote(
  leadId: string,
  input: NoteFormInput,
): Promise<DataResult<LeadNote>> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) {
    return fail("Lead not found.");
  }
  if (lead.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }

  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const timestamp = nowIso();
  const note: LeadNote = {
    id: generateId("note"),
    lead_id: leadId,
    ...parsed.data,
    is_pinned: false,
    created_by: CURRENT_ACTOR,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeNotes([...readNotes(), note]);
  recordTimelineActivity(leadId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

export async function togglePinNote(noteId: string): Promise<DataResult<LeadNote>> {
  const existing = readNotes().find((n) => n.id === noteId);
  if (!existing) {
    return fail("Note not found.");
  }
  const lead = readLeads().find((l) => l.id === existing.lead_id);
  if (lead?.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }

  const updated: LeadNote = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.lead_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export async function getTimelineByLeadId(leadId: string): Promise<TimelineActivity[]> {
  await delay(150);
  return readActivities()
    .filter((activity) => activity.lead_id === leadId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------------------------------------------------------------------------
// Clients (minimal — proves the conversion workflow only)
// ---------------------------------------------------------------------------

export async function getClientById(id: string): Promise<Client> {
  await delay(150);
  const client = readClients().find((c) => c.id === id);
  if (!client) {
    throw new NotFoundError(`Client ${id} was not found`);
  }
  return client;
}

export async function getClients(): Promise<Client[]> {
  await delay(150);
  return readClients();
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
  const [leads, clients] = await Promise.all([getLeads({ includeArchived: true }), getClients()]);
  const activeLeads = leads.filter((lead) => lead.status !== "archived");

  return [
    { label: "Leads", value: String(activeLeads.length), href: "/leads" },
    { label: "Clients", value: String(clients.length), href: "/clients" },
    { label: "Events", value: "—", href: "/events" },
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
}

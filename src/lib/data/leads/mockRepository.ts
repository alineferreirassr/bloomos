import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import { NotFoundError } from "@/core/errors";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";
import { canTransition, isTerminalStatus } from "@/core/workflows/leadWorkflow";
import { leadDataSchema, type LeadFormInput } from "@/modules/leads/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readLeads, writeLeads } from "@/lib/data/mock/leadsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type { LeadFilters, LeadsRepository } from "@/lib/data/leads/repository";

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

async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
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

async function getLeadById(id: string): Promise<Lead> {
  await delay(150);
  const lead = readLeads().find((l) => l.id === id);
  if (!lead) {
    throw new NotFoundError(`Lead ${id} was not found`);
  }
  return lead;
}

async function createLead(input: LeadFormInput): Promise<DataResult<Lead>> {
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

async function updateLead(id: string, input: LeadFormInput): Promise<DataResult<Lead>> {
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

async function updateLeadStatus(id: string, status: LeadStatus): Promise<DataResult<Lead>> {
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

async function archiveLead(id: string): Promise<DataResult<Lead>> {
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

async function markWelcomeGuideSent(id: string): Promise<DataResult<Lead>> {
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

async function getNotesByLeadId(leadId: string): Promise<Note[]> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) return [];
  return getNotesByOwner(lead.workspace_id, "lead", leadId);
}

async function createNote(leadId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) {
    return fail("Lead not found.");
  }
  if (lead.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }
  return createNoteForOwner(lead.workspace_id, "lead", leadId, input);
}

async function getTimelineByLeadId(leadId: string) {
  const lead = readLeads().find((l) => l.id === leadId);
  if (!lead) return [];
  return getTimelineByOwner(lead.workspace_id, "lead", leadId);
}

export const mockLeadsRepository: LeadsRepository = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  archiveLead,
  markWelcomeGuideSent,
  getNotesByLeadId,
  createNote,
  getTimelineByLeadId,
};

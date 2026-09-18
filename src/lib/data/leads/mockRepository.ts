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
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type { LeadFilters, LeadsRepository } from "@/lib/data/leads/repository";
import { getFullName } from "@/lib/personName";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { clockNow } from "@/core/time/clock";
import { getLogger } from "@/core/observability/logger";

/**
 * SOCIAL-16D — fire-and-forget `lead.status_changed` dispatch, mirroring
 * `lib/data/index.ts`'s own `dispatchSystemTrigger` pattern exactly. Lives
 * here (not in the thin `lib/data/index.ts` wrapper) because `existing.status`
 * is already in scope at every call site below without a second fetch — the
 * thin wrapper only ever sees the post-mutation `DataResult<Lead>`, which
 * carries no previous-status information. Gated on an actual value change so
 * a same-status rewrite (`markWelcomeGuideSent`'s own no-advance branch)
 * never dispatches a spurious event.
 */
function dispatchLeadStatusChanged(workspaceId: string, leadId: string, previousStatus: LeadStatus, newStatus: LeadStatus): void {
  if (previousStatus === newStatus) return;
  dispatchAutomationTrigger(
    { type: "lead.status_changed", workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts: { leadId, previousStatus, newStatus } },
    { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
  ).catch((error: unknown) => getLogger().error("lead.status_changed trigger dispatch failed", { workspaceId, error: error instanceof Error ? error.message : "Unknown error" }));
}

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
  const { search, status, source, eventType, includeArchived = false, unassignedOnly = false } = filters;

  return readLeads().filter((lead) => {
    if (!includeArchived && lead.status === "archived") return false;
    if (status && status !== "all" && lead.status !== status) return false;
    if (source && source !== "all" && lead.source !== source) return false;
    if (eventType && eventType !== "all" && lead.event_type !== eventType) return false;
    if (unassignedOnly && lead.assigned_to !== null) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = `${getFullName(lead)} ${lead.email ?? ""}`.toLowerCase();
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
    // Every manually-created Lead goes through leadFormSchema, which has no
    // concept of an Instagram external id — always null here; only a future
    // social-write path (not built this checkpoint) would ever set it.
    instagram_external_id: null,
    // SOCIAL-15B — same reasoning: a manually-created Lead has no Social
    // Post/comment/DM to attribute to; only a future SOCIAL-15C capture
    // path would ever set these.
    social_post_id: null,
    instagram_comment_id: null,
    instagram_conversation_id: null,
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
  dispatchLeadStatusChanged(existing.workspace_id, id, existing.status, status);

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
  dispatchLeadStatusChanged(existing.workspace_id, id, existing.status, "archived");

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
  dispatchLeadStatusChanged(existing.workspace_id, id, existing.status, updated.status);

  return ok(updated);
}

async function updateLeadAssignment(workspaceId: string, id: string, assignedTo: string | null): Promise<DataResult<Lead>> {
  const existing = readLeads().find((l) => l.id === id);
  // A lead in another workspace is treated as not found, never a distinct
  // error case — mirrors fetchLeadRow's own established RLS-adjacent
  // discipline in supabaseRepository.ts.
  if (!existing || existing.workspace_id !== workspaceId) {
    return fail("Lead not found.");
  }
  if (existing.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }

  const normalized = assignedTo && assignedTo.trim().length > 0 ? assignedTo.trim() : null;
  const updated: Lead = { ...existing, assigned_to: normalized, updated_at: nowIso() };
  writeLeads(readLeads().map((l) => (l.id === id ? updated : l)));
  recordTimelineActivity(
    existing.workspace_id,
    "lead",
    id,
    "lead_updated",
    normalized ? `Assigned to ${normalized}` : "Unassigned",
    { assigned_to: normalized },
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

async function togglePinNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "lead");
  if (!existing) return null;

  const lead = readLeads().find((l) => l.id === existing.owner_id);
  if (lead?.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }

  const updated: Note = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "lead",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

export const mockLeadsRepository: LeadsRepository = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  updateLeadAssignment,
  archiveLead,
  markWelcomeGuideSent,
  getNotesByLeadId,
  createNote,
  getTimelineByLeadId,
  togglePinNote,
};

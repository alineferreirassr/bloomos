import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";
import { canTransition, isTerminalStatus } from "@/core/workflows/leadWorkflow";
import { leadDataSchema, type LeadFormInput } from "@/modules/leads/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapLeadRow, mapNoteRow, mapTimelineActivityRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { LeadFilters, LeadsRepository } from "@/lib/data/leads/repository";

type SupabaseClient = ReturnType<typeof createClient>;

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

/**
 * Every write needs the current Workspace (to stamp workspace_id) and an
 * actor name (for the timeline entry) — resolved from the real authenticated
 * session, never a client-supplied id. Route protection middleware already
 * keeps signed-out visitors off every /leads route, so hitting either
 * non-"ok" branch here would mean the session expired mid-request; both
 * throw rather than returning a DataResult failure, since this isn't a
 * form-validation/business-rule failure.
 */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  ownerId: string,
  type: TimelineActivityType,
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: "lead",
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence check — returns null rather than throwing, matching the mock's `readLeads().find(...)` pattern. RLS means a lead in another Workspace is simply invisible here, not a distinct error case. */
async function fetchLeadRow(id: string): Promise<Lead | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapLeadRow(data) : null;
}

async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const session = await requireWorkspaceSession();
  const { search, status, source, eventType, includeArchived = false } = filters;

  const supabase = createClient();
  let query = supabase.from("leads").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (source && source !== "all") {
    query = query.eq("source", source);
  }
  if (eventType && eventType !== "all") {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  const leads = (data ?? []).map(mapLeadRow);

  // Matched in application code, not pushed into SQL, so search behaves
  // identically to the mock's substring-over-concatenated-fields match
  // (`${first_name} ${last_name} ${email}`) rather than three independent
  // per-column ILIKE checks, which would miss a combined "first last" query.
  const q = search?.trim().toLowerCase();
  if (!q) return leads;
  return leads.filter((lead) => {
    const haystack = `${lead.first_name} ${lead.last_name} ${lead.email}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getLeadById(id: string): Promise<Lead> {
  const lead = await fetchLeadRow(id);
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

  const session = await requireWorkspaceSession();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      workspace_id: session.workspace.id,
      ...parsed.data,
      status: "new",
      converted_client_id: null,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const lead = mapLeadRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), lead.workspace_id, lead.id, "lead_created", "Lead created");

  return ok(lead);
}

async function updateLead(id: string, input: LeadFormInput): Promise<DataResult<Lead>> {
  const existing = await fetchLeadRow(id);
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

  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const { data, error } = await supabase.from("leads").update(parsed.data).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapLeadRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "lead_updated",
    "Lead information updated",
  );

  return ok(updated);
}

async function updateLeadStatus(id: string, status: LeadStatus): Promise<DataResult<Lead>> {
  const existing = await fetchLeadRow(id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (!canTransition(existing.status, status)) {
    return fail(
      `Cannot move a lead from "${LEAD_STATUS_LABELS[existing.status]}" to "${LEAD_STATUS_LABELS[status]}".`,
    );
  }

  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const { data, error } = await supabase.from("leads").update({ status }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapLeadRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "status_changed",
    `Status changed from ${LEAD_STATUS_LABELS[existing.status]} to ${LEAD_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function archiveLead(id: string): Promise<DataResult<Lead>> {
  const existing = await fetchLeadRow(id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (existing.status === "converted") {
    return fail("This lead was converted to a Client and is read-only.");
  }
  if (existing.status === "archived") {
    return fail("This lead is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapLeadRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "lead_archived", "Lead archived");

  return ok(updated);
}

async function markWelcomeGuideSent(id: string): Promise<DataResult<Lead>> {
  const existing = await fetchLeadRow(id);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (isTerminalStatus(existing.status)) {
    return fail("This lead is read-only and can't be updated.");
  }

  const shouldAdvanceStatus = existing.status === "new" || existing.status === "contacted";
  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .update(shouldAdvanceStatus ? { status: "welcome_guide_sent" as const } : { status: existing.status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapLeadRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "welcome_guide_sent",
    "Welcome Guide marked as sent (mock email service — no real email sent)",
  );

  return ok(updated);
}

async function getNotesByLeadId(leadId: string): Promise<Note[]> {
  const lead = await fetchLeadRow(leadId);
  if (!lead) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", lead.workspace_id)
    .eq("owner_type", "lead")
    .eq("owner_id", leadId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapNoteRow);
}

async function createNote(leadId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const lead = await fetchLeadRow(leadId);
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

  const session = await requireWorkspaceSession();
  const supabase = createClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: lead.workspace_id,
      owner_type: "lead",
      owner_id: leadId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, lead.workspace_id, leadId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function getTimelineByLeadId(leadId: string): Promise<TimelineActivity[]> {
  const lead = await fetchLeadRow(leadId);
  if (!lead) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", lead.workspace_id)
    .eq("owner_type", "lead")
    .eq("owner_id", leadId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapTimelineActivityRow);
}

export const supabaseLeadsRepository: LeadsRepository = {
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

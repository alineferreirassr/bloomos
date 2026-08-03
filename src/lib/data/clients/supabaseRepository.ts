import type { Client } from "@/types/client";
import type { Json } from "@/types/database.types";
import type { Note } from "@/types/note";
import type { PendingRecovery } from "@/types/pendingRecovery";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { getClientNextRecommendedAction } from "@/core/workflows/clientWorkflow";
import { clientDataSchema, type ClientFormInput } from "@/modules/clients/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapClientRow, mapNoteRow, mapTimelineActivityRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { getClientExtensionSummary } from "@/lib/data/clients/extensions";
import { getFullName } from "@/lib/personName";
import { getCoreAuditLogService } from "@/core/audit";
import type {
  ClientFilters,
  ClientsRepository,
  MarkClientRecoveryPendingInput,
} from "@/lib/data/clients/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

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

/** Same rationale as leads/supabaseRepository.ts's requireWorkspaceSession. */
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
    owner_type: "client",
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence check — returns null rather than throwing, matching the mock's `readClients().find(...)` pattern. RLS means a client in another Workspace is simply invisible here, not a distinct error case. */
async function fetchClientRow(id: string): Promise<Client | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapClientRow(data) : null;
}

async function getClients(filters: ClientFilters = {}): Promise<Client[]> {
  const session = await requireWorkspaceSession();
  const { search, status, source, tags, vipOnly, includeArchived = false } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("clients").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) {
    query = query.neq("internal_status", "archived");
  }
  if (status && status !== "all") {
    query = query.eq("internal_status", status);
  }
  if (source && source !== "all") {
    query = query.eq("source", source);
  }
  if (vipOnly) {
    query = query.eq("is_vip", true);
  }
  if (tags && tags.length > 0) {
    query = query.overlaps("tags", tags);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  const clients = (data ?? []).map(mapClientRow);

  // Matched in application code, not pushed into SQL, so search behaves
  // identically to the mock's substring-over-concatenated-fields match.
  const q = search?.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((client) => {
    const haystack = `${getFullName(client)} ${client.email} ${client.phone ?? ""} ${client.partner_name ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getClientById(id: string): Promise<Client> {
  const client = await fetchClientRow(id);
  if (!client) {
    throw new NotFoundError(`Client ${id} was not found`);
  }
  return client;
}

async function createClient(input: ClientFormInput): Promise<DataResult<Client>> {
  const parsed = clientDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: session.workspace.id,
      originating_lead_id: null,
      ...parsed.data,
      preferred_contact_method: null,
      tags: [],
      internal_status: "active",
      is_returning: false,
      is_vip: false,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const client = mapClientRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), client.workspace_id, client.id, "client_created", "Client created");

  return ok(client);
}

async function updateClient(id: string, input: ClientFormInput): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const parsed = clientDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("clients").update(parsed.data).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "client_updated",
    "Client information updated",
  );

  return ok(updated);
}

async function updateClientStatus(id: string, status: ClientStatus): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ internal_status: status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "status_changed",
    `Status changed from ${CLIENT_STATUS_LABELS[existing.internal_status]} to ${CLIENT_STATUS_LABELS[status]}`,
    { from: existing.internal_status, to: status },
  );
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "status_changed",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status },
    after: { internal_status: status },
  });

  return ok(updated);
}

async function updateClientTags(id: string, tags: string[]): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("clients").update({ tags }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "tags_changed", "Tags updated", {
    tags: tags.join(", "),
  });
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "tags_changed",
    ownerType: "client",
    ownerId: id,
    before: { tags: existing.tags },
    after: { tags },
  });

  return ok(updated);
}

async function setClientVipStatus(id: string, isVip: boolean): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ is_vip: isVip })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "vip_status_changed",
    isVip ? "Marked as VIP" : "Removed VIP status",
  );
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "vip_status_changed",
    ownerType: "client",
    ownerId: id,
    before: { is_vip: existing.is_vip },
    after: { is_vip: isVip },
  });

  return ok(updated);
}

async function updateClientContactPreference(
  id: string,
  method: ContactMethod | null,
): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ preferred_contact_method: method })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "communication_preference_changed",
    method
      ? `Preferred contact method set to ${CONTACT_METHOD_LABELS[method]}`
      : "Preferred contact method cleared",
  );
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "communication_preference_changed",
    ownerType: "client",
    ownerId: id,
    before: { preferred_contact_method: existing.preferred_contact_method },
    after: { preferred_contact_method: method },
  });

  return ok(updated);
}

async function archiveClient(id: string): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (existing.archived_at) {
    return fail("This client is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("clients")
    .update({ internal_status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "client_archived", "Client archived");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "client_archived",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status, archived_at: existing.archived_at },
    after: { internal_status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

async function restoreClient(id: string): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (!existing.archived_at) {
    return fail("This client is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ internal_status: "active", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "client_restored", "Client restored");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: resolveActorName(session),
    action: "client_restored",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status, archived_at: existing.archived_at },
    after: { internal_status: "active", archived_at: null },
  });

  return ok(updated);
}

async function getNotesByClientId(clientId: string): Promise<Note[]> {
  const client = await fetchClientRow(clientId);
  if (!client) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", client.workspace_id)
    .eq("owner_type", "client")
    .eq("owner_id", clientId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapNoteRow);
}

async function createClientNote(clientId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const client = await fetchClientRow(clientId);
  if (!client) {
    return fail("Client not found.");
  }

  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: client.workspace_id,
      owner_type: "client",
      owner_id: clientId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, client.workspace_id, clientId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function togglePinClientNote(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("owner_type", "client")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("owner_type", "client")
    .eq("owner_id", note.owner_id)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    note.workspace_id,
    note.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

async function getTimelineByClientId(clientId: string): Promise<TimelineActivity[]> {
  const client = await fetchClientRow(clientId);
  if (!client) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", client.workspace_id)
    .eq("owner_type", "client")
    .eq("owner_id", clientId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapTimelineActivityRow);
}

/** Events doesn't exist yet, so hasRelatedEvent is always false until that module is built. */
async function getClientNextAction(clientId: string): Promise<string | null> {
  const [client, notes] = await Promise.all([getClientById(clientId), getNotesByClientId(clientId)]);
  return getClientNextRecommendedAction(client, { hasNotes: notes.length > 0, hasRelatedEvent: false });
}

async function markClientRecoveryPending(
  id: string,
  input: MarkClientRecoveryPendingInput,
): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const previous = existing.pending_recovery;
  const pending: PendingRecovery = {
    version: 1,
    workflow: input.workflow,
    status: "pending",
    reason: input.reason,
    payload: input.payload,
    attempts: previous && previous.workflow === input.workflow ? previous.attempts + 1 : 1,
    first_attempt_at: previous && previous.workflow === input.workflow ? previous.first_attempt_at : timestamp,
    last_attempt_at: timestamp,
  };

  const { data, error } = await supabase
    .from("clients")
    .update({ pending_recovery: pending as unknown as Json })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "client_recovery_pending",
    `Recovery pending: ${input.reason}`,
    { workflow: input.workflow, severity: "critical", attempts: pending.attempts },
  );

  return ok(updated);
}

async function resolveClientRecoveryPending(id: string): Promise<DataResult<Client>> {
  const existing = await fetchClientRow(id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (!existing.pending_recovery) {
    return fail("This client has no pending recovery to resolve.");
  }
  const { workflow, attempts } = existing.pending_recovery;

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ pending_recovery: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapClientRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "client_recovery_resolved",
    "Recovery resolved",
    { workflow, attempts },
  );

  return ok(updated);
}

async function getClientsWithPendingRecovery(workflow?: string): Promise<Client[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  let query = supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .not("pending_recovery", "is", null);
  if (workflow) {
    query = query.eq("pending_recovery->>workflow", workflow);
  }

  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapClientRow);
}

export const supabaseClientsRepository: ClientsRepository = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  updateClientStatus,
  updateClientTags,
  setClientVipStatus,
  updateClientContactPreference,
  archiveClient,
  restoreClient,
  getClientNextAction,
  getNotesByClientId,
  createClientNote,
  togglePinClientNote,
  getTimelineByClientId,
  markClientRecoveryPending,
  resolveClientRecoveryPending,
  getClientsWithPendingRecovery,
  getClientExtensionSummary,
};

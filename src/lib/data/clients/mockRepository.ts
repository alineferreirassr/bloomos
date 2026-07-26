import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import type { PendingRecovery } from "@/types/pendingRecovery";
import { NotFoundError } from "@/core/errors";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { getClientNextRecommendedAction } from "@/core/workflows/clientWorkflow";
import { clientDataSchema, type ClientFormInput } from "@/modules/clients/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { getCoreAuditLogService } from "@/core/audit";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readClients, writeClients } from "@/lib/data/mock/clientsStore";
import { getFullName } from "@/lib/personName";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import { getClientExtensionSummary } from "@/lib/data/clients/extensions";
import type {
  ClientFilters,
  ClientsRepository,
  MarkClientRecoveryPendingInput,
} from "@/lib/data/clients/repository";

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

async function getClients(filters: ClientFilters = {}): Promise<Client[]> {
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
      const haystack = `${getFullName(client)} ${client.email} ${client.phone ?? ""} ${client.partner_name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

async function getClientById(id: string): Promise<Client> {
  await delay(150);
  const client = readClients().find((c) => c.id === id);
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
    pending_recovery: null,
  };

  writeClients([...readClients(), client]);
  recordTimelineActivity(client.workspace_id, "client", client.id, "client_created", "Client created");

  return ok(client);
}

async function updateClient(id: string, input: ClientFormInput): Promise<DataResult<Client>> {
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

async function updateClientStatus(id: string, status: ClientStatus): Promise<DataResult<Client>> {
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
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "status_changed",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status },
    after: { internal_status: status },
  });

  return ok(updated);
}

async function updateClientTags(id: string, tags: string[]): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const updated: Client = { ...existing, tags, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "tags_changed", "Tags updated", {
    tags: tags.join(", "),
  });
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "tags_changed",
    ownerType: "client",
    ownerId: id,
    before: { tags: existing.tags },
    after: { tags },
  });

  return ok(updated);
}

async function setClientVipStatus(id: string, isVip: boolean): Promise<DataResult<Client>> {
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
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
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
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "communication_preference_changed",
    ownerType: "client",
    ownerId: id,
    before: { preferred_contact_method: existing.preferred_contact_method },
    after: { preferred_contact_method: method },
  });

  return ok(updated);
}

async function archiveClient(id: string): Promise<DataResult<Client>> {
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
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "client_archived",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status, archived_at: existing.archived_at },
    after: { internal_status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

async function restoreClient(id: string): Promise<DataResult<Client>> {
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
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "client_restored",
    ownerType: "client",
    ownerId: id,
    before: { internal_status: existing.internal_status, archived_at: existing.archived_at },
    after: { internal_status: "active", archived_at: null },
  });

  return ok(updated);
}

async function getNotesByClientId(clientId: string): Promise<Note[]> {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) return [];
  return getNotesByOwner(client.workspace_id, "client", clientId);
}

/** Events doesn't exist yet, so hasRelatedEvent is always false until that module is built. */
async function getClientNextAction(clientId: string): Promise<string | null> {
  const [client, notes] = await Promise.all([getClientById(clientId), getNotesByClientId(clientId)]);
  return getClientNextRecommendedAction(client, { hasNotes: notes.length > 0, hasRelatedEvent: false });
}

async function createClientNote(clientId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) {
    return fail("Client not found.");
  }
  return createNoteForOwner(client.workspace_id, "client", clientId, input);
}

async function togglePinClientNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "client");
  if (!existing) return null;

  const updated: Note = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "client",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByClientId(clientId: string) {
  const client = readClients().find((c) => c.id === clientId);
  if (!client) return [];
  return getTimelineByOwner(client.workspace_id, "client", clientId);
}

async function markClientRecoveryPending(
  id: string,
  input: MarkClientRecoveryPendingInput,
): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }

  const timestamp = nowIso();
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

  const updated: Client = { ...existing, pending_recovery: pending, updated_at: timestamp };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "client",
    id,
    "client_recovery_pending",
    `Recovery pending: ${input.reason}`,
    { workflow: input.workflow, severity: "critical", attempts: pending.attempts },
  );

  return ok(updated);
}

async function resolveClientRecoveryPending(id: string): Promise<DataResult<Client>> {
  const existing = readClients().find((c) => c.id === id);
  if (!existing) {
    return fail("Client not found.");
  }
  if (!existing.pending_recovery) {
    return fail("This client has no pending recovery to resolve.");
  }

  const { workflow, attempts } = existing.pending_recovery;
  const updated: Client = { ...existing, pending_recovery: null, updated_at: nowIso() };
  writeClients(readClients().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "client", id, "client_recovery_resolved", "Recovery resolved", {
    workflow,
    attempts,
  });

  return ok(updated);
}

async function getClientsWithPendingRecovery(workflow?: string): Promise<Client[]> {
  return readClients().filter(
    (c) => c.workspace_id === CURRENT_WORKSPACE_ID && c.pending_recovery !== null && (!workflow || c.pending_recovery.workflow === workflow),
  );
}

export const mockClientsRepository: ClientsRepository = {
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

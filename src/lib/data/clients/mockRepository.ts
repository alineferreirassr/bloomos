import type { Client } from "@/types/client";
import type { Note } from "@/types/note";
import { NotFoundError } from "@/core/errors";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/core/enums/contactMethod";
import { getClientNextRecommendedAction } from "@/core/workflows/clientWorkflow";
import { clientDataSchema, type ClientFormInput } from "@/modules/clients/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readClients, writeClients } from "@/lib/data/mock/clientsStore";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type { ClientFilters, ClientsRepository } from "@/lib/data/clients/repository";

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
      const haystack = `${client.first_name} ${client.last_name} ${client.email} ${client.phone ?? ""} ${client.partner_name ?? ""}`.toLowerCase();
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
};

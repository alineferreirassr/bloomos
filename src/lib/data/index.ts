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
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { EntityType } from "@/core/enums/entityType";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { ContractTemplateCategory } from "@/core/enums/contractTemplateCategory";
import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentMethod } from "@/core/enums/paymentMethod";
import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
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
import {
  canTransitionInvoiceStatus,
  isInvoiceTerminal,
  getInvoiceNextRecommendedAction,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/core/workflows/invoiceWorkflow";
import {
  canTransitionPaymentStatus,
  isPaymentFinal,
  isPaymentRefundable,
  getPaymentNextRecommendedAction,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/core/workflows/paymentWorkflow";
import {
  canTransitionExpenseStatus,
  isExpenseTerminal,
  getExpenseNextRecommendedAction,
  EXPENSE_STATUS_LABELS,
  type ExpenseStatus,
} from "@/core/workflows/expenseWorkflow";
import {
  canTransitionDocumentStatus,
  getDocumentNextRecommendedAction,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/core/workflows/documentWorkflow";
import { canMoveFolder, getFolderPath, getFolderChildren } from "@/core/workflows/documentFolderWorkflow";
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
import {
  invoiceSchema,
  paymentSchema,
  expenseSchema,
  type InvoiceInput,
  type PaymentInput,
  type ExpenseInput,
} from "@/modules/finance/schema";
import {
  documentMetadataInputSchema,
  newDocumentVersionInputSchema,
  documentFolderInputSchema,
  VALID_DOCUMENT_OWNER_TYPES,
  type DocumentMetadataInput,
  type NewDocumentVersionInput,
  type DocumentFolderInput,
} from "@/modules/documents/schema";
import {
  computeDocumentOwnerSummary,
  computeDocumentWorkspaceSummary,
  type DocumentOwnerSummary,
  type DocumentWorkspaceSummary,
} from "@/modules/documents/documentStats";
import { DOCUMENT_FOLDER_TEMPLATES, type FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";
import {
  normalizeFileName,
  extractFileExtension,
  generateStoragePath,
  generateDocumentTitle,
  calculateMockChecksum,
} from "@/lib/documentFile";
import {
  computeEventFinancialSummary,
  computeWorkspaceFinancialSummary,
  computeAllTimeFinancialTotals,
  type EventFinancialSummary,
  type WorkspaceFinancialSummary,
} from "@/modules/finance/financialSummary";
import {
  getEventFinancialStatus as deriveEventFinancialStatus,
  type EventFinancialStatus,
} from "@/modules/finance/eventFinancialStatus";
import { calculateBalance, subtractMinor, addMinor, sumMinor, majorToMinor, formatMoney } from "@/lib/money";
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
import {
  readInvoices,
  writeInvoices,
  resetInvoicesStore,
} from "@/lib/data/mock/invoicesStore";
import {
  readPayments,
  writePayments,
  resetPaymentsStore,
} from "@/lib/data/mock/paymentsStore";
import {
  readExpenses,
  writeExpenses,
  resetExpensesStore,
} from "@/lib/data/mock/expensesStore";
import {
  readDocuments,
  writeDocuments,
  resetDocumentsStore,
} from "@/lib/data/mock/documentsStore";
import {
  readDocumentFolders,
  writeDocumentFolders,
  resetDocumentFoldersStore,
} from "@/lib/data/mock/documentFoldersStore";

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
// Finance — continues the commercial cycle Contract closes: Lead -> Client ->
// Event -> Contract -> Invoice -> Payments -> Expenses -> Profit. Every
// money field across Invoice/Payment/Expense is an integer minor-unit
// amount (see lib/money.ts) — Contract.total_value/deposit_amount predate
// this model and remain plain major-unit numbers; Finance summaries convert
// through contractMoneyToMinor (modules/finance/financialSummary.ts) rather
// than assuming Contract is already minor-unit.
//
// Invoice has no plain status setter (unlike Contract/Event) — every
// non-draft status is reached through its own dedicated action below or
// automatically when a successful Payment is applied (applyPaymentToInvoice
// internal helper). Payment/Expense each have their own independent state
// machine (core/workflows/paymentWorkflow.ts / expenseWorkflow.ts).
// ---------------------------------------------------------------------------

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  eventId?: string;
  contractId?: string;
  /** Inclusive; invoices with no issue_date never match when either bound is set. */
  issueDateFrom?: string;
  issueDateTo?: string;
  /** Inclusive; invoices with no due_date never match when either bound is set. */
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
  includeArchived?: boolean;
}

export async function getInvoices(filters: InvoiceFilters = {}): Promise<Invoice[]> {
  await delay(200);
  const {
    search,
    status,
    clientId,
    eventId,
    contractId,
    issueDateFrom,
    issueDateTo,
    dueDateFrom,
    dueDateTo,
    overdueOnly = false,
    includeArchived = false,
  } = filters;
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));
  const contractsById = new Map(readContracts().map((contract) => [contract.id, contract]));

  return readInvoices().filter((invoice) => {
    if (!includeArchived && invoice.status === "archived") return false;
    if (status && status !== "all" && invoice.status !== status) return false;
    if (overdueOnly && invoice.status !== "overdue") return false;
    if (clientId && invoice.client_id !== clientId) return false;
    if (eventId && invoice.event_id !== eventId) return false;
    if (contractId && invoice.contract_id !== contractId) return false;
    if (issueDateFrom || issueDateTo) {
      if (!invoice.issue_date) return false;
      if (issueDateFrom && invoice.issue_date < issueDateFrom) return false;
      if (issueDateTo && invoice.issue_date > issueDateTo) return false;
    }
    if (dueDateFrom || dueDateTo) {
      if (!invoice.due_date) return false;
      if (dueDateFrom && invoice.due_date < dueDateFrom) return false;
      if (dueDateTo && invoice.due_date > dueDateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(invoice.client_id);
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
      const event = invoice.event_id ? eventsById.get(invoice.event_id) : undefined;
      const contract = invoice.contract_id ? contractsById.get(invoice.contract_id) : undefined;
      const haystack = `${invoice.invoice_number} ${invoice.title} ${clientName} ${event?.title ?? ""} ${contract?.contract_number ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  await delay(150);
  const invoice = readInvoices().find((i) => i.id === id);
  if (!invoice) {
    throw new NotFoundError(`Invoice ${id} was not found`);
  }
  return invoice;
}

/** Workspace-scoped and collision-checked, same precedent as generateContractNumber. */
function generateInvoiceNumber(workspaceId: string): string {
  const year = new Date().getUTCFullYear();
  const workspaceInvoices = readInvoices().filter((i) => i.workspace_id === workspaceId);
  const existingNumbers = new Set(workspaceInvoices.map((i) => i.invoice_number));

  let sequence = workspaceInvoices.length + 1;
  let candidate = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  while (existingNumbers.has(candidate)) {
    sequence += 1;
    candidate = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

function computeInvoiceTotal(subtotalMinor: number, taxMinor: number, discountMinor: number): number {
  return subtractMinor(addMinor(subtotalMinor, taxMinor), discountMinor);
}

/**
 * Shared Client/Event/Contract consistency check for createInvoice/
 * createPayment/createExpense/updateInvoice — every one of these needs the
 * same "does the linked Event/Contract actually belong to the same Client"
 * rule; centralized here so it's checked identically everywhere rather than
 * re-implemented per function.
 */
function validateEventBelongsToClient(eventId: string, clientId: string): string | null {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return "Event not found.";
  if (event.client_id !== clientId) return "The selected event doesn't belong to this client.";
  return null;
}

function validateContractBelongsToClient(contractId: string, clientId: string): string | null {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return "Contract not found.";
  if (contract.client_id !== clientId) return "The selected contract doesn't belong to this client.";
  return null;
}

export async function createInvoice(input: InvoiceInput): Promise<DataResult<Invoice>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const timestamp = nowIso();
  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);
  const invoice: Invoice = {
    id: generateId("invoice"),
    workspace_id: client.workspace_id,
    invoice_number: generateInvoiceNumber(client.workspace_id),
    ...parsed.data,
    status: "draft",
    total_minor,
    paid_minor: 0,
    balance_minor: total_minor,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeInvoices([...readInvoices(), invoice]);
  recordTimelineActivity(
    invoice.workspace_id,
    "invoice",
    invoice.id,
    "invoice_created",
    `Invoice created: "${invoice.title}"`,
  );

  return ok(invoice);
}

/** General content edits — never touches status or any lifecycle timestamp; those move only through their own dedicated action below or automatically via a Payment application. */
export async function updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (isInvoiceTerminal(existing.status)) {
    return fail(`This invoice is ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("An invoice's client can't be changed after creation.", { client_id: "Client cannot be changed." });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);
  const updated: Invoice = {
    ...existing,
    ...parsed.data,
    total_minor,
    balance_minor: calculateBalance(total_minor, existing.paid_minor),
    updated_at: nowIso(),
  };

  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(
    existing.workspace_id,
    "invoice",
    id,
    "invoice_updated",
    `Invoice updated: "${updated.title}"`,
  );

  return ok(updated);
}

export async function issueInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "issued")) {
    return fail(`Cannot issue an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = {
    ...existing,
    status: "issued",
    issue_date: existing.issue_date ?? timestamp.slice(0, 10),
    updated_at: timestamp,
  };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_issued", `Invoice issued: "${existing.title}"`);

  return ok(updated);
}

export async function sendInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "sent")) {
    return fail(`Cannot send an invoice that is ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}. Issue it first.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "sent", sent_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_sent", `Invoice sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed invoice keeps its original viewed_at, same precedent as markViewed (Contract). */
export async function markInvoiceViewed(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "viewed") {
    return ok(existing);
  }
  if (!canTransitionInvoiceStatus(existing.status, "viewed")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as viewed.`);
  }

  const updated: Invoice = { ...existing, status: "viewed", viewed_at: nowIso(), updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_viewed", `Invoice viewed: "${existing.title}"`);

  return ok(updated);
}

export async function markInvoiceOverdue(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.due_date === null) {
    return fail("This invoice has no due date to be overdue against.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "overdue")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as overdue.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "overdue", overdue_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_overdue", `Invoice overdue: "${existing.title}"`);

  return ok(updated);
}

export async function voidInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "voided")) {
    return fail(`Cannot void an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "voided", voided_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_voided", `Invoice voided: "${existing.title}"`);

  return ok(updated);
}

export async function archiveInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "archived") {
    return fail("This invoice is already archived.");
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_archived", "Invoice archived");

  return ok(updated);
}

/** Restoring returns the Invoice to "draft" — the same "reasonable resumption point" precedent as restoreContract. */
export async function restoreInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status !== "archived") {
    return fail("This invoice is not archived.");
  }

  const updated: Invoice = { ...existing, status: "draft", archived_at: null, updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_restored", "Invoice restored");

  return ok(updated);
}

/** Fresh draft copy of an Invoice's content with a new id/invoice_number, resetting status/paid_minor/balance_minor and every lifecycle timestamp — mirrors duplicateContract. */
export async function duplicateInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }

  const timestamp = nowIso();
  const duplicate: Invoice = {
    ...existing,
    id: generateId("invoice"),
    invoice_number: generateInvoiceNumber(existing.workspace_id),
    status: "draft",
    issue_date: null,
    due_date: null,
    paid_minor: 0,
    balance_minor: existing.total_minor,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeInvoices([...readInvoices(), duplicate]);
  recordTimelineActivity(
    duplicate.workspace_id,
    "invoice",
    duplicate.id,
    "invoice_created",
    `Invoice created (duplicated from ${existing.invoice_number})`,
  );

  return ok(duplicate);
}

export async function getInvoiceNextAction(invoiceId: string): Promise<string | null> {
  const invoice = await getInvoiceById(invoiceId);
  return getInvoiceNextRecommendedAction(invoice);
}

/**
 * Recomputes an Invoice's paid_minor/balance_minor/status from scratch by
 * summing every linked Payment that currently counts toward paid (net of
 * refunds), rather than incrementing in place — avoids double-counting bugs
 * across repeated Payment mutations. Only recomputes status while the
 * Invoice is in an active, payment-aware state (sent/viewed/partially_paid/
 * paid/overdue); a draft/issued/voided/archived Invoice's status is left
 * alone even if a Payment happens to reference it. Internal — never called
 * by UI directly, only by createPayment/markPaymentSucceeded/refundPayment
 * below, each of which records the resulting invoice_partially_paid/
 * invoice_paid timeline entry itself by comparing old vs new status.
 */
function applyPaymentToInvoice(invoiceId: string): Invoice | null {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return null;

  const linked = readPayments().filter((p) => p.invoice_id === invoiceId);
  const grossPaid = sumMinor(
    linked.filter((p) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status) && p.payment_type !== "refund").map((p) => p.amount_minor),
  );
  const refunded = sumMinor(
    linked.filter((p) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status) && p.payment_type === "refund").map((p) => p.amount_minor),
  );
  const paid_minor = Math.max(0, subtractMinor(grossPaid, refunded));
  const balance_minor = calculateBalance(invoice.total_minor, paid_minor);

  const PAYMENT_AWARE_STATUSES: InvoiceStatus[] = ["sent", "viewed", "partially_paid", "paid", "overdue"];
  let status = invoice.status;
  let paid_at = invoice.paid_at;
  if (PAYMENT_AWARE_STATUSES.includes(invoice.status)) {
    if (paid_minor > 0 && balance_minor === 0) {
      status = "paid";
      paid_at = paid_at ?? nowIso();
    } else if (paid_minor > 0) {
      status = "partially_paid";
    }
  }

  const updated: Invoice = { ...invoice, paid_minor, balance_minor, status, paid_at, updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === invoiceId ? updated : i)));

  if (status !== invoice.status) {
    if (status === "paid") {
      recordTimelineActivity(updated.workspace_id, "invoice", invoiceId, "invoice_paid", `Invoice paid in full: "${updated.title}"`);
    } else if (status === "partially_paid") {
      recordTimelineActivity(
        updated.workspace_id,
        "invoice",
        invoiceId,
        "invoice_partially_paid",
        `Invoice partially paid: "${updated.title}"`,
      );
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentFilters {
  search?: string;
  status?: PaymentStatus | "all";
  paymentType?: PaymentType | "all";
  paymentMethod?: PaymentMethod | "all";
  clientId?: string;
  eventId?: string;
  invoiceId?: string;
  contractId?: string;
  /** Inclusive; matches against transaction_date. */
  dateFrom?: string;
  dateTo?: string;
  refundsOnly?: boolean;
}

export async function getPayments(filters: PaymentFilters = {}): Promise<Payment[]> {
  await delay(200);
  const {
    search,
    status,
    paymentType,
    paymentMethod,
    clientId,
    eventId,
    invoiceId,
    contractId,
    dateFrom,
    dateTo,
    refundsOnly = false,
  } = filters;
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));

  return readPayments().filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false;
    if (paymentType && paymentType !== "all" && payment.payment_type !== paymentType) return false;
    if (paymentMethod && paymentMethod !== "all" && payment.payment_method !== paymentMethod) return false;
    if (refundsOnly && payment.payment_type !== "refund") return false;
    if (clientId && payment.client_id !== clientId) return false;
    if (eventId && payment.event_id !== eventId) return false;
    if (invoiceId && payment.invoice_id !== invoiceId) return false;
    if (contractId && payment.contract_id !== contractId) return false;
    if (dateFrom && payment.transaction_date < dateFrom) return false;
    if (dateTo && payment.transaction_date > dateTo) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(payment.client_id);
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
      const event = payment.event_id ? eventsById.get(payment.event_id) : undefined;
      const haystack = `${clientName} ${event?.title ?? ""} ${payment.reference ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getPaymentById(id: string): Promise<Payment> {
  await delay(150);
  const payment = readPayments().find((p) => p.id === id);
  if (!payment) {
    throw new NotFoundError(`Payment ${id} was not found`);
  }
  return payment;
}

/**
 * Methods with no real payment-provider integration (cash handed over,
 * checks deposited, transfers confirmed by bank statement, peer-to-peer
 * apps) are recorded as already succeeded — there is no provider round trip
 * to await. Card/wallet-style methods that would normally clear through a
 * provider start pending until markPaymentSucceeded/markPaymentFailed is
 * called, simulating that round trip with no provider actually connected.
 */
const IMMEDIATELY_SUCCEEDED_METHODS = new Set(["cash", "check", "bank_transfer", "ach", "zelle", "venmo"]);

export async function createPayment(input: PaymentInput): Promise<DataResult<Payment>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }
  let invoice: Invoice | undefined;
  if (parsed.data.invoice_id !== null) {
    invoice = readInvoices().find((i) => i.id === parsed.data.invoice_id);
    if (!invoice) {
      return fail("Please select a valid invoice.", { invoice_id: "Invoice not found." });
    }
    if (invoice.client_id !== parsed.data.client_id || invoice.workspace_id !== client.workspace_id) {
      return fail("The selected invoice doesn't belong to this client.", {
        invoice_id: "Invoice belongs to a different client.",
      });
    }
  }

  const timestamp = nowIso();
  const initialStatus: PaymentStatus = IMMEDIATELY_SUCCEEDED_METHODS.has(parsed.data.payment_method)
    ? "succeeded"
    : "pending";

  // No overpayment: a Payment that counts toward paid immediately (a
  // non-refund type starting "succeeded") can never exceed what's actually
  // still owed on its Invoice. Refund-type Payments are exempt — they
  // reduce paid_minor, they can't cause an overpayment. A Payment that
  // starts "pending"/"processing" is re-checked against the Invoice's
  // then-current balance when it's later marked succeeded (markPaymentSucceeded).
  if (invoice && initialStatus === "succeeded" && parsed.data.payment_type !== "refund") {
    if (parsed.data.amount_minor > invoice.balance_minor) {
      return fail(
        `This payment (${parsed.data.amount_minor} minor units) would exceed the invoice's remaining balance (${invoice.balance_minor} minor units).`,
        { amount_minor: "Amount exceeds the remaining balance." },
      );
    }
  }
  const payment: Payment = {
    id: generateId("payment"),
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: initialStatus,
    received_at: initialStatus === "succeeded" ? timestamp : null,
    failed_at: null,
    refunded_at: null,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writePayments([...readPayments(), payment]);
  recordTimelineActivity(
    payment.workspace_id,
    "payment",
    payment.id,
    "payment_created",
    `Payment created: ${PAYMENT_STATUS_LABELS[initialStatus]}`,
  );

  if (initialStatus === "succeeded" && invoice) {
    applyPaymentToInvoice(invoice.id);
  }

  return ok(payment);
}

/**
 * General content edits — payment_type/amount/method/reference/
 * transaction_date/notes/event_id/contract_id. Never changes client_id or
 * invoice_id (mirrors updateContract/updateInvoice's "the owner can't
 * change after creation" rule) and is blocked once the Payment is final
 * (isPaymentFinal). No dedicated "payment_updated" timeline type exists —
 * unlike Invoice/Expense, the phase spec's Payment timeline list is only
 * created/processing/succeeded/failed/refunded/cancelled, so a plain
 * content edit intentionally records nothing.
 */
export async function updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (isPaymentFinal(existing.status)) {
    return fail(`This payment is ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("A payment's client can't be changed after creation.", { client_id: "Client cannot be changed." });
  }
  if (parsed.data.invoice_id !== existing.invoice_id) {
    return fail("A payment's linked invoice can't be changed after creation.", {
      invoice_id: "Invoice cannot be changed.",
    });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const updated: Payment = { ...existing, ...parsed.data, updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));

  if (updated.invoice_id && updated.status === "succeeded" && updated.amount_minor !== existing.amount_minor) {
    applyPaymentToInvoice(updated.invoice_id);
  }

  return ok(updated);
}

export async function markPaymentProcessing(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "processing")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as processing.`);
  }

  const updated: Payment = { ...existing, status: "processing", updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_processing", "Payment processing");

  return ok(updated);
}

export async function markPaymentSucceeded(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "succeeded")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as succeeded.`);
  }
  // No overpayment: re-checked here (not just at createPayment) because a
  // pending/processing Payment can sit for a while — the Invoice's balance
  // may have shrunk (another Payment applied) by the time this one succeeds.
  if (existing.invoice_id && existing.payment_type !== "refund") {
    const linkedInvoice = readInvoices().find((i) => i.id === existing.invoice_id);
    if (linkedInvoice && existing.amount_minor > linkedInvoice.balance_minor) {
      return fail(
        `This payment (${existing.amount_minor} minor units) would exceed the invoice's remaining balance (${linkedInvoice.balance_minor} minor units).`,
      );
    }
  }

  const timestamp = nowIso();
  const updated: Payment = { ...existing, status: "succeeded", received_at: timestamp, updated_at: timestamp };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_succeeded", "Payment succeeded");

  if (updated.invoice_id) {
    applyPaymentToInvoice(updated.invoice_id);
  }

  return ok(updated);
}

export async function markPaymentFailed(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "failed")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as failed.`);
  }

  const timestamp = nowIso();
  const updated: Payment = { ...existing, status: "failed", failed_at: timestamp, updated_at: timestamp };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_failed", "Payment failed");

  return ok(updated);
}

/**
 * Refunds are represented as a new Payment (payment_type: "refund") rather
 * than a second ledger — the phase spec's explicit "do not create two
 * competing financial ledgers" instruction. The refundable ceiling is the
 * original Payment's amount_minor minus every prior refund already issued
 * against it (tracked via `reference`, since Payment has no dedicated
 * "refunds this payment" column); requesting more than that fails outright.
 * The original Payment's own status moves to partially_refunded or
 * refunded depending on whether anything refundable remains, and if the
 * original was linked to an Invoice, that Invoice is recomputed through
 * applyPaymentToInvoice so its paid_minor/balance_minor/status reflect the
 * refund immediately.
 */
function refundReferenceFor(originalPaymentId: string): string {
  return `refund_of:${originalPaymentId}`;
}

export async function refundPayment(originalPaymentId: string, amountMinor: number): Promise<DataResult<Payment>> {
  const original = readPayments().find((p) => p.id === originalPaymentId);
  if (!original) {
    return fail("Payment not found.");
  }
  if (!isPaymentRefundable(original.status)) {
    return fail(`Cannot refund a payment that is ${PAYMENT_STATUS_LABELS[original.status].toLowerCase()}.`);
  }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a refund amount greater than zero.");
  }

  const priorRefunds = sumMinor(
    readPayments()
      .filter((p) => p.reference === refundReferenceFor(originalPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  const refundable = Math.max(0, subtractMinor(original.amount_minor, priorRefunds));
  if (amountMinor > refundable) {
    return fail(`Cannot refund more than the refundable amount (${refundable} minor units remaining).`);
  }

  const timestamp = nowIso();
  const refund: Payment = {
    id: generateId("payment"),
    workspace_id: original.workspace_id,
    invoice_id: original.invoice_id,
    client_id: original.client_id,
    event_id: original.event_id,
    contract_id: original.contract_id,
    payment_type: "refund",
    status: "succeeded",
    amount_minor: amountMinor,
    currency: original.currency,
    payment_method: original.payment_method,
    reference: refundReferenceFor(originalPaymentId),
    transaction_date: timestamp.slice(0, 10),
    received_at: timestamp,
    failed_at: null,
    refunded_at: timestamp,
    notes: `Refund of payment ${original.id}.`,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writePayments([...readPayments(), refund]);
  recordTimelineActivity(refund.workspace_id, "payment", refund.id, "payment_refunded", "Payment refunded");

  const remainingAfterThisRefund = refundable - amountMinor;
  const originalUpdated: Payment = {
    ...original,
    status: remainingAfterThisRefund === 0 ? "refunded" : "partially_refunded",
    refunded_at: timestamp,
    updated_at: timestamp,
  };
  writePayments(readPayments().map((p) => (p.id === originalPaymentId ? originalUpdated : p)));

  if (original.invoice_id) {
    applyPaymentToInvoice(original.invoice_id);
  }

  return ok(refund);
}

/**
 * How much of this Payment remains refundable right now — the same ceiling
 * refundPayment() enforces, exposed read-only so the UI can display it (and
 * cap its own input) without duplicating the `reference` convention that
 * tracks prior refunds against a Payment.
 */
export async function getPaymentRefundableAmount(paymentId: string): Promise<number> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment || !isPaymentRefundable(payment.status)) return 0;

  const priorRefunds = sumMinor(
    readPayments()
      .filter(
        (p) =>
          p.reference === refundReferenceFor(paymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status),
      )
      .map((p) => p.amount_minor),
  );
  return Math.max(0, subtractMinor(payment.amount_minor, priorRefunds));
}

export async function cancelPayment(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel a payment that is ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Payment = { ...existing, status: "cancelled", updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_cancelled", "Payment cancelled");

  return ok(updated);
}

export async function getPaymentNextAction(paymentId: string): Promise<string | null> {
  const payment = await getPaymentById(paymentId);
  return getPaymentNextRecommendedAction(payment);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseFilters {
  search?: string;
  status?: ExpenseStatus | "all";
  category?: ExpenseCategory | "all";
  eventId?: string;
  clientId?: string;
  /** planned/approved/due — the same set treated as "unpaid" in getDashboardMetrics' Unpaid Expenses count. */
  unpaidOnly?: boolean;
  /** Only expenses with status "due". */
  dueOnly?: boolean;
  reimbursableOnly?: boolean;
  includeArchived?: boolean;
}

const UNPAID_EXPENSE_STATUSES: ExpenseStatus[] = ["planned", "approved", "due"];

export async function getExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  await delay(200);
  const {
    search,
    status,
    category,
    eventId,
    clientId,
    unpaidOnly = false,
    dueOnly = false,
    reimbursableOnly = false,
    includeArchived = false,
  } = filters;
  return readExpenses().filter((expense) => {
    if (!includeArchived && expense.status === "archived") return false;
    if (status && status !== "all" && expense.status !== status) return false;
    if (category && category !== "all" && expense.category !== category) return false;
    if (eventId && expense.event_id !== eventId) return false;
    if (clientId && expense.client_id !== clientId) return false;
    if (unpaidOnly && !UNPAID_EXPENSE_STATUSES.includes(expense.status)) return false;
    if (dueOnly && expense.status !== "due") return false;
    if (reimbursableOnly && !expense.reimbursable) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      if (!expense.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export async function getExpenseById(id: string): Promise<Expense> {
  await delay(150);
  const expense = readExpenses().find((e) => e.id === id);
  if (!expense) {
    throw new NotFoundError(`Expense ${id} was not found`);
  }
  return expense;
}

/**
 * Expense's client_id is legitimately optional (a general business expense
 * has neither), unlike every other entity in this data layer whose
 * workspace_id is derived from a required Client — so workspace_id is
 * assigned directly from CURRENT_WORKSPACE_ID here instead.
 */
export async function createExpense(input: ExpenseInput): Promise<DataResult<Expense>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const contract = readContracts().find((c) => c.id === parsed.data.contract_id);
    if (!contract) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contract.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const timestamp = nowIso();
  const expense: Expense = {
    id: generateId("expense"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...parsed.data,
    status: "planned",
    paid_at: null,
    reimbursed_at: null,
    document_id: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeExpenses([...readExpenses(), expense]);
  recordTimelineActivity(
    expense.workspace_id,
    "expense",
    expense.id,
    "expense_created",
    `Expense created: "${expense.description}"`,
  );

  return ok(expense);
}

/** Content edits are blocked once the Expense is terminal (reimbursed/cancelled/archived) — a reimbursed Expense's amount is what was actually paid back and shouldn't drift after the fact, same reasoning as a cancelled or archived one being dead history. */
export async function updateExpense(id: string, input: ExpenseInput): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (isExpenseTerminal(existing.status)) {
    return fail(`This expense is ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const contract = readContracts().find((c) => c.id === parsed.data.contract_id);
    if (!contract) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contract.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const updated: Expense = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "expense",
    id,
    "expense_updated",
    `Expense updated: "${updated.description}"`,
  );

  return ok(updated);
}

export async function approveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "approved")) {
    return fail(`Cannot approve an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Expense = { ...existing, status: "approved", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_approved", "Expense approved");

  return ok(updated);
}

export async function markExpenseDue(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "due")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as due.`);
  }

  const updated: Expense = { ...existing, status: "due", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_marked_due", "Expense marked due");

  return ok(updated);
}

export async function markExpensePaid(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "paid")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as paid.`);
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "paid", paid_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_paid", "Expense paid");

  return ok(updated);
}

export async function markExpenseReimbursed(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!existing.reimbursable) {
    return fail("This expense isn't marked reimbursable.");
  }
  if (!canTransitionExpenseStatus(existing.status, "reimbursed")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as reimbursed.`);
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "reimbursed", reimbursed_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_reimbursed", "Expense reimbursed");

  return ok(updated);
}

export async function cancelExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Expense = { ...existing, status: "cancelled", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_cancelled", "Expense cancelled");

  return ok(updated);
}

export async function archiveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status === "archived") {
    return fail("This expense is already archived.");
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_archived", "Expense archived");

  return ok(updated);
}

/** Restoring returns the Expense to "planned" — same "reasonable resumption point" precedent as restoreContract/restoreInvoice. */
export async function restoreExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status !== "archived") {
    return fail("This expense is not archived.");
  }

  const updated: Expense = { ...existing, status: "planned", archived_at: null, updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_restored", "Expense restored");

  return ok(updated);
}

/** Fresh "planned" copy of an Expense's content with a new id, resetting status/paid_at/reimbursed_at/archived_at — mirrors duplicateContract/duplicateInvoice. */
export async function duplicateExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }

  const timestamp = nowIso();
  const duplicate: Expense = {
    ...existing,
    id: generateId("expense"),
    status: "planned",
    paid_at: null,
    reimbursed_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeExpenses([...readExpenses(), duplicate]);
  recordTimelineActivity(
    duplicate.workspace_id,
    "expense",
    duplicate.id,
    "expense_created",
    `Expense created (duplicated from ${existing.id})`,
  );

  return ok(duplicate);
}

export async function getExpenseNextAction(expenseId: string): Promise<string | null> {
  const expense = await getExpenseById(expenseId);
  return getExpenseNextRecommendedAction(expense);
}

// ---------------------------------------------------------------------------
// Financial summaries
// ---------------------------------------------------------------------------

export async function getEventFinancialSummary(eventId: string): Promise<EventFinancialSummary> {
  await delay(150);
  return computeEventFinancialSummary(eventId, readContracts(), readInvoices(), readPayments(), readExpenses());
}

export async function getWorkspaceFinancialSummary(): Promise<WorkspaceFinancialSummary> {
  await delay(150);
  return computeWorkspaceFinancialSummary(readContracts(), readInvoices(), readPayments(), readExpenses());
}

const INACTIVE_CONTRACT_STATUSES_FOR_STATUS: ContractStatus[] = ["cancelled", "declined", "expired", "archived"];

export async function getEventFinancialStatus(eventId: string): Promise<EventFinancialStatus> {
  await delay(150);
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    throw new NotFoundError(`Event ${eventId} was not found`);
  }

  const contracts = readContracts().filter((c) => c.event_id === eventId);
  const activeContracts = contracts.filter((c) => !INACTIVE_CONTRACT_STATUSES_FOR_STATUS.includes(c.status));
  const invoices = readInvoices().filter((i) => i.event_id === eventId && i.status !== "voided");
  const summary = computeEventFinancialSummary(eventId, readContracts(), readInvoices(), readPayments(), readExpenses());

  const eventCancelled =
    event.status === "cancelled" ||
    (contracts.length > 0 && contracts.every((c) => c.status === "cancelled" || c.status === "declined"));

  return deriveEventFinancialStatus({
    eventCancelled,
    hasActiveContract: activeContracts.length > 0,
    hasInvoice: invoices.length > 0,
    hasOverdueInvoice: invoices.some((i) => i.status === "overdue"),
    depositRequired: activeContracts.some((c) => c.deposit_required),
    depositRequiredMinor: summary.deposit_required_minor,
    depositPaidMinor: summary.deposit_paid_minor,
    invoicedTotalMinor: summary.invoiced_total_minor,
    outstandingMinor: summary.outstanding_minor,
    refundedMinor: summary.refunded_minor,
  });
}

export type ContractDepositStatus = "not_required" | "awaiting_deposit" | "deposit_partial" | "deposit_paid";

export interface ContractFinanceSummary {
  invoices: Invoice[];
  totalInvoicedMinor: number;
  totalCollectedMinor: number;
  outstandingMinor: number;
  depositStatus: ContractDepositStatus;
  depositRequiredMinor: number;
  depositPaidMinor: number;
}

/**
 * Small Finance rollup for Contract Detail. Deliberately Contract-scoped
 * rather than reusing computeEventFinancialSummary — a Contract's event_id
 * is nullable (a standalone retainer has none), so this can't assume an
 * Event exists. totalInvoicedMinor/totalCollectedMinor/outstandingMinor are
 * plain sums of each linked (non-voided) Invoice's own total_minor/
 * paid_minor/balance_minor — those are already the data layer's source of
 * truth for each Invoice, not recomputed here. depositStatus follows the
 * same required/none-paid/partial/paid ladder as
 * modules/finance/eventFinancialStatus.ts, scoped to this Contract's own
 * deposit-type Payments.
 */
export async function getContractFinanceSummary(contractId: string): Promise<ContractFinanceSummary> {
  await delay(150);
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) {
    throw new NotFoundError(`Contract ${contractId} was not found`);
  }

  const invoices = readInvoices().filter((i) => i.contract_id === contractId && i.status !== "voided");
  const totalInvoicedMinor = sumMinor(invoices.map((i) => i.total_minor));
  const totalCollectedMinor = sumMinor(invoices.map((i) => i.paid_minor));
  const outstandingMinor = sumMinor(invoices.map((i) => i.balance_minor));

  const depositRequiredMinor = contract.deposit_required ? majorToMinor(contract.deposit_amount ?? 0) : 0;
  const depositPaidMinor = sumMinor(
    readPayments()
      .filter(
        (p) =>
          p.contract_id === contractId &&
          p.payment_type === "deposit" &&
          PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status),
      )
      .map((p) => p.amount_minor),
  );

  let depositStatus: ContractDepositStatus;
  if (!contract.deposit_required) {
    depositStatus = "not_required";
  } else if (depositPaidMinor === 0) {
    depositStatus = "awaiting_deposit";
  } else if (depositPaidMinor < depositRequiredMinor) {
    depositStatus = "deposit_partial";
  } else {
    depositStatus = "deposit_paid";
  }

  return {
    invoices,
    totalInvoicedMinor,
    totalCollectedMinor,
    outstandingMinor,
    depositStatus,
    depositRequiredMinor,
    depositPaidMinor,
  };
}

// ---------------------------------------------------------------------------
// Finance dashboard — one assembled payload so /finance never recomputes
// arithmetic itself; every figure here comes straight from
// computeWorkspaceFinancialSummary/computeAllTimeFinancialTotals/
// computeEventFinancialSummary/deriveEventFinancialStatus, the same pure
// helpers getDashboardMetrics and the single-Event endpoints use. Amounts
// stay in minor units — the view formats them with formatMoney.
// ---------------------------------------------------------------------------

export interface FinanceDashboardMetrics {
  totalInvoicedMinor: number;
  totalCollectedMinor: number;
  outstandingReceivablesMinor: number;
  overdueReceivablesMinor: number;
  depositsPendingMinor: number;
  expensesThisMonthMinor: number;
  grossProfitMinor: number;
  netProfitMinor: number;
  refundsThisMonthMinor: number;
  unpaidExpensesCount: number;
  eventsAwaitingDepositCount: number;
  eventsPaidInFullCount: number;
}

export interface FinanceAlert {
  message: string;
  severity: "warning" | "danger";
  href: string;
}

export interface EventOutstandingBalance {
  event: Event;
  outstandingMinor: number;
  status: EventFinancialStatus;
}

export interface FinanceDashboardData {
  metrics: FinanceDashboardMetrics;
  recentInvoices: Invoice[];
  recentPayments: Payment[];
  overdueInvoices: Invoice[];
  unpaidExpenses: Expense[];
  alerts: FinanceAlert[];
  eventsWithOutstandingBalance: EventOutstandingBalance[];
}

const FINANCE_DASHBOARD_RECENT_LIMIT = 5;

export async function getFinanceDashboardData(): Promise<FinanceDashboardData> {
  await delay(150);
  const contracts = readContracts();
  const invoices = readInvoices();
  const payments = readPayments();
  const expenses = readExpenses();
  const activeEvents = readEvents().filter((e) => e.status !== "archived");

  const workspaceFinancial = computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses);
  const allTimeFinancial = computeAllTimeFinancialTotals(invoices, payments);

  const unpaidExpenses = expenses
    .filter((e) => UNPAID_EXPENSE_STATUSES.includes(e.status))
    .sort((a, b) => (a.due_date ?? a.transaction_date).localeCompare(b.due_date ?? b.transaction_date));
  const overdueExpenses = unpaidExpenses.filter(
    (e) => e.due_date !== null && new Date(e.due_date).getTime() < Date.now(),
  );

  const overdueInvoices = invoices
    .filter((i) => i.status === "overdue")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const recentInvoices = invoices
    .filter((i) => i.status !== "voided")
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, FINANCE_DASHBOARD_RECENT_LIMIT);

  const recentPayments = payments
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, FINANCE_DASHBOARD_RECENT_LIMIT);

  const eventEntries = activeEvents.map((event) => {
    const summary = computeEventFinancialSummary(event.id, contracts, invoices, payments, expenses);
    const eventContracts = contracts.filter((c) => c.event_id === event.id);
    const activeEventContracts = eventContracts.filter(
      (c) => !INACTIVE_CONTRACT_STATUSES_FOR_STATUS.includes(c.status),
    );
    const eventInvoices = invoices.filter((i) => i.event_id === event.id && i.status !== "voided");
    const eventCancelled =
      event.status === "cancelled" ||
      (eventContracts.length > 0 && eventContracts.every((c) => c.status === "cancelled" || c.status === "declined"));
    const status = deriveEventFinancialStatus({
      eventCancelled,
      hasActiveContract: activeEventContracts.length > 0,
      hasInvoice: eventInvoices.length > 0,
      hasOverdueInvoice: eventInvoices.some((i) => i.status === "overdue"),
      depositRequired: activeEventContracts.some((c) => c.deposit_required),
      depositRequiredMinor: summary.deposit_required_minor,
      depositPaidMinor: summary.deposit_paid_minor,
      invoicedTotalMinor: summary.invoiced_total_minor,
      outstandingMinor: summary.outstanding_minor,
      refundedMinor: summary.refunded_minor,
    });
    return { event, summary, status };
  });

  const eventsAwaitingDepositCount = eventEntries.filter((e) => e.status === "awaiting_deposit").length;
  const eventsPaidInFullCount = eventEntries.filter((e) => e.status === "paid_in_full").length;
  const eventsWithOutstandingBalance = eventEntries
    .filter((e) => e.summary.outstanding_minor > 0)
    .map((e) => ({ event: e.event, outstandingMinor: e.summary.outstanding_minor, status: e.status }))
    .sort((a, b) => b.outstandingMinor - a.outstandingMinor);

  const alerts: FinanceAlert[] = [];
  if (overdueInvoices.length > 0) {
    alerts.push({
      message: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} overdue`,
      severity: "danger",
      href: "/finance/invoices",
    });
  }
  if (overdueExpenses.length > 0) {
    alerts.push({
      message: `${overdueExpenses.length} expense${overdueExpenses.length === 1 ? "" : "s"} overdue`,
      severity: "danger",
      href: "/finance/expenses",
    });
  }
  if (eventsAwaitingDepositCount > 0) {
    alerts.push({
      message: `${eventsAwaitingDepositCount} event${eventsAwaitingDepositCount === 1 ? "" : "s"} awaiting deposit`,
      severity: "warning",
      href: "/events",
    });
  }
  if (unpaidExpenses.length > 0) {
    alerts.push({
      message: `${unpaidExpenses.length} unpaid expense${unpaidExpenses.length === 1 ? "" : "s"}`,
      severity: "warning",
      href: "/finance/expenses",
    });
  }

  return {
    metrics: {
      totalInvoicedMinor: allTimeFinancial.total_invoiced_minor,
      totalCollectedMinor: allTimeFinancial.total_collected_minor,
      outstandingReceivablesMinor: workspaceFinancial.outstanding_receivables_minor,
      overdueReceivablesMinor: workspaceFinancial.overdue_receivables_minor,
      depositsPendingMinor: workspaceFinancial.deposits_pending_minor,
      expensesThisMonthMinor: workspaceFinancial.expenses_this_month_minor,
      grossProfitMinor: workspaceFinancial.gross_profit_minor,
      netProfitMinor: workspaceFinancial.net_profit_minor,
      refundsThisMonthMinor: workspaceFinancial.refunds_this_month_minor,
      unpaidExpensesCount: unpaidExpenses.length,
      eventsAwaitingDepositCount,
      eventsPaidInFullCount,
    },
    recentInvoices,
    recentPayments,
    overdueInvoices,
    unpaidExpenses,
    alerts,
    eventsWithOutstandingBalance,
  };
}

// ---------------------------------------------------------------------------
// Invoice/Payment/Expense Notes and Timeline — reuse the shared
// owner_type/owner_id Notes and Timeline architecture, same precedent as
// Contract Notes/Timeline. No InvoiceNote/PaymentNote/ExpenseNote type.
// ---------------------------------------------------------------------------

export async function getNotesByInvoiceId(invoiceId: string): Promise<Note[]> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return [];
  return getNotesByOwner(invoice.workspace_id, "invoice", invoiceId);
}

export async function createInvoiceNote(invoiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) {
    return fail("Invoice not found.");
  }
  return createNoteForOwner(invoice.workspace_id, "invoice", invoiceId, input);
}

export async function getTimelineByInvoiceId(invoiceId: string): Promise<TimelineActivity[]> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return [];
  return getTimelineByOwner(invoice.workspace_id, "invoice", invoiceId);
}

export async function getNotesByPaymentId(paymentId: string): Promise<Note[]> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) return [];
  return getNotesByOwner(payment.workspace_id, "payment", paymentId);
}

export async function createPaymentNote(paymentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) {
    return fail("Payment not found.");
  }
  return createNoteForOwner(payment.workspace_id, "payment", paymentId, input);
}

export async function getTimelineByPaymentId(paymentId: string): Promise<TimelineActivity[]> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) return [];
  return getTimelineByOwner(payment.workspace_id, "payment", paymentId);
}

export async function getNotesByExpenseId(expenseId: string): Promise<Note[]> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) return [];
  return getNotesByOwner(expense.workspace_id, "expense", expenseId);
}

export async function createExpenseNote(expenseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) {
    return fail("Expense not found.");
  }
  return createNoteForOwner(expense.workspace_id, "expense", expenseId, input);
}

export async function getTimelineByExpenseId(expenseId: string): Promise<TimelineActivity[]> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) return [];
  return getTimelineByOwner(expense.workspace_id, "expense", expenseId);
}

// ---------------------------------------------------------------------------
// Documents — the single shared file system for BloomOS. Every module
// (Client, Event, Contract, Contract Exhibit, Invoice, Payment, Expense,
// and the Workspace itself) attaches files through this one domain rather
// than a per-module upload system. Phase 1 is metadata only: no real binary
// upload, no base64 content, storage_provider is always "mock" — see
// src/lib/documentFile.ts for the centralized file-name/size/path rules and
// docs/database.md's Documents section for the full architecture writeup.
//
// owner_type/owner_id is the authoritative owner (same polymorphic pattern
// as Note/TimelineActivity); practically restricted here to
// VALID_DOCUMENT_OWNER_TYPES even though EntityType is broader (lead/
// document/document_folder exist for Notes/Timeline reuse, not as Document
// owners). The typed reference fields (contract_exhibit_id, event_id,
// client_id, contract_id, invoice_id, payment_id, expense_id) are for
// cross-module lookup only and never replace owner_type/owner_id.
//
// Versioning is a parent_document_id + version chain: the first version of
// a file is its own chain root (parent_document_id: null, version: 1);
// every later version points parent_document_id at that same root. Exactly
// one row in a chain has is_latest_version: true — createDocumentVersion is
// the only place that invariant is written.
// ---------------------------------------------------------------------------

const DOCUMENT_STORAGE_BUCKET = "documents";

type DocumentReferenceType = "contract_exhibit" | "event" | "client" | "contract" | "invoice" | "payment" | "expense";

function documentReferenceValue(document: Document, referenceType: DocumentReferenceType): string | null {
  switch (referenceType) {
    case "contract_exhibit":
      return document.contract_exhibit_id;
    case "event":
      return document.event_id;
    case "client":
      return document.client_id;
    case "contract":
      return document.contract_id;
    case "invoice":
      return document.invoice_id;
    case "payment":
      return document.payment_id;
    case "expense":
      return document.expense_id;
  }
}

/**
 * Validates the owner and every typed reference field a Document create/
 * version input carries: each referenced id must exist, and where two
 * references overlap (Client/Event/Contract), they must agree with each
 * other — the same cross-entity consistency createExpense/createInvoice
 * already enforce for event_id/contract_id vs client_id.
 */
function validateDocumentOwnerAndReferences(input: {
  owner_type: EntityType;
  owner_id: string;
  folder_id: string | null;
  contract_exhibit_id: string | null;
  event_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  expense_id: string | null;
}): Partial<Record<string, string>> | null {
  if (!VALID_DOCUMENT_OWNER_TYPES.includes(input.owner_type)) {
    return { owner_type: "Documents cannot be owned by this entity type yet." };
  }

  if (input.owner_type === "workspace") {
    if (input.owner_id !== CURRENT_WORKSPACE_ID) return { owner_id: "Unknown Workspace." };
  } else if (input.owner_type === "client") {
    if (!readClients().some((c) => c.id === input.owner_id)) return { owner_id: "Client not found." };
  } else if (input.owner_type === "event") {
    if (!readEvents().some((e) => e.id === input.owner_id)) return { owner_id: "Event not found." };
  } else if (input.owner_type === "contract") {
    if (!readContracts().some((c) => c.id === input.owner_id)) return { owner_id: "Contract not found." };
  } else if (input.owner_type === "invoice") {
    if (!readInvoices().some((i) => i.id === input.owner_id)) return { owner_id: "Invoice not found." };
  } else if (input.owner_type === "payment") {
    if (!readPayments().some((p) => p.id === input.owner_id)) return { owner_id: "Payment not found." };
  } else if (input.owner_type === "expense") {
    if (!readExpenses().some((e) => e.id === input.owner_id)) return { owner_id: "Expense not found." };
  }

  if (input.folder_id !== null) {
    const folder = readDocumentFolders().find((f) => f.id === input.folder_id);
    if (!folder) return { folder_id: "Folder not found." };
    if (folder.owner_type !== input.owner_type || folder.owner_id !== input.owner_id) {
      return { folder_id: "Folder belongs to a different owner." };
    }
  }

  const client = input.client_id !== null ? readClients().find((c) => c.id === input.client_id) : null;
  if (input.client_id !== null && !client) return { client_id: "Client not found." };

  const event = input.event_id !== null ? readEvents().find((e) => e.id === input.event_id) : null;
  if (input.event_id !== null && !event) return { event_id: "Event not found." };
  if (event && input.client_id !== null && event.client_id !== input.client_id) {
    return { event_id: "Event belongs to a different client." };
  }

  const contract = input.contract_id !== null ? readContracts().find((c) => c.id === input.contract_id) : null;
  if (input.contract_id !== null && !contract) return { contract_id: "Contract not found." };
  if (contract && input.client_id !== null && contract.client_id !== input.client_id) {
    return { contract_id: "Contract belongs to a different client." };
  }
  if (contract && input.event_id !== null && contract.event_id !== null && contract.event_id !== input.event_id) {
    return { contract_id: "Contract belongs to a different event." };
  }

  if (input.contract_exhibit_id !== null && !readContractExhibits().some((x) => x.id === input.contract_exhibit_id)) {
    return { contract_exhibit_id: "Contract Exhibit not found." };
  }
  if (input.invoice_id !== null && !readInvoices().some((i) => i.id === input.invoice_id)) {
    return { invoice_id: "Invoice not found." };
  }
  if (input.payment_id !== null && !readPayments().some((p) => p.id === input.payment_id)) {
    return { payment_id: "Payment not found." };
  }
  if (input.expense_id !== null && !readExpenses().some((e) => e.id === input.expense_id)) {
    return { expense_id: "Expense not found." };
  }

  return null;
}

export interface DocumentFilters {
  search?: string;
  ownerType?: EntityType | "all";
  ownerId?: string;
  category?: DocumentCategory | "all";
  status?: DocumentStatus | "all";
  visibility?: DocumentVisibility | "all";
  mimeType?: string;
  extension?: string;
  folderId?: string | null;
  uploadedFrom?: string;
  uploadedTo?: string;
  expiresFrom?: string;
  expiresTo?: string;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  latestVersionOnly?: boolean;
  referenceType?: DocumentReferenceType;
  referenceId?: string;
  sortBy?: "title" | "uploaded_at" | "updated_at" | "size_bytes" | "expires_at" | "version";
  sortDirection?: "asc" | "desc";
}

export async function getDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  await delay(200);
  const {
    search,
    ownerType,
    ownerId,
    category,
    status,
    visibility,
    mimeType,
    extension,
    folderId,
    uploadedFrom,
    uploadedTo,
    expiresFrom,
    expiresTo,
    includeArchived = false,
    includeDeleted = false,
    latestVersionOnly = false,
    referenceType,
    referenceId,
    sortBy = "uploaded_at",
    sortDirection = "desc",
  } = filters;

  const filtered = readDocuments().filter((document) => {
    if (!includeArchived && document.status === "archived") return false;
    if (!includeDeleted && document.status === "deleted") return false;
    if (ownerType && ownerType !== "all" && document.owner_type !== ownerType) return false;
    if (ownerId && document.owner_id !== ownerId) return false;
    if (category && category !== "all" && document.category !== category) return false;
    if (status && status !== "all" && document.status !== status) return false;
    if (visibility && visibility !== "all" && document.visibility !== visibility) return false;
    if (mimeType && document.mime_type !== mimeType) return false;
    if (extension && document.file_extension !== extension.toLowerCase()) return false;
    if (folderId !== undefined && document.folder_id !== folderId) return false;
    if (uploadedFrom && document.uploaded_at < uploadedFrom) return false;
    if (uploadedTo && document.uploaded_at > uploadedTo) return false;
    if (expiresFrom || expiresTo) {
      if (!document.expires_at) return false;
      if (expiresFrom && document.expires_at < expiresFrom) return false;
      if (expiresTo && document.expires_at > expiresTo) return false;
    }
    if (latestVersionOnly && !document.is_latest_version) return false;
    if (referenceType && referenceId && documentReferenceValue(document, referenceType) !== referenceId) {
      return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = `${document.title} ${document.description ?? ""} ${document.file_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });

  const direction = sortDirection === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    switch (sortBy) {
      case "title":
        return direction * a.title.localeCompare(b.title);
      case "updated_at":
        return direction * a.updated_at.localeCompare(b.updated_at);
      case "size_bytes":
        return direction * (a.size_bytes - b.size_bytes);
      case "expires_at":
        return direction * (a.expires_at ?? "").localeCompare(b.expires_at ?? "");
      case "version":
        return direction * (a.version - b.version);
      case "uploaded_at":
      default:
        return direction * a.uploaded_at.localeCompare(b.uploaded_at);
    }
  });
}

export async function getDocumentById(id: string): Promise<Document> {
  await delay(150);
  const document = readDocuments().find((d) => d.id === id);
  if (!document) {
    throw new NotFoundError(`Document ${id} was not found`);
  }
  return document;
}

export async function createDocumentMetadata(input: DocumentMetadataInput): Promise<DataResult<Document>> {
  const parsed = documentMetadataInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const referenceErrors = validateDocumentOwnerAndReferences(data);
  if (referenceErrors) {
    return fail("Please fix the highlighted fields.", referenceErrors);
  }

  const extension = extractFileExtension(data.file_name);
  const timestamp = nowIso();
  const document: Document = {
    id: generateId("document"),
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: data.owner_type,
    owner_id: data.owner_id,
    folder_id: data.folder_id,
    title: data.title && data.title.length > 0 ? data.title : generateDocumentTitle(data.file_name),
    description: data.description,
    category: data.category,
    status: "draft",
    visibility: data.visibility,
    file_name: normalizeFileName(data.file_name),
    original_file_name: data.file_name,
    file_extension: extension,
    mime_type: data.mime_type,
    size_bytes: data.size_bytes,
    storage_provider: "mock",
    storage_bucket: DOCUMENT_STORAGE_BUCKET,
    storage_path: generateStoragePath({
      workspaceId: CURRENT_WORKSPACE_ID,
      ownerType: data.owner_type,
      ownerId: data.owner_id,
      fileName: data.file_name,
    }),
    checksum: calculateMockChecksum(data.file_name, data.size_bytes),
    version: 1,
    is_latest_version: true,
    parent_document_id: null,
    contract_exhibit_id: data.contract_exhibit_id,
    event_id: data.event_id,
    client_id: data.client_id,
    contract_id: data.contract_id,
    invoice_id: data.invoice_id,
    payment_id: data.payment_id,
    expense_id: data.expense_id,
    uploaded_by: data.uploaded_by,
    uploaded_at: timestamp,
    expires_at: data.expires_at,
    archived_at: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeDocuments([...readDocuments(), document]);
  recordTimelineActivity(
    document.workspace_id,
    "document",
    document.id,
    "document_created",
    `Document uploaded: "${document.title}"`,
  );

  return ok(document);
}

/** Editable metadata only (title/description/category/visibility/expires_at) — file content, folder, and status each go through their own dedicated action (moveDocumentToFolder, updateDocumentVisibility, activateDocument/archiveDocument/etc, createDocumentVersion). Blocked once the Document is soft-deleted. */
export async function updateDocumentMetadata(
  id: string,
  input: { title: string | null; description: string | null; category: DocumentCategory; expires_at: string | null },
): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }
  if (input.title !== null && input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title cannot be blank." });
  }

  const updated: Document = {
    ...existing,
    title: input.title && input.title.length > 0 ? input.title : existing.title,
    description: input.description,
    category: input.category,
    expires_at: input.expires_at,
    updated_at: nowIso(),
  };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    id,
    "document_metadata_updated",
    `Document metadata updated: "${updated.title}"`,
  );

  return ok(updated);
}

export async function activateDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot activate a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = { ...existing, status: "active", updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_activated", "Document activated");

  return ok(updated);
}

function documentChain(anyVersionId: string): Document[] {
  const all = readDocuments();
  const anchor = all.find((d) => d.id === anyVersionId);
  if (!anchor) return [];
  const rootId = anchor.parent_document_id ?? anchor.id;
  return all
    .filter((d) => d.id === rootId || d.parent_document_id === rootId)
    .sort((a, b) => a.version - b.version);
}

/** Every version in the chain containing `documentId` (any version's id may be passed), oldest first. */
export async function getDocumentVersions(documentId: string): Promise<Document[]> {
  await delay(150);
  return documentChain(documentId);
}

/** The single is_latest_version: true row in the chain containing `documentId`. */
export async function getLatestDocumentVersion(documentId: string): Promise<Document> {
  const chain = documentChain(documentId);
  const latest = chain.find((d) => d.is_latest_version);
  if (!latest) {
    throw new NotFoundError(`Document ${documentId} was not found`);
  }
  return latest;
}

/**
 * Uploads a new version onto an existing chain: builds the new row inherit-
 * ing owner/category/references/folder from the current latest version,
 * marks that prior latest version `superseded` (is_latest_version: false),
 * and writes both changes in a single batch — a reader never observes a
 * moment with zero or two "latest" versions. Two Timeline entries are
 * recorded, one per affected Document row: `document_version_created` on
 * the new version, `document_superseded` on the old one.
 */
export async function createDocumentVersion(input: NewDocumentVersionInput): Promise<DataResult<Document>> {
  const parsed = newDocumentVersionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const chain = documentChain(data.document_id);
  if (chain.length === 0) {
    return fail("Document not found.");
  }
  const latest = chain.find((d) => d.is_latest_version);
  if (!latest) {
    return fail("This document has no current version to supersede.");
  }
  if (latest.status === "deleted") {
    return fail("This document has been deleted and cannot receive a new version.");
  }

  const rootId = latest.parent_document_id ?? latest.id;
  const title = data.title !== undefined && data.title !== null && data.title.length > 0 ? data.title : latest.title;
  const visibility = data.visibility !== undefined && data.visibility !== null ? data.visibility : latest.visibility;
  const expiresAt = data.expires_at !== undefined ? data.expires_at : latest.expires_at;
  const timestamp = nowIso();

  const newVersion: Document = {
    ...latest,
    id: generateId("document"),
    title,
    status: "active",
    visibility,
    file_name: normalizeFileName(data.file_name),
    original_file_name: data.file_name,
    file_extension: extractFileExtension(data.file_name),
    mime_type: data.mime_type,
    size_bytes: data.size_bytes,
    storage_path: generateStoragePath({
      workspaceId: latest.workspace_id,
      ownerType: latest.owner_type,
      ownerId: latest.owner_id,
      fileName: data.file_name,
    }),
    checksum: calculateMockChecksum(data.file_name, data.size_bytes),
    version: latest.version + 1,
    is_latest_version: true,
    parent_document_id: rootId,
    uploaded_by: data.uploaded_by,
    uploaded_at: timestamp,
    expires_at: expiresAt,
    archived_at: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const supersededPrevious: Document = { ...latest, status: "superseded", is_latest_version: false, updated_at: timestamp };

  writeDocuments([
    ...readDocuments().filter((d) => d.id !== latest.id),
    supersededPrevious,
    newVersion,
  ]);
  recordTimelineActivity(
    newVersion.workspace_id,
    "document",
    newVersion.id,
    "document_version_created",
    `New version uploaded: "${newVersion.title}" (v${newVersion.version})`,
  );
  recordTimelineActivity(
    supersededPrevious.workspace_id,
    "document",
    supersededPrevious.id,
    "document_superseded",
    `Superseded by version ${newVersion.version}`,
  );

  return ok(newVersion);
}

export async function archiveDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "archived")) {
    return fail(`Cannot archive a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Document = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_archived", "Document archived");

  return ok(updated);
}

/** Restores an archived or soft-deleted Document back to `active` — the same "reasonable resumption point" precedent as restoreExpense/restoreContract. */
export async function restoreDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot restore a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = {
    ...existing,
    status: "active",
    archived_at: null,
    deleted_at: null,
    updated_at: nowIso(),
  };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_restored", "Document restored");

  return ok(updated);
}

/** Soft delete only — never physically removes the record (see docs/database.md's Documents section). */
export async function softDeleteDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "deleted")) {
    return fail(`Cannot delete a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Document = { ...existing, status: "deleted", deleted_at: timestamp, updated_at: timestamp };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_soft_deleted", "Document deleted");

  return ok(updated);
}

export async function expireDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "expired")) {
    return fail(`Cannot expire a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = { ...existing, status: "expired", updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_expired", "Document expired");

  return ok(updated);
}

export async function updateDocumentVisibility(
  id: string,
  visibility: DocumentVisibility,
): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }

  const updated: Document = { ...existing, visibility, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    id,
    "document_visibility_changed",
    `Visibility changed to ${visibility}`,
  );

  return ok(updated);
}

export async function moveDocumentToFolder(id: string, folderId: string | null): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }
  if (folderId !== null) {
    const folder = readDocumentFolders().find((f) => f.id === folderId);
    if (!folder) {
      return fail("Folder not found.");
    }
    if (folder.owner_type !== existing.owner_type || folder.owner_id !== existing.owner_id) {
      return fail("Cannot move a document into a folder belonging to a different owner.");
    }
  }

  const updated: Document = { ...existing, folder_id: folderId, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_moved_to_folder", "Document moved to a different folder");

  return ok(updated);
}

export async function getDocumentsByOwner(ownerType: EntityType, ownerId: string): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => d.owner_type === ownerType && d.owner_id === ownerId);
}

export async function getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => d.category === category);
}

export async function getDocumentsByReference(
  referenceType: DocumentReferenceType,
  referenceId: string,
): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => documentReferenceValue(d, referenceType) === referenceId);
}

export async function getDocumentNextAction(documentId: string): Promise<string | null> {
  const document = await getDocumentById(documentId);
  return getDocumentNextRecommendedAction(document);
}

export async function getDocumentOwnerSummary(ownerType: EntityType, ownerId: string): Promise<DocumentOwnerSummary> {
  const owned = readDocuments().filter((d) => d.owner_type === ownerType && d.owner_id === ownerId);
  return computeDocumentOwnerSummary(owned);
}

export async function getWorkspaceDocumentSummary(): Promise<DocumentWorkspaceSummary> {
  return computeDocumentWorkspaceSummary(readDocuments());
}

// ---------------------------------------------------------------------------
// Document Folders — nesting via parent_folder_id, scoped to a single
// owner_type/owner_id (a folder never spans multiple owners). Cycle
// prevention and cross-Workspace/cross-owner move rules live centrally in
// core/workflows/documentFolderWorkflow.ts, never reimplemented here.
// Archiving is `archived_at`-based (no separate status field) and is
// shallow — it does not cascade to child folders or the Documents inside.
// ---------------------------------------------------------------------------

export interface DocumentFolderFilters {
  ownerType?: EntityType;
  ownerId?: string;
  parentFolderId?: string | null;
  includeArchived?: boolean;
}

export async function getDocumentFolders(filters: DocumentFolderFilters = {}): Promise<DocumentFolder[]> {
  await delay(150);
  const { ownerType, ownerId, parentFolderId, includeArchived = false } = filters;
  return readDocumentFolders().filter((folder) => {
    if (!includeArchived && folder.archived_at !== null) return false;
    if (ownerType && folder.owner_type !== ownerType) return false;
    if (ownerId && folder.owner_id !== ownerId) return false;
    if (parentFolderId !== undefined && folder.parent_folder_id !== parentFolderId) return false;
    return true;
  });
}

export async function getDocumentFolderById(id: string): Promise<DocumentFolder> {
  await delay(100);
  const folder = readDocumentFolders().find((f) => f.id === id);
  if (!folder) {
    throw new NotFoundError(`Document folder ${id} was not found`);
  }
  return folder;
}

export async function createDocumentFolder(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>> {
  const parsed = documentFolderInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  if (!VALID_DOCUMENT_OWNER_TYPES.includes(data.owner_type)) {
    return fail("Please fix the highlighted fields.", { owner_type: "Folders cannot be owned by this entity type yet." });
  }
  if (data.parent_folder_id !== null) {
    const parent = readDocumentFolders().find((f) => f.id === data.parent_folder_id);
    if (!parent) {
      return fail("Please fix the highlighted fields.", { parent_folder_id: "Parent folder not found." });
    }
    if (parent.owner_type !== data.owner_type || parent.owner_id !== data.owner_id) {
      return fail("Please fix the highlighted fields.", {
        parent_folder_id: "Parent folder belongs to a different owner.",
      });
    }
  }

  const timestamp = nowIso();
  const folder: DocumentFolder = {
    id: generateId("docfolder"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeDocumentFolders([...readDocumentFolders(), folder]);
  recordTimelineActivity(folder.workspace_id, "document_folder", folder.id, "document_folder_created", `Folder created: "${folder.name}"`);

  return ok(folder);
}

/** Updates name/description/sort_order/visibility only — owner_type/owner_id never change after creation, and parent_folder_id changes only through moveDocumentFolder (so cycle/cross-owner checks stay in one place). */
export async function updateDocumentFolder(
  id: string,
  input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (input.name.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { name: "Folder name is required." });
  }

  const updated: DocumentFolder = { ...existing, ...input, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(
    existing.workspace_id,
    "document_folder",
    id,
    "document_folder_renamed",
    `Folder updated: "${updated.name}"`,
  );

  return ok(updated);
}

export async function moveDocumentFolder(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }

  const check = canMoveFolder(existing, newParentFolderId, readDocumentFolders());
  if (!check.allowed) {
    return fail(check.reason ?? "This move is not allowed.");
  }

  const updated: DocumentFolder = { ...existing, parent_folder_id: newParentFolderId, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_moved", "Folder moved");

  return ok(updated);
}

export async function archiveDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at !== null) {
    return fail("This folder is already archived.");
  }

  const timestamp = nowIso();
  const updated: DocumentFolder = { ...existing, archived_at: timestamp, updated_at: timestamp };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_archived", "Folder archived");

  return ok(updated);
}

export async function restoreDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at === null) {
    return fail("This folder is not archived.");
  }

  const updated: DocumentFolder = { ...existing, archived_at: null, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_restored", "Folder restored");

  return ok(updated);
}

export interface DocumentFolderTreeNode {
  folder: DocumentFolder;
  children: DocumentFolderTreeNode[];
}

function buildFolderTree(parentFolderId: string | null, allFolders: DocumentFolder[]): DocumentFolderTreeNode[] {
  return getFolderChildren(parentFolderId, allFolders).map((folder) => ({
    folder,
    children: buildFolderTree(folder.id, allFolders),
  }));
}

export async function getDocumentFolderTree(ownerType: EntityType, ownerId: string): Promise<DocumentFolderTreeNode[]> {
  await delay(150);
  const ownerFolders = readDocumentFolders().filter((f) => f.owner_type === ownerType && f.owner_id === ownerId);
  return buildFolderTree(null, ownerFolders);
}

export async function getDocumentFolderPath(id: string): Promise<DocumentFolder[]> {
  await delay(100);
  return getFolderPath(id, readDocumentFolders());
}

/**
 * Applies a reusable folder-name template (see modules/documents/constants/
 * folderTemplates.ts) to one owner as a single atomic batch, optionally
 * nested under an existing folder (e.g. the `finance` template under an
 * Event's own "Finance" folder). Never auto-triggered by createClient/
 * createEvent/createContract — a user or future UI calls this on demand.
 * Mirrors applyDefaultChecklistTemplate: every item is validated first (if
 * any fails, nothing is written), the whole batch is written in one call,
 * and exactly one summarized `document_folder_template_applied` Timeline
 * entry is recorded — never one per generated folder.
 */
export async function applyDefaultFolderTemplate(input: {
  ownerType: EntityType;
  ownerId: string;
  templateKind: FolderTemplateKind;
  parentFolderId?: string | null;
}): Promise<DataResult<DocumentFolder[]>> {
  const parentFolderId = input.parentFolderId ?? null;
  const names = DOCUMENT_FOLDER_TEMPLATES[input.templateKind];

  const parsedItems: DocumentFolderInput[] = [];
  for (const [index, name] of names.entries()) {
    const parsed = documentFolderInputSchema.safeParse({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      parent_folder_id: parentFolderId,
      name,
      description: null,
      sort_order: index,
      visibility: "internal",
    });
    if (!parsed.success) {
      return fail("The default folder template failed validation; no folders were created.", fieldErrorsFromZod(parsed.error));
    }
    parsedItems.push(parsed.data);
  }

  const timestamp = nowIso();
  const newFolders: DocumentFolder[] = parsedItems.map((data) => ({
    id: generateId("docfolder"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  }));

  writeDocumentFolders([...readDocumentFolders(), ...newFolders]);
  recordTimelineActivity(
    CURRENT_WORKSPACE_ID,
    input.ownerType,
    input.ownerId,
    "document_folder_template_applied",
    `Default ${input.templateKind} folder template applied with ${newFolders.length} folder${newFolders.length === 1 ? "" : "s"}.`,
  );

  return ok(newFolders);
}

// ---------------------------------------------------------------------------
// Document / Document Folder Notes and Timeline — reuse the shared
// owner_type/owner_id Notes and Timeline architecture, same precedent as
// Contract/Invoice/Payment/Expense Notes/Timeline. No DocumentNote/
// FolderNote type.
// ---------------------------------------------------------------------------

export async function getNotesByDocumentId(documentId: string): Promise<Note[]> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) return [];
  return getNotesByOwner(document.workspace_id, "document", documentId);
}

export async function createDocumentNote(documentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) {
    return fail("Document not found.");
  }
  return createNoteForOwner(document.workspace_id, "document", documentId, input);
}

export async function getTimelineByDocumentId(documentId: string): Promise<TimelineActivity[]> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) return [];
  return getTimelineByOwner(document.workspace_id, "document", documentId);
}

export async function getNotesByDocumentFolderId(folderId: string): Promise<Note[]> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) return [];
  return getNotesByOwner(folder.workspace_id, "document_folder", folderId);
}

export async function createDocumentFolderNote(folderId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) {
    return fail("Folder not found.");
  }
  return createNoteForOwner(folder.workspace_id, "document_folder", folderId, input);
}

export async function getTimelineByDocumentFolderId(folderId: string): Promise<TimelineActivity[]> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) return [];
  return getTimelineByOwner(folder.workspace_id, "document_folder", folderId);
}

// ---------------------------------------------------------------------------
// Placeholder attachment helpers — update a Document's own typed reference
// field only (metadata, no real binary upload). Never rewrites the other
// side's `document_id` placeholder field on ContractExhibit/Payment/Expense
// — additive and backward-compatible, per the Contracts/Finance foundations
// those fields were introduced in.
// ---------------------------------------------------------------------------

async function attachDocumentReference(
  documentId: string,
  patch: Partial<
    Pick<Document, "contract_exhibit_id" | "event_id" | "client_id" | "contract_id" | "invoice_id" | "payment_id" | "expense_id">
  >,
  label: string,
): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === documentId);
  if (!existing) {
    return fail("Document not found.");
  }

  const updated: Document = { ...existing, ...patch, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === documentId ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    documentId,
    "document_metadata_updated",
    `Document linked to ${label}`,
  );

  return ok(updated);
}

export async function attachDocumentToContractExhibit(documentId: string, exhibitId: string): Promise<DataResult<Document>> {
  if (!readContractExhibits().some((x) => x.id === exhibitId)) {
    return fail("Contract Exhibit not found.");
  }
  return attachDocumentReference(documentId, { contract_exhibit_id: exhibitId }, `Contract Exhibit ${exhibitId}`);
}

export async function attachDocumentToPayment(documentId: string, paymentId: string): Promise<DataResult<Document>> {
  if (!readPayments().some((p) => p.id === paymentId)) {
    return fail("Payment not found.");
  }
  return attachDocumentReference(documentId, { payment_id: paymentId }, `Payment ${paymentId}`);
}

export async function attachDocumentToExpense(documentId: string, expenseId: string): Promise<DataResult<Document>> {
  if (!readExpenses().some((e) => e.id === expenseId)) {
    return fail("Expense not found.");
  }
  return attachDocumentReference(documentId, { expense_id: expenseId }, `Expense ${expenseId}`);
}

export async function attachDocumentToInvoice(documentId: string, invoiceId: string): Promise<DataResult<Document>> {
  if (!readInvoices().some((i) => i.id === invoiceId)) {
    return fail("Invoice not found.");
  }
  return attachDocumentReference(documentId, { invoice_id: invoiceId }, `Invoice ${invoiceId}`);
}

export async function attachDocumentToEvent(documentId: string, eventId: string): Promise<DataResult<Document>> {
  if (!readEvents().some((e) => e.id === eventId)) {
    return fail("Event not found.");
  }
  return attachDocumentReference(documentId, { event_id: eventId }, `Event ${eventId}`);
}

export async function attachDocumentToClient(documentId: string, clientId: string): Promise<DataResult<Document>> {
  if (!readClients().some((c) => c.id === clientId)) {
    return fail("Client not found.");
  }
  return attachDocumentReference(documentId, { client_id: clientId }, `Client ${clientId}`);
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
  const invoices = readInvoices();
  const payments = readPayments();
  const expenses = readExpenses();
  const workspaceFinancial = computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses);
  const allTimeFinancial = computeAllTimeFinancialTotals(invoices, payments);
  const unpaidExpenses = expenses.filter((e) => UNPAID_EXPENSE_STATUSES.includes(e.status));
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
  const eventFinancialStatuses = activeEvents.map((event) => {
    const eventContracts = contracts.filter((c) => c.event_id === event.id);
    const activeEventContracts = eventContracts.filter(
      (c) => !INACTIVE_CONTRACT_STATUSES_FOR_STATUS.includes(c.status),
    );
    const eventInvoices = invoices.filter((i) => i.event_id === event.id && i.status !== "voided");
    const eventSummary = computeEventFinancialSummary(event.id, contracts, invoices, payments, expenses);
    const eventCancelled =
      event.status === "cancelled" ||
      (eventContracts.length > 0 && eventContracts.every((c) => c.status === "cancelled" || c.status === "declined"));
    return deriveEventFinancialStatus({
      eventCancelled,
      hasActiveContract: activeEventContracts.length > 0,
      hasInvoice: eventInvoices.length > 0,
      hasOverdueInvoice: eventInvoices.some((i) => i.status === "overdue"),
      depositRequired: activeEventContracts.some((c) => c.deposit_required),
      depositRequiredMinor: eventSummary.deposit_required_minor,
      depositPaidMinor: eventSummary.deposit_paid_minor,
      invoicedTotalMinor: eventSummary.invoiced_total_minor,
      outstandingMinor: eventSummary.outstanding_minor,
      refundedMinor: eventSummary.refunded_minor,
    });
  });
  // Distinct from "Events Awaiting Deposit" above (events.status, a manually-progressed lifecycle
  // stage) — this is derived strictly from Contract/Payment data and can disagree with it, which is
  // the point: a staff-marked "ready" Event whose deposit was never actually collected still shows here.
  const eventsAwaitingDepositFinance = eventFinancialStatuses.filter((s) => s === "awaiting_deposit").length;
  const eventsPaidInFull = eventFinancialStatuses.filter((s) => s === "paid_in_full").length;
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

  const documents = readDocuments();
  const documentWorkspaceSummary = computeDocumentWorkspaceSummary(documents);
  const nonDeletedDocuments = documents.filter((d) => d.status !== "deleted");
  const archivedDocuments = documents.filter((d) => d.status === "archived");
  const clientVisibleDocuments = nonDeletedDocuments.filter(
    (d) => d.visibility === "client" || d.visibility === "client_and_team",
  );
  const teamVisibleDocuments = nonDeletedDocuments.filter(
    (d) => d.visibility === "team" || d.visibility === "client_and_team",
  );
  const documentsMissingCategory = nonDeletedDocuments.filter((d) => d.category === "other");
  const documentsMissingFolder = nonDeletedDocuments.filter((d) => d.folder_id === null);

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
    { label: "Total Invoiced", value: formatMoney(allTimeFinancial.total_invoiced_minor, "USD"), href: "/finance" },
    { label: "Total Collected", value: formatMoney(allTimeFinancial.total_collected_minor, "USD"), href: "/finance" },
    {
      label: "Outstanding Receivables",
      value: formatMoney(workspaceFinancial.outstanding_receivables_minor, "USD"),
      href: "/finance",
    },
    {
      label: "Overdue Receivables",
      value: formatMoney(workspaceFinancial.overdue_receivables_minor, "USD"),
      href: "/finance",
    },
    { label: "Deposits Pending", value: formatMoney(workspaceFinancial.deposits_pending_minor, "USD"), href: "/finance" },
    {
      label: "Expenses This Month",
      value: formatMoney(workspaceFinancial.expenses_this_month_minor, "USD"),
      href: "/finance",
    },
    { label: "Gross Profit", value: formatMoney(workspaceFinancial.gross_profit_minor, "USD"), href: "/finance" },
    { label: "Net Profit", value: formatMoney(workspaceFinancial.net_profit_minor, "USD"), href: "/finance" },
    {
      label: "Refunds This Month",
      value: formatMoney(workspaceFinancial.refunds_this_month_minor, "USD"),
      href: "/finance",
    },
    { label: "Unpaid Expenses", value: String(unpaidExpenses.length), href: "/finance" },
    { label: "Events Awaiting Deposit (Finance)", value: String(eventsAwaitingDepositFinance), href: "/finance" },
    { label: "Events Paid in Full", value: String(eventsPaidInFull), href: "/finance" },
    { label: "Total Documents", value: String(documentWorkspaceSummary.total), href: "/documents" },
    {
      label: "Documents Uploaded This Month",
      value: String(documentWorkspaceSummary.uploadedThisMonth),
      href: "/documents",
    },
    {
      label: "Storage Used",
      value: `${(documentWorkspaceSummary.totalStorageBytes / (1024 * 1024)).toFixed(1)} MB`,
      href: "/documents",
    },
    { label: "Expiring Documents", value: String(documentWorkspaceSummary.expiring), href: "/documents" },
    { label: "Expired Documents", value: String(documentWorkspaceSummary.expired), href: "/documents" },
    { label: "Archived Documents", value: String(archivedDocuments.length), href: "/documents" },
    { label: "Client-visible Documents", value: String(clientVisibleDocuments.length), href: "/documents" },
    { label: "Team-visible Documents", value: String(teamVisibleDocuments.length), href: "/documents" },
    { label: "Documents Missing Category", value: String(documentsMissingCategory.length), href: "/documents" },
    { label: "Documents Missing Folder", value: String(documentsMissingFolder.length), href: "/documents" },
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
  resetInvoicesStore();
  resetPaymentsStore();
  resetExpensesStore();
  resetDocumentsStore();
  resetDocumentFoldersStore();
}

/**
 * Test-only: exercises the internal default-checklist batch initializer
 * directly (e.g. to verify atomicity on a deliberately invalid template).
 * Never imported by UI — createEvent() is the only real caller.
 */
export const __applyDefaultChecklistTemplateForTests = applyDefaultChecklistTemplate;

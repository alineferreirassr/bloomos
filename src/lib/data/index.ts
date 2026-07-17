import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { MediaAsset } from "@/types/mediaAsset";
import type { Contract } from "@/types/contract";
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
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { ClientStatus } from "@/core/enums/clientStatus";
import type { ContactMethod } from "@/core/enums/contactMethod";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import type { ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { ContractStatus } from "@/core/workflows/contractWorkflow";
import {
  canTransitionDocumentStatus,
  getDocumentNextRecommendedAction,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/core/workflows/documentWorkflow";
import { canMoveFolder, getFolderPath, getFolderChildren } from "@/core/workflows/documentFolderWorkflow";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { NotFoundError } from "@/core/errors";
import type { EventStatus, EventLifecycleStage } from "@/core/workflows/eventWorkflow";
import type { LeadFormInput } from "@/modules/leads/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { ClientFormInput } from "@/modules/clients/schema";
import type { EventFormInput, ScheduleItemInput } from "@/modules/events/schema";
import type { ChecklistItemInput } from "@/modules/checklist/schema";
import type { ContractInput, ContractExhibitInput } from "@/modules/contracts/schema";
import { computeContractStats } from "@/modules/contracts/contractStats";
import type { InvoiceInput, PaymentInput, ExpenseInput } from "@/modules/finance/schema";
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
import { sumMinor, majorToMinor, formatMoney } from "@/lib/money";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { delay, generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import type { LeadFilters } from "@/lib/data/leads/repository";
import { mockLeadsRepository } from "@/lib/data/leads/mockRepository";
import { supabaseLeadsRepository } from "@/lib/data/leads/supabaseRepository";
import type { ClientFilters } from "@/lib/data/clients/repository";
import { mockClientsRepository } from "@/lib/data/clients/mockRepository";
import { supabaseClientsRepository } from "@/lib/data/clients/supabaseRepository";
import { mockConversionRepository } from "@/lib/data/conversion/mockConversionRepository";
import { supabaseConversionRepository } from "@/lib/data/conversion/supabaseConversionRepository";
import type { EventFilters } from "@/lib/data/events/repository";
import {
  mockEventsRepository,
  applyDefaultChecklistTemplate as applyDefaultChecklistTemplateForTests,
} from "@/lib/data/events/mockRepository";
import { supabaseEventsRepository } from "@/lib/data/events/supabaseRepository";
import type {
  MediaAssetFilters,
  UploadMediaAssetInput,
  ReplaceMediaAssetVersionInput,
  MediaAssetDownload,
  MediaAssetDownloadUrl,
  MediaAssetChecksumVerification,
} from "@/lib/data/media/repository";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { supabaseMediaAssetsRepository } from "@/lib/data/media/supabaseRepository";
import type { ContractFilters, ContractTemplateFilters } from "@/lib/data/contracts/repository";
import { mockContractsRepository } from "@/lib/data/contracts/mockRepository";
import { supabaseContractsRepository } from "@/lib/data/contracts/supabaseRepository";
import type { InvoiceFilters, PaymentFilters, ExpenseFilters } from "@/lib/data/finance/repository";
import { mockFinanceRepository } from "@/lib/data/finance/mockRepository";
import { supabaseFinanceRepository } from "@/lib/data/finance/supabaseRepository";
import {
  readLeads,
  resetLeadsStore,
} from "@/lib/data/mock/leadsStore";
import {
  readNotes,
  writeNotes,
  resetNotesStore,
} from "@/lib/data/mock/notesStore";
import {
  recordTimelineActivity,
  resetTimelineStore,
} from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import {
  readClients,
  resetClientsStore,
} from "@/lib/data/mock/clientsStore";
import {
  readEvents,
  resetEventsStore,
} from "@/lib/data/mock/eventsStore";
import { resetChecklistStore } from "@/lib/data/mock/checklistStore";
import { resetScheduleStore } from "@/lib/data/mock/scheduleStore";
import { readContracts, resetContractsStore } from "@/lib/data/mock/contractsStore";
import { resetContractTemplatesStore } from "@/lib/data/mock/contractTemplatesStore";
import { readContractExhibits, resetContractExhibitsStore } from "@/lib/data/mock/contractExhibitsStore";
import { readInvoices, resetInvoicesStore } from "@/lib/data/mock/invoicesStore";
import { readPayments, resetPaymentsStore } from "@/lib/data/mock/paymentsStore";
import { readExpenses, resetExpensesStore } from "@/lib/data/mock/expensesStore";
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
//
// The first business module with a live Supabase repository
// (lib/data/leads/supabaseRepository.ts) alongside the original mock one
// (lib/data/leads/mockRepository.ts) — lib/data/provider.ts's
// selectRepository() picks between them per NEXT_PUBLIC_DATA_MODE. Every
// function below is a thin, backend-agnostic wrapper; neither this file nor
// any UI ever branches on data mode directly.
// ---------------------------------------------------------------------------

export type { LeadFilters } from "@/lib/data/leads/repository";

function leadsRepository() {
  return selectRepository({ mock: mockLeadsRepository, supabase: supabaseLeadsRepository });
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  return leadsRepository().getLeads(filters);
}

export async function getLeadById(id: string): Promise<Lead> {
  return leadsRepository().getLeadById(id);
}

export async function createLead(input: LeadFormInput): Promise<DataResult<Lead>> {
  return leadsRepository().createLead(input);
}

export async function updateLead(
  id: string,
  input: LeadFormInput,
): Promise<DataResult<Lead>> {
  return leadsRepository().updateLead(id, input);
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<DataResult<Lead>> {
  return leadsRepository().updateLeadStatus(id, status);
}

export async function archiveLead(id: string): Promise<DataResult<Lead>> {
  return leadsRepository().archiveLead(id);
}

export async function markWelcomeGuideSent(id: string): Promise<DataResult<Lead>> {
  return leadsRepository().markWelcomeGuideSent(id);
}

function conversionRepository() {
  return selectRepository({ mock: mockConversionRepository, supabase: supabaseConversionRepository });
}

/**
 * Conversion routes through its own repository pair (lib/data/conversion/) —
 * spans both Leads and Clients, so it isn't owned by either
 * leadsRepository() or clientsRepository(). Mock delegates unchanged to
 * LeadConversionService (mockConversionRepository.ts); Supabase calls the
 * convert_lead_to_client(uuid, text) Postgres function (an atomic, RLS-scoped
 * transaction — see supabase/migrations/20260717100500_lead_to_client_conversion.sql).
 */
export async function convertLeadToClient(leadId: string) {
  return conversionRepository().convertLeadToClient(leadId);
}

// ---------------------------------------------------------------------------
// Notes (shared by Leads and Clients — one Note shape, keyed by owner_type/owner_id)
//
// owner_id is polymorphic (a lead id on one row, a client id on the next), so
// it can never carry a normal foreign-key constraint. Every query below scopes
// by workspace_id together with owner_type/owner_id — never owner_id alone —
// so a workspace can't ever see another workspace's notes even if two ids
// happened to collide. See docs/database.md's `notes` section and Supabase
// RLS policies for how this gets enforced at the DB layer.
//
// getNotesByOwner/createNoteForOwner (imported from
// lib/data/mock/notesTimelineShared) remain mock-only — every owner type
// besides Lead and Client (Contract, Invoice, Payment, Expense, Document,
// DocumentFolder) has no Supabase-backed notes yet. Lead and Client notes
// route through leadsRepository()/clientsRepository() above instead, which
// are backend-aware.
// ---------------------------------------------------------------------------

export async function getNotesByLeadId(leadId: string): Promise<Note[]> {
  return leadsRepository().getNotesByLeadId(leadId);
}

export async function createNote(
  leadId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  return leadsRepository().createNote(leadId, input);
}

export async function getNotesByClientId(clientId: string): Promise<Note[]> {
  return clientsRepository().getNotesByClientId(clientId);
}

export async function createClientNote(
  clientId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  return clientsRepository().createClientNote(clientId, input);
}

export async function togglePinNote(noteId: string): Promise<DataResult<Note>> {
  const leadResult = await leadsRepository().togglePinNote(noteId);
  if (leadResult !== null) return leadResult;

  const clientResult = await clientsRepository().togglePinClientNote(noteId);
  if (clientResult !== null) return clientResult;

  const eventResult = await eventsRepository().togglePinEventNote(noteId);
  if (eventResult !== null) return eventResult;

  const contractResult = await contractsRepository().togglePinContractNote(noteId);
  if (contractResult !== null) return contractResult;

  const invoiceResult = await financeRepository().togglePinInvoiceNote(noteId);
  if (invoiceResult !== null) return invoiceResult;

  const paymentResult = await financeRepository().togglePinPaymentNote(noteId);
  if (paymentResult !== null) return paymentResult;

  const expenseResult = await financeRepository().togglePinExpenseNote(noteId);
  if (expenseResult !== null) return expenseResult;

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
//
// getTimelineByOwner (imported from lib/data/mock/notesTimelineShared)
// remains mock-only — see the Notes section comment above; Lead and Client
// timeline route through leadsRepository()/clientsRepository() instead.
// ---------------------------------------------------------------------------

export async function getTimelineByLeadId(leadId: string): Promise<TimelineActivity[]> {
  return leadsRepository().getTimelineByLeadId(leadId);
}

export async function getTimelineByClientId(clientId: string): Promise<TimelineActivity[]> {
  return clientsRepository().getTimelineByClientId(clientId);
}

// ---------------------------------------------------------------------------
// Clients
//
// The second business module with a live Supabase repository
// (lib/data/clients/supabaseRepository.ts) alongside the original mock one
// (lib/data/clients/mockRepository.ts) — same selectRepository() pattern as
// Leads. Every function below is a thin, backend-agnostic wrapper.
// ---------------------------------------------------------------------------

export type { ClientFilters } from "@/lib/data/clients/repository";

function clientsRepository() {
  return selectRepository({ mock: mockClientsRepository, supabase: supabaseClientsRepository });
}

export async function getClients(filters: ClientFilters = {}): Promise<Client[]> {
  return clientsRepository().getClients(filters);
}

export async function getClientById(id: string): Promise<Client> {
  return clientsRepository().getClientById(id);
}

export async function createClient(input: ClientFormInput): Promise<DataResult<Client>> {
  return clientsRepository().createClient(input);
}

export async function updateClient(
  id: string,
  input: ClientFormInput,
): Promise<DataResult<Client>> {
  return clientsRepository().updateClient(id, input);
}

export async function updateClientStatus(
  id: string,
  status: ClientStatus,
): Promise<DataResult<Client>> {
  return clientsRepository().updateClientStatus(id, status);
}

export async function updateClientTags(id: string, tags: string[]): Promise<DataResult<Client>> {
  return clientsRepository().updateClientTags(id, tags);
}

export async function setClientVipStatus(
  id: string,
  isVip: boolean,
): Promise<DataResult<Client>> {
  return clientsRepository().setClientVipStatus(id, isVip);
}

export async function updateClientContactPreference(
  id: string,
  method: ContactMethod | null,
): Promise<DataResult<Client>> {
  return clientsRepository().updateClientContactPreference(id, method);
}

export async function archiveClient(id: string): Promise<DataResult<Client>> {
  return clientsRepository().archiveClient(id);
}

export async function restoreClient(id: string): Promise<DataResult<Client>> {
  return clientsRepository().restoreClient(id);
}

export async function getClientNextAction(clientId: string): Promise<string | null> {
  return clientsRepository().getClientNextAction(clientId);
}

// ---------------------------------------------------------------------------
// Events — the operational center of BloomOS. Every Event belongs to a
// Client (client_id is required; there is no such thing as an ownerless
// Event) and optionally preserves the Lead it originated from.
//
// status and lifecycle_stage are independent state machines (see
// core/workflows/eventWorkflow.ts) — each has its own setter and its own
// timeline activity type, never inferred from the other.
//
// The third business module with a live Supabase repository
// (lib/data/events/supabaseRepository.ts) alongside the original mock one
// (lib/data/events/mockRepository.ts) — same selectRepository() pattern as
// Leads/Clients. Bundles Events, Checklist, Schedule, and Event Notes/
// Timeline into one repository pair (lib/data/events/repository.ts) since
// every Checklist/Schedule/Note/Timeline operation needs the owning Event's
// workspace_id first. Every function below is a thin, backend-agnostic
// wrapper; neither this file nor any UI ever branches on data mode.
// ---------------------------------------------------------------------------

export type { EventFilters } from "@/lib/data/events/repository";

function eventsRepository() {
  return selectRepository({ mock: mockEventsRepository, supabase: supabaseEventsRepository });
}

export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  return eventsRepository().getEvents(filters);
}

export async function getEventById(id: string): Promise<Event> {
  return eventsRepository().getEventById(id);
}

export async function createEvent(input: EventFormInput): Promise<DataResult<Event>> {
  return eventsRepository().createEvent(input);
}

export async function updateEvent(id: string, input: EventFormInput): Promise<DataResult<Event>> {
  return eventsRepository().updateEvent(id, input);
}

export async function updateEventStatus(id: string, status: EventStatus): Promise<DataResult<Event>> {
  return eventsRepository().updateEventStatus(id, status);
}

export async function updateEventLifecycleStage(
  id: string,
  stage: EventLifecycleStage,
): Promise<DataResult<Event>> {
  return eventsRepository().updateEventLifecycleStage(id, stage);
}

export async function updateEventPriority(
  id: string,
  priority: EventPriority,
): Promise<DataResult<Event>> {
  return eventsRepository().updateEventPriority(id, priority);
}

export async function archiveEvent(id: string): Promise<DataResult<Event>> {
  return eventsRepository().archiveEvent(id);
}

export async function restoreEvent(id: string): Promise<DataResult<Event>> {
  return eventsRepository().restoreEvent(id);
}

export async function cancelEvent(id: string): Promise<DataResult<Event>> {
  return eventsRepository().cancelEvent(id);
}

export async function completeEvent(id: string): Promise<DataResult<Event>> {
  return eventsRepository().completeEvent(id);
}

export async function getEventNextAction(eventId: string): Promise<string | null> {
  return eventsRepository().getEventNextAction(eventId);
}

// ---------------------------------------------------------------------------
// Checklist — reusable across owner types (only "event" is a real owner
// today; see types/checklistItem.ts). Routes through eventsRepository(),
// same as Events above.
// ---------------------------------------------------------------------------

export async function getChecklistByEventId(eventId: string): Promise<ChecklistItem[]> {
  return eventsRepository().getChecklistByEventId(eventId);
}

export async function createChecklistItem(
  eventId: string,
  input: ChecklistItemInput,
): Promise<DataResult<ChecklistItem>> {
  return eventsRepository().createChecklistItem(eventId, input);
}

export async function updateChecklistItem(
  id: string,
  input: ChecklistItemInput,
): Promise<DataResult<ChecklistItem>> {
  return eventsRepository().updateChecklistItem(id, input);
}

export async function updateChecklistItemStatus(
  id: string,
  status: ChecklistStatus,
): Promise<DataResult<ChecklistItem>> {
  return eventsRepository().updateChecklistItemStatus(id, status);
}

export async function completeChecklistItem(id: string): Promise<DataResult<ChecklistItem>> {
  return eventsRepository().completeChecklistItem(id);
}

/** Refuses to delete a completed checklist item — it's part of the event's completed history, not a mistake to undo. */
export async function deleteChecklistItem(id: string): Promise<DataResult<null>> {
  return eventsRepository().deleteChecklistItem(id);
}

export async function reorderChecklistItems(
  eventId: string,
  orderedIds: string[],
): Promise<DataResult<ChecklistItem[]>> {
  return eventsRepository().reorderChecklistItems(eventId, orderedIds);
}

// ---------------------------------------------------------------------------
// Schedule — reusable across owner types, generalized the same way as
// Checklist (only "event" is a real owner today; see
// types/eventScheduleItem.ts). Routes through eventsRepository(), same as
// Events/Checklist above.
// ---------------------------------------------------------------------------

export async function getScheduleByEventId(eventId: string): Promise<EventScheduleItem[]> {
  return eventsRepository().getScheduleByEventId(eventId);
}

export async function createScheduleItem(
  eventId: string,
  input: ScheduleItemInput,
): Promise<DataResult<EventScheduleItem>> {
  return eventsRepository().createScheduleItem(eventId, input);
}

export async function updateScheduleItem(
  id: string,
  input: ScheduleItemInput,
): Promise<DataResult<EventScheduleItem>> {
  return eventsRepository().updateScheduleItem(id, input);
}

export async function updateScheduleItemStatus(
  id: string,
  status: ScheduleStatus,
): Promise<DataResult<EventScheduleItem>> {
  return eventsRepository().updateScheduleItemStatus(id, status);
}

export async function deleteScheduleItem(id: string): Promise<DataResult<null>> {
  return eventsRepository().deleteScheduleItem(id);
}

export async function reorderScheduleItems(
  eventId: string,
  orderedIds: string[],
): Promise<DataResult<EventScheduleItem[]>> {
  return eventsRepository().reorderScheduleItems(eventId, orderedIds);
}

// ---------------------------------------------------------------------------
// Event Notes and Timeline — routes through eventsRepository(), same as
// Events/Checklist/Schedule above, instead of the generic mock-only
// getNotesByOwner/createNoteForOwner/getTimelineByOwner helpers.
// ---------------------------------------------------------------------------

export async function getNotesByEventId(eventId: string): Promise<Note[]> {
  return eventsRepository().getNotesByEventId(eventId);
}

export async function createEventNote(eventId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return eventsRepository().createEventNote(eventId, input);
}

export async function getTimelineByEventId(eventId: string): Promise<TimelineActivity[]> {
  return eventsRepository().getTimelineByEventId(eventId);
}

// ---------------------------------------------------------------------------
// Media Library — the single reusable attachment system every module (Lead,
// Client, Event, and eventually Document, Contract, Invoice, Payment,
// Expense, Team/Client Knowledge Base, Notification, Automation) attaches
// files through via owner_type/owner_id. Infrastructure only: this file's
// wrappers are the same thin, backend-agnostic pattern as Events above, and
// this module knows nothing about any of the business modules that will
// eventually call it. See lib/data/media/repository.ts and
// src/lib/media/ownerTypes.ts for the full design.
// ---------------------------------------------------------------------------

export type {
  MediaAssetFilters,
  UploadMediaAssetInput,
  ReplaceMediaAssetVersionInput,
  MediaAssetDownload,
  MediaAssetDownloadUrl,
  MediaAssetChecksumVerification,
} from "@/lib/data/media/repository";

function mediaAssetsRepository() {
  return selectRepository({ mock: mockMediaAssetsRepository, supabase: supabaseMediaAssetsRepository });
}

export async function getMediaAssetById(id: string): Promise<MediaAsset> {
  return mediaAssetsRepository().getMediaAssetById(id);
}

export async function getMediaAssetsByOwner(
  ownerType: EntityType,
  ownerId: string,
  filters?: MediaAssetFilters,
): Promise<MediaAsset[]> {
  return mediaAssetsRepository().getMediaAssetsByOwner(ownerType, ownerId, filters);
}

export async function uploadMediaAsset(input: UploadMediaAssetInput): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().uploadMediaAsset(input);
}

export async function replaceMediaAssetVersion(
  id: string,
  input: ReplaceMediaAssetVersionInput,
): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().replaceMediaAssetVersion(id, input);
}

export async function downloadMediaAsset(id: string): Promise<DataResult<MediaAssetDownload>> {
  return mediaAssetsRepository().downloadMediaAsset(id);
}

export async function getMediaAssetDownloadUrl(
  id: string,
  expiresInSeconds?: number,
): Promise<DataResult<MediaAssetDownloadUrl>> {
  return mediaAssetsRepository().getMediaAssetDownloadUrl(id, expiresInSeconds);
}

export async function verifyMediaAssetChecksum(id: string): Promise<DataResult<MediaAssetChecksumVerification>> {
  return mediaAssetsRepository().verifyMediaAssetChecksum(id);
}

export async function deleteMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().deleteMediaAsset(id);
}

export async function restoreMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().restoreMediaAsset(id);
}

// ---------------------------------------------------------------------------
// Contracts — closes the commercial cycle: Lead -> Client -> Event ->
// Contract -> Invoice (future) -> Payments (future). Bundles Contracts,
// Contract Templates, Contract Exhibits, and Contract Notes/Timeline into
// one repository pair (lib/data/contracts/repository.ts) — same
// selectRepository() pattern as Leads/Clients/Events. Every function below
// is a thin, backend-agnostic wrapper; neither this file nor any UI ever
// branches on data mode.
// ---------------------------------------------------------------------------

export type { ContractFilters, ContractTemplateFilters } from "@/lib/data/contracts/repository";

function contractsRepository() {
  return selectRepository({ mock: mockContractsRepository, supabase: supabaseContractsRepository });
}

export async function getContracts(filters: ContractFilters = {}): Promise<Contract[]> {
  return contractsRepository().getContracts(filters);
}

export async function getContract(id: string): Promise<Contract> {
  return contractsRepository().getContract(id);
}

export async function createContract(input: ContractInput): Promise<DataResult<Contract>> {
  return contractsRepository().createContract(input);
}

export async function updateContract(id: string, input: ContractInput): Promise<DataResult<Contract>> {
  return contractsRepository().updateContract(id, input);
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<DataResult<Contract>> {
  return contractsRepository().updateContractStatus(id, status);
}

export async function sendContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().sendContract(id);
}

export async function markViewed(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().markViewed(id);
}

export async function markSigned(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().markSigned(id);
}

export async function markDeclined(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().markDeclined(id);
}

export async function expireContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().expireContract(id);
}

export async function cancelContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().cancelContract(id);
}

export async function completeContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().completeContract(id);
}

export async function archiveContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().archiveContract(id);
}

export async function restoreContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().restoreContract(id);
}

export async function duplicateContract(id: string): Promise<DataResult<Contract>> {
  return contractsRepository().duplicateContract(id);
}

export async function getContractNextAction(contractId: string): Promise<string | null> {
  return contractsRepository().getContractNextAction(contractId);
}

// ---------------------------------------------------------------------------
// Contract Notes and Timeline — routes through contractsRepository(), same
// as Events above, instead of the generic mock-only getNotesByOwner/
// createNoteForOwner/getTimelineByOwner helpers.
// ---------------------------------------------------------------------------

export async function getNotesByContractId(contractId: string): Promise<Note[]> {
  return contractsRepository().getNotesByContractId(contractId);
}

export async function createContractNote(
  contractId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  return contractsRepository().createContractNote(contractId, input);
}

export async function getTimelineByContractId(contractId: string): Promise<TimelineActivity[]> {
  return contractsRepository().getTimelineByContractId(contractId);
}

// ---------------------------------------------------------------------------
// Contract Templates — read-only in this phase ("No editor yet"). Routes
// through contractsRepository(), same as Contracts above.
// ---------------------------------------------------------------------------

export async function getContractTemplates(
  filters: ContractTemplateFilters = {},
): Promise<ContractTemplate[]> {
  return contractsRepository().getContractTemplates(filters);
}

export async function getContractTemplateById(id: string): Promise<ContractTemplate> {
  return contractsRepository().getContractTemplateById(id);
}

// ---------------------------------------------------------------------------
// Contract Exhibits — no document upload yet (document_id stays null until a
// Documents module exists). Read-only enforcement for locked/closed
// Contracts happens in the UI layer, same precedent as
// deleteScheduleItem/deleteChecklistItem. Routes through
// contractsRepository(), same as Contracts/Notes/Timeline above.
// ---------------------------------------------------------------------------

export async function getContractExhibitsByContractId(contractId: string): Promise<ContractExhibit[]> {
  return contractsRepository().getContractExhibitsByContractId(contractId);
}

export async function createContractExhibit(
  contractId: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  return contractsRepository().createContractExhibit(contractId, input);
}

export async function updateContractExhibit(
  id: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  return contractsRepository().updateContractExhibit(id, input);
}

export async function deleteContractExhibit(id: string): Promise<DataResult<null>> {
  return contractsRepository().deleteContractExhibit(id);
}

export async function reorderContractExhibits(
  contractId: string,
  orderedIds: string[],
): Promise<DataResult<ContractExhibit[]>> {
  return contractsRepository().reorderContractExhibits(contractId, orderedIds);
}

// ---------------------------------------------------------------------------
// Finance — continues the commercial cycle Contract closes: Lead -> Client ->
// Event -> Contract -> Invoice -> Payments -> Expenses -> Profit. Bundles
// Invoices, Payments, Expenses, and their Notes/Timeline into one repository
// pair (lib/data/finance/repository.ts) — same selectRepository() pattern as
// Leads/Clients/Events/Contracts. Every function below is a thin,
// backend-agnostic wrapper; neither this file nor any UI ever branches on
// data mode.
//
// Every money field across Invoice/Payment/Expense is an integer minor-unit
// amount (see lib/money.ts) — Contract.total_value/deposit_amount predate
// this model and remain plain major-unit numbers; Finance summaries convert
// through majorToMinor below rather than assuming Contract is already
// minor-unit.
//
// Invoice has no plain status setter (unlike Contract/Event) — every
// non-draft status is reached through its own dedicated action below or
// automatically when a successful Payment is applied (recompute_invoice_balance/
// applyPaymentToInvoice inside the repository). Payment/Expense each have
// their own independent state machine (core/workflows/paymentWorkflow.ts /
// expenseWorkflow.ts).
// ---------------------------------------------------------------------------

export type { InvoiceFilters, PaymentFilters, ExpenseFilters } from "@/lib/data/finance/repository";

function financeRepository() {
  return selectRepository({ mock: mockFinanceRepository, supabase: supabaseFinanceRepository });
}

export async function getInvoices(filters: InvoiceFilters = {}): Promise<Invoice[]> {
  return financeRepository().getInvoices(filters);
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  return financeRepository().getInvoiceById(id);
}

export async function createInvoice(input: InvoiceInput): Promise<DataResult<Invoice>> {
  return financeRepository().createInvoice(input);
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>> {
  return financeRepository().updateInvoice(id, input);
}

export async function issueInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().issueInvoice(id);
}

export async function sendInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().sendInvoice(id);
}

export async function markInvoiceViewed(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().markInvoiceViewed(id);
}

export async function markInvoiceOverdue(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().markInvoiceOverdue(id);
}

export async function voidInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().voidInvoice(id);
}

export async function archiveInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().archiveInvoice(id);
}

export async function restoreInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().restoreInvoice(id);
}

export async function duplicateInvoice(id: string): Promise<DataResult<Invoice>> {
  return financeRepository().duplicateInvoice(id);
}

export async function getInvoiceNextAction(invoiceId: string): Promise<string | null> {
  return financeRepository().getInvoiceNextAction(invoiceId);
}

export async function getPayments(filters: PaymentFilters = {}): Promise<Payment[]> {
  return financeRepository().getPayments(filters);
}

export async function getPaymentById(id: string): Promise<Payment> {
  return financeRepository().getPaymentById(id);
}

export async function createPayment(input: PaymentInput): Promise<DataResult<Payment>> {
  return financeRepository().createPayment(input);
}

export async function updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>> {
  return financeRepository().updatePayment(id, input);
}

export async function markPaymentProcessing(id: string): Promise<DataResult<Payment>> {
  return financeRepository().markPaymentProcessing(id);
}

export async function markPaymentSucceeded(id: string): Promise<DataResult<Payment>> {
  return financeRepository().markPaymentSucceeded(id);
}

export async function markPaymentFailed(id: string): Promise<DataResult<Payment>> {
  return financeRepository().markPaymentFailed(id);
}

export async function cancelPayment(id: string): Promise<DataResult<Payment>> {
  return financeRepository().cancelPayment(id);
}

export async function refundPayment(originalPaymentId: string, amountMinor: number): Promise<DataResult<Payment>> {
  return financeRepository().refundPayment(originalPaymentId, amountMinor);
}

export async function getPaymentRefundableAmount(paymentId: string): Promise<number> {
  return financeRepository().getPaymentRefundableAmount(paymentId);
}

export async function getPaymentNextAction(paymentId: string): Promise<string | null> {
  return financeRepository().getPaymentNextAction(paymentId);
}

export async function getExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  return financeRepository().getExpenses(filters);
}

export async function getExpenseById(id: string): Promise<Expense> {
  return financeRepository().getExpenseById(id);
}

export async function createExpense(input: ExpenseInput): Promise<DataResult<Expense>> {
  return financeRepository().createExpense(input);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<DataResult<Expense>> {
  return financeRepository().updateExpense(id, input);
}

export async function approveExpense(id: string): Promise<DataResult<Expense>> {
  return financeRepository().approveExpense(id);
}

export async function markExpenseDue(id: string): Promise<DataResult<Expense>> {
  return financeRepository().markExpenseDue(id);
}

export async function markExpensePaid(id: string): Promise<DataResult<Expense>> {
  return financeRepository().markExpensePaid(id);
}

export async function markExpenseReimbursed(id: string): Promise<DataResult<Expense>> {
  return financeRepository().markExpenseReimbursed(id);
}

export async function cancelExpense(id: string): Promise<DataResult<Expense>> {
  return financeRepository().cancelExpense(id);
}

export async function archiveExpense(id: string): Promise<DataResult<Expense>> {
  return financeRepository().archiveExpense(id);
}

export async function restoreExpense(id: string): Promise<DataResult<Expense>> {
  return financeRepository().restoreExpense(id);
}

export async function duplicateExpense(id: string): Promise<DataResult<Expense>> {
  return financeRepository().duplicateExpense(id);
}

export async function getExpenseNextAction(expenseId: string): Promise<string | null> {
  return financeRepository().getExpenseNextAction(expenseId);
}

/** planned/approved/due — the same set treated as "unpaid" in getDashboardMetrics' Unpaid Expenses count. */
const UNPAID_EXPENSE_STATUSES: ExpenseStatus[] = ["planned", "approved", "due"];

// ---------------------------------------------------------------------------
// Financial summaries
// ---------------------------------------------------------------------------

export async function getEventFinancialSummary(eventId: string): Promise<EventFinancialSummary> {
  const [contracts, invoices, payments, expenses] = await Promise.all([
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);
  return computeEventFinancialSummary(eventId, contracts, invoices, payments, expenses);
}

export async function getWorkspaceFinancialSummary(): Promise<WorkspaceFinancialSummary> {
  const [contracts, invoices, payments, expenses] = await Promise.all([
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);
  return computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses);
}

const INACTIVE_CONTRACT_STATUSES_FOR_STATUS: ContractStatus[] = ["cancelled", "declined", "expired", "archived"];

export async function getEventFinancialStatus(eventId: string): Promise<EventFinancialStatus> {
  // Every input here — Event, Contracts, Invoices, Payments, Expenses — is
  // now repository-routed (mock or Supabase), so this reflects live
  // Supabase data end to end in supabase mode.
  const [event, contracts, invoices, payments, expenses] = await Promise.all([
    getEventById(eventId),
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);

  const eventContracts = contracts.filter((c) => c.event_id === eventId);
  const activeContracts = eventContracts.filter((c) => !INACTIVE_CONTRACT_STATUSES_FOR_STATUS.includes(c.status));
  const eventInvoices = invoices.filter((i) => i.event_id === eventId && i.status !== "voided");
  const summary = computeEventFinancialSummary(eventId, contracts, invoices, payments, expenses);

  const eventCancelled =
    event.status === "cancelled" ||
    (eventContracts.length > 0 && eventContracts.every((c) => c.status === "cancelled" || c.status === "declined"));

  return deriveEventFinancialStatus({
    eventCancelled,
    hasActiveContract: activeContracts.length > 0,
    hasInvoice: eventInvoices.length > 0,
    hasOverdueInvoice: eventInvoices.some((i) => i.status === "overdue"),
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
  const [contract, allInvoices, allPayments] = await Promise.all([
    getContract(contractId),
    getInvoices({ includeArchived: true }),
    getPayments(),
  ]);

  const invoices = allInvoices.filter((i) => i.contract_id === contractId && i.status !== "voided");
  const totalInvoicedMinor = sumMinor(invoices.map((i) => i.total_minor));
  const totalCollectedMinor = sumMinor(invoices.map((i) => i.paid_minor));
  const outstandingMinor = sumMinor(invoices.map((i) => i.balance_minor));

  const depositRequiredMinor = contract.deposit_required ? majorToMinor(contract.deposit_amount ?? 0) : 0;
  const depositPaidMinor = sumMinor(
    allPayments
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
  const [contracts, invoices, payments, expenses, allEvents] = await Promise.all([
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
    getEvents({ includeArchived: true }),
  ]);
  const activeEvents = allEvents.filter((e) => e.status !== "archived");

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
// Invoice/Payment/Expense Notes and Timeline — routes through
// financeRepository(), same as Contract Notes/Timeline. No InvoiceNote/
// PaymentNote/ExpenseNote type.
// ---------------------------------------------------------------------------

export async function getNotesByInvoiceId(invoiceId: string): Promise<Note[]> {
  return financeRepository().getNotesByInvoiceId(invoiceId);
}

export async function createInvoiceNote(invoiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return financeRepository().createInvoiceNote(invoiceId, input);
}

export async function getTimelineByInvoiceId(invoiceId: string): Promise<TimelineActivity[]> {
  return financeRepository().getTimelineByInvoiceId(invoiceId);
}

export async function getNotesByPaymentId(paymentId: string): Promise<Note[]> {
  return financeRepository().getNotesByPaymentId(paymentId);
}

export async function createPaymentNote(paymentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return financeRepository().createPaymentNote(paymentId, input);
}

export async function getTimelineByPaymentId(paymentId: string): Promise<TimelineActivity[]> {
  return financeRepository().getTimelineByPaymentId(paymentId);
}

export async function getNotesByExpenseId(expenseId: string): Promise<Note[]> {
  return financeRepository().getNotesByExpenseId(expenseId);
}

export async function createExpenseNote(expenseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return financeRepository().createExpenseNote(expenseId, input);
}

export async function getTimelineByExpenseId(expenseId: string): Promise<TimelineActivity[]> {
  return financeRepository().getTimelineByExpenseId(expenseId);
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
  const [invoices, payments, expenses] = await Promise.all([
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);
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
  // Repository-routed (not a direct mock-store read) so this reflects live
  // Supabase checklist data in supabase mode — one getChecklistByEventId per
  // Event rather than a single workspace-wide read, since that's the
  // function every module (including this one) already routes through.
  const eventChecklistsByEvent = await Promise.all(events.map((event) => getChecklistByEventId(event.id)));
  const eventOwnedChecklistItems = eventChecklistsByEvent.flat();
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
 * Never imported by UI — createEvent() (lib/data/events/mockRepository.ts)
 * is the only real caller.
 */
export const __applyDefaultChecklistTemplateForTests = applyDefaultChecklistTemplateForTests;

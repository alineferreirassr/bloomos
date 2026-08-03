import type { Lead } from "@/types/lead";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Client } from "@/types/client";
import type { ClientExtensionSummary } from "@/types/clientExtensions";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { MediaAsset, MediaAssetMetadata } from "@/types/mediaAsset";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaCollection } from "@/types/mediaCollection";
import type { Contract } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import type {
  GeneralLedgerReport,
  TrialBalanceReport,
  ProfitAndLossReport,
  BalanceSheetReport,
} from "@/types/financeReport";
import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { CreateInventoryItemInput, InventoryItemInput, RecordInventoryMovementInput } from "@/modules/inventory/schema";
import type { Vendor } from "@/types/vendor";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import type { CreateVendorInput, UpdateVendorInput } from "@/modules/vendors/schema";
import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { CreatePurchaseInput, PurchaseInput, PurchaseItemInput, ReceivePurchaseItemInput } from "@/modules/purchases/schema";
import type { ServiceCategory } from "@/types/serviceCategory";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ServiceIncludedItem } from "@/types/serviceIncludedItem";
import type { ServiceAddOn } from "@/types/serviceAddOn";
import type { ServiceChecklistTemplateItem } from "@/types/serviceChecklistTemplateItem";
import type { ServiceTimelineTemplateItem } from "@/types/serviceTimelineTemplateItem";
import type { ServiceQuestionnaireQuestion } from "@/types/serviceQuestionnaireQuestion";
import type { ServiceBudgetTemplateLine } from "@/types/serviceBudgetTemplateLine";
import type { ServiceApprovalTemplateItem } from "@/types/serviceApprovalTemplateItem";
import type { ServiceTravelTemplateItem } from "@/types/serviceTravelTemplateItem";
import type { ServiceAiKnowledgeItem } from "@/types/serviceAiKnowledgeItem";
import type { ServiceRequiredDocument } from "@/types/serviceRequiredDocument";
import type { ServiceInventoryTemplateItem } from "@/types/serviceInventoryTemplateItem";
import type { ServicePurchaseTemplateItem } from "@/types/servicePurchaseTemplateItem";
import type { ServiceVendorSuggestion } from "@/types/serviceVendorSuggestion";
import type { ServiceTeamRoleRequirement } from "@/types/serviceTeamRoleRequirement";
import type { ServiceSeasonalWindow } from "@/types/serviceSeasonalWindow";
import type { ServiceCapabilityRequirement } from "@/types/serviceCapabilityRequirement";
import type { EventService } from "@/types/eventService";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceQuestionnaireResponse } from "@/types/eventServiceQuestionnaireResponse";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import type {
  ServiceCategoryInput,
  ServiceInput,
  ServiceVersionInput,
  PublishServiceVersionInput,
  ServiceIncludedItemInput,
  ServiceAddOnInput,
  ServiceChecklistTemplateItemInput,
  ServiceTimelineTemplateItemInput,
  ServiceQuestionnaireQuestionInput,
  ServiceBudgetTemplateLineInput,
  ServiceApprovalTemplateItemInput,
  ServiceTravelTemplateItemInput,
  ServiceAiKnowledgeItemInput,
  ServiceRequiredDocumentInput,
  ServiceInventoryTemplateItemInput,
  ServicePurchaseTemplateItemInput,
  ServiceVendorSuggestionInput,
  ServiceTeamRoleRequirementInput,
  ServiceSeasonalWindowInput,
  ServiceCapabilityRequirementInput,
  AssignServiceToEventInput,
  EventServiceQuestionnaireResponseInput,
  UpdateEventServiceOverridesInput,
} from "@/modules/services/schema";
import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation, WorkspaceInvitationWithToken, InvitationPreview } from "@/types/workspaceInvitation";
import type { ClientAccount, ClientAccountContext } from "@/types/clientAccount";
import type { ClientInvitation, ClientInvitationWithToken, ClientInvitationPreview } from "@/types/clientInvitation";
import type {
  ClientPortalEvent,
  ClientPortalContract,
  ClientPortalInvoice,
  ClientPortalInvoiceWithPayments,
  ClientPortalDocument,
  ClientPortalOverview,
} from "@/types/clientPortal";
import type { ClientPortalTimelineEntry } from "@/types/clientPortalTimeline";
import type { ClientPortalActivity, ClientPortalActivityKind } from "@/types/clientPortalActivity";
import { logClientPortalActivity, listClientPortalActivity } from "@/lib/data/clientPortal/clientPortalActivityStore";
import type { ClientPortalChecklistItem } from "@/types/clientPortalChecklist";
import {
  getClientPortalChecklist as getClientPortalChecklistService,
  completeClientPortalChecklistItem as completeClientPortalChecklistItemService,
  commentOnClientPortalChecklistItem as commentOnClientPortalChecklistItemService,
} from "@/lib/data/clientPortal/clientPortalChecklistService";
import type { ClientPortalMessage, ClientPortalMessageThread } from "@/types/clientPortalMessage";
import {
  getClientPortalThread as getClientPortalThreadService,
  getClientPortalMessages as getClientPortalMessagesService,
  sendClientPortalMessageAsClient as sendClientPortalMessageAsClientService,
  markClientPortalThreadReadForCurrentSession as markClientPortalThreadReadForCurrentSessionService,
} from "@/lib/data/clientPortal/clientPortalMessageService";
import type { Notification } from "@/core/notifications";
import { getCoreNotificationsService } from "@/core/notifications";
import { setClientDocumentApprovalStatus } from "@/lib/data/clientPortal/clientDocumentApprovalStore";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { Permission } from "@/core/enums/permission";
import type {
  CreateWorkspaceInvitationInput,
  WorkspaceInvitationFilters,
} from "@/lib/data/team/repository";
import type {
  CreateClientInvitationInput,
  ClientInvitationFilters,
} from "@/lib/data/clientAccess/repository";
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
import type { EventStatus, EventLifecycleStage } from "@/core/workflows/eventWorkflow";
import type { LeadFormInput } from "@/modules/leads/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { ClientFormInput } from "@/modules/clients/schema";
import type { EventFormInput, ScheduleItemInput } from "@/modules/events/schema";
import type { ChecklistItemInput } from "@/modules/checklist/schema";
import type { ContractInput, ContractExhibitInput } from "@/modules/contracts/schema";
import { computeContractStats } from "@/modules/contracts/contractStats";
import type {
  InvoiceInput,
  PaymentInput,
  ExpenseInput,
  ManualAdjustmentInput,
  PaymentSettlementInput,
  ExpenseTransitionInput,
  JournalEntryReversalInput,
  AccountingPeriodCreateInput,
} from "@/modules/finance/schema";
import type { DocumentMetadataInput, NewDocumentVersionInput, DocumentFolderInput } from "@/modules/documents/schema";
import {
  computeDocumentWorkspaceSummary,
  type DocumentOwnerSummary,
  type DocumentWorkspaceSummary,
} from "@/modules/documents/documentStats";
import type { FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";
import {
  computeEventFinancialSummary,
  computeClientFinancialSummary,
  computeWorkspaceFinancialSummary,
  computeAllTimeFinancialTotals,
  type EventFinancialSummary,
  type ClientFinancialSummary,
  type WorkspaceFinancialSummary,
} from "@/modules/finance/financialSummary";
import {
  getEventFinancialStatus as deriveEventFinancialStatus,
  type EventFinancialStatus,
} from "@/modules/finance/eventFinancialStatus";
import { sumMinor, majorToMinor, formatMoney } from "@/lib/money";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import type { LeadFilters } from "@/lib/data/leads/repository";
import { mockLeadsRepository } from "@/lib/data/leads/mockRepository";
import { supabaseLeadsRepository } from "@/lib/data/leads/supabaseRepository";
import type { ClientFilters, MarkClientRecoveryPendingInput } from "@/lib/data/clients/repository";
import { mockClientsRepository } from "@/lib/data/clients/mockRepository";
import { supabaseClientsRepository } from "@/lib/data/clients/supabaseRepository";
import { mockConversionRepository } from "@/lib/data/conversion/mockConversionRepository";
import { supabaseConversionRepository } from "@/lib/data/conversion/supabaseConversionRepository";
import { mockActivityRepository } from "@/lib/data/activity/mockRepository";
import { supabaseActivityRepository } from "@/lib/data/activity/supabaseRepository";
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
  MediaFolderFilters,
  MediaFolderInput,
  MediaFolderUpdateInput,
  MediaCollectionInput,
  MediaCollectionUpdateInput,
} from "@/lib/data/media/repository";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { supabaseMediaAssetsRepository } from "@/lib/data/media/supabaseRepository";
import type { ContractFilters, ContractTemplateFilters } from "@/lib/data/contracts/repository";
import { mockContractsRepository } from "@/lib/data/contracts/mockRepository";
import { supabaseContractsRepository } from "@/lib/data/contracts/supabaseRepository";
import type {
  InvoiceFilters,
  PaymentFilters,
  ExpenseFilters,
  ChartOfAccountFilters,
  JournalEntryFilters,
  AccountingPeriodFilters,
  GeneralLedgerReportFilters,
  TrialBalanceReportFilters,
  ProfitAndLossReportFilters,
  BalanceSheetReportFilters,
} from "@/lib/data/finance/repository";
import { mockFinanceRepository } from "@/lib/data/finance/mockRepository";
import { supabaseFinanceRepository } from "@/lib/data/finance/supabaseRepository";
import type {
  DocumentFilters,
  DocumentFolderFilters,
  DocumentFolderTreeNode,
  DocumentMetadataUpdateInput,
  DocumentReferenceType,
} from "@/lib/data/documents/repository";
import { mockDocumentsRepository } from "@/lib/data/documents/mockRepository";
import { supabaseDocumentsRepository } from "@/lib/data/documents/supabaseRepository";
import { mockTeamRepository, resetTeamMembersStore, resetWorkspaceInvitationsStore } from "@/lib/data/team/mockRepository";
import { supabaseTeamRepository } from "@/lib/data/team/supabaseRepository";
import { mockClientAccessRepository, resetClientAccountsStore, resetClientInvitationsStore } from "@/lib/data/clientAccess/mockRepository";
import { supabaseClientAccessRepository } from "@/lib/data/clientAccess/supabaseRepository";
import { mockClientPortalRepository } from "@/lib/data/clientPortal/mockRepository";
import { supabaseClientPortalRepository } from "@/lib/data/clientPortal/supabaseRepository";
import type { InventoryItemFilters, InventoryAvailability } from "@/lib/data/inventory/repository";
import { mockInventoryRepository } from "@/lib/data/inventory/mockRepository";
import { supabaseInventoryRepository } from "@/lib/data/inventory/supabaseRepository";
import type { VendorFilters, VendorSort } from "@/lib/data/vendors/repository";
import { mockVendorsRepository } from "@/lib/data/vendors/mockRepository";
import { supabaseVendorsRepository } from "@/lib/data/vendors/supabaseRepository";
import type { PurchaseFilters, PurchaseReceiptSummary } from "@/lib/data/purchases/repository";
import { mockPurchasesRepository } from "@/lib/data/purchases/mockRepository";
import { supabasePurchasesRepository } from "@/lib/data/purchases/supabaseRepository";
import type { ServiceFilters } from "@/lib/data/services/repository";
import { mockServicesRepository } from "@/lib/data/services/mockRepository";
import { supabaseServicesRepository } from "@/lib/data/services/supabaseRepository";
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
import { resetClientsStore } from "@/lib/data/mock/clientsStore";
import { resetEventsStore } from "@/lib/data/mock/eventsStore";
import { resetChecklistStore } from "@/lib/data/mock/checklistStore";
import { resetScheduleStore } from "@/lib/data/mock/scheduleStore";
import { resetContractsStore } from "@/lib/data/mock/contractsStore";
import { resetContractTemplatesStore } from "@/lib/data/mock/contractTemplatesStore";
import { resetContractExhibitsStore } from "@/lib/data/mock/contractExhibitsStore";
import { resetInvoicesStore } from "@/lib/data/mock/invoicesStore";
import { resetPaymentsStore } from "@/lib/data/mock/paymentsStore";
import { resetExpensesStore } from "@/lib/data/mock/expensesStore";
import { resetDocumentsStore } from "@/lib/data/mock/documentsStore";
import { resetDocumentFoldersStore } from "@/lib/data/mock/documentFoldersStore";
import { resetInventoryItemsStore } from "@/lib/data/mock/inventoryItemsStore";
import { resetInventoryMovementsStore } from "@/lib/data/mock/inventoryMovementsStore";
import { resetVendorsStore } from "@/lib/data/mock/vendorsStore";
import { resetPurchasesStore } from "@/lib/data/mock/purchasesStore";
import { resetPurchaseItemsStore } from "@/lib/data/mock/purchaseItemsStore";
import { resetServicesStore } from "@/lib/data/mock/servicesStore";
import { resetServiceTemplatesStore } from "@/lib/data/mock/serviceTemplatesStore";
import { resetEventServicesStore } from "@/lib/data/mock/eventServicesStore";
import { getFullName } from "@/lib/personName";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { clockNow } from "@/core/time/clock";
import { getLogger } from "@/core/observability/logger";
import type { AutomationTriggerType } from "@/types/automation";

/**
 * v2.0 Checkpoint 39 — the "dead trigger" fix. `client.created`,
 * `event.created`, `event.completed`, and `contract.signed` were real
 * `AutomationTriggerType` enum values with real Workflow Trigger nodes since
 * Checkpoint 9/13, but nothing ever actually called `dispatchAutomationTrigger`
 * for them outside the Stripe webhook / AI proposal / Client Portal paths —
 * a Workflow built on one of these could be designed, published, and
 * simulated, but never really ran. This repository layer has no member
 * session (see `PaymentActions.tsx`'s own direct client-side call of
 * `markPaymentSucceeded` — these mock functions are plain shared code, not
 * server-only), so — exactly like `webhookProcessing.ts`'s own
 * `dispatchPaymentEvent` — every dispatch here uses the same null "system"
 * `ExecuteAutomationContext`. Never lets a dispatch failure surface as a
 * mutation failure.
 */
function dispatchSystemTrigger(type: AutomationTriggerType, workspaceId: string, facts: Record<string, string | number | boolean | null>): void {
  dispatchAutomationTrigger(
    { type, workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
    { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
  ).catch((error: unknown) => getLogger().error(`${type} trigger dispatch failed`, { workspaceId, error: error instanceof Error ? error.message : "Unknown error" }));
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

export type BookLeadInput = Omit<EventFormInput, "client_id" | "originating_lead_id">;

export interface BookLeadResult {
  lead: Lead;
  client: Client;
  event: Event;
}

const BOOKING_WORKFLOW = "booking";

/**
 * The payload stored on a pending Booking recovery: the exact Event draft the
 * caller submitted, plus (only once an Event has actually been created)
 * `event_id` — so a later resumeBooking() that's only missing the
 * lifecycle-stage advance retries against that same Event instead of calling
 * createEvent again and leaving a duplicate behind.
 */
type BookingRecoveryPayload = BookLeadInput & { event_id?: string };

/**
 * Shared tail of bookLead/resumeBooking: ensures the Event exists (creating
 * it only if `existingEventId` isn't already known — see
 * BookingRecoveryPayload above) and advances it to "planning". On failure at
 * either step, the partial state is never silently left behind and never
 * rolled back across domains either — instead it's marked as a generic,
 * durable, auditable pending recovery on the Client (markClientRecoveryPending
 * + an internal_alert/critical Note), so the Booking Dashboard's Needs
 * Attention section can surface it and a caller can resumeBooking() later
 * instead of restarting the whole Lead conversion.
 */
async function finishBooking(
  lead: Lead,
  client: Client,
  eventInput: BookLeadInput,
  existingEventId?: string,
): Promise<DataResult<BookLeadResult>> {
  let eventId = existingEventId;

  if (!eventId) {
    const created = await createEvent({
      ...eventInput,
      client_id: client.id,
      originating_lead_id: lead.id,
    });
    if (!created.success) {
      const reason = `Creating the Event failed: ${created.error}`;
      const payload: BookingRecoveryPayload = { ...eventInput };
      await markClientRecoveryPending(client.id, { workflow: BOOKING_WORKFLOW, reason, payload });
      await createClientNote(client.id, {
        title: "Booking Incomplete",
        content: `Converting Lead "${getFullName(lead)}" to Client succeeded, but ${reason.toLowerCase()}. Resume booking from this Client instead of starting over.`,
        category: "internal_alert",
        priority: "critical",
      });
      return fail(
        `The Lead was converted to Client "${getFullName(client)}", but ${reason.toLowerCase()}. This is recorded as a pending recovery on the Client (see Needs Attention) — resume booking from there instead of starting over.`,
      );
    }
    eventId = created.data.id;
  }

  const planned = await updateEventLifecycleStage(eventId, "planning");
  if (!planned.success) {
    const reason = `Moving the Event to "Planning" failed: ${planned.error}`;
    const payload: BookingRecoveryPayload = { ...eventInput, event_id: eventId };
    await markClientRecoveryPending(client.id, { workflow: BOOKING_WORKFLOW, reason, payload });
    await createClientNote(client.id, {
      title: "Booking Incomplete",
      content: `The Event was created, but ${reason.toLowerCase()}. Resume booking from this Client instead of starting over.`,
      category: "internal_alert",
      priority: "critical",
    });
    return fail(
      `The Event was created, but ${reason.toLowerCase()}. This is recorded as a pending recovery on the Client (see Needs Attention) — resume booking from there instead of starting over.`,
    );
  }

  return ok({ lead, client, event: planned.data });
}

/**
 * Orchestrates the Commercial Pipeline's "Booked" transition (Booking
 * Workflow, Phase 2): converts the Lead to a Client (reusing an existing
 * Client by email match within the Workspace, per convertLeadToClient's own
 * dedup logic — never a duplicate), creates the linked Event, then advances
 * it straight to lifecycle_stage "planning" — the Operational Pipeline's own
 * starting column — so a newly-Booked Event never sits in the now-redundant
 * intake/proposal/booking stages the Commercial Pipeline already covered.
 *
 * Deliberately NOT a new database function — composes already-existing,
 * already-tested, already-permission-checked operations (convertLeadToClient,
 * createEvent, updateEventLifecycleStage), per "keep RPCs focused and
 * reusable." See finishBooking's own comment for what happens if Event
 * creation fails after a successful conversion.
 */
export async function bookLead(leadId: string, eventInput: BookLeadInput): Promise<DataResult<BookLeadResult>> {
  const conversion = await convertLeadToClient(leadId);
  if (!conversion.success) return conversion;

  return finishBooking(conversion.data.lead, conversion.data.client, eventInput);
}

/**
 * Resumes a booking that finishBooking previously marked as a pending
 * recovery — re-attempts the same createEvent -> "planning" tail (using
 * whatever eventInput the caller now provides, typically prefilled from the
 * Client's own pending_recovery.payload) without re-running Lead conversion.
 * On success, clears the pending recovery; on repeated failure, re-marks it
 * with a fresh Timeline entry so every attempt stays in the audit trail.
 */
export async function resumeBooking(
  clientId: string,
  eventInput: BookLeadInput,
): Promise<DataResult<BookLeadResult>> {
  let client: Client;
  try {
    client = await getClientById(clientId);
  } catch {
    return fail("Client not found.");
  }

  if (!client.pending_recovery || client.pending_recovery.workflow !== BOOKING_WORKFLOW) {
    return fail("This client has no pending Booking recovery to resume.");
  }
  if (!client.originating_lead_id) {
    return fail("This client has no originating Lead to resume booking for.");
  }

  const existingEventId = client.pending_recovery.payload.event_id;
  const lead = await getLeadById(client.originating_lead_id);
  const result = await finishBooking(
    lead,
    client,
    eventInput,
    typeof existingEventId === "string" ? existingEventId : undefined,
  );
  if (result.success) {
    await resolveClientRecoveryPending(clientId);
  }
  return result;
}

function activityRepository() {
  return selectRepository({ mock: mockActivityRepository, supabase: supabaseActivityRepository });
}

/**
 * Workspace-wide recent-activity feed (Booking Dashboard's "Recent Activity"
 * card, Booking Workflow Phase 2) — reads across every owner_type already
 * writing to the shared `timeline_activities` table, rather than one query
 * per Lead/Client/Event/Contract/Invoice/etc. No new writes; RLS unchanged.
 */
export async function getRecentActivity(limit?: number): Promise<TimelineActivity[]> {
  return activityRepository().getRecentActivity(limit);
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

  const documentResult = await documentsRepository().togglePinDocumentNote(noteId);
  if (documentResult !== null) return documentResult;

  const documentFolderResult = await documentsRepository().togglePinDocumentFolderNote(noteId);
  if (documentFolderResult !== null) return documentFolderResult;

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

export type { ClientFilters, MarkClientRecoveryPendingInput } from "@/lib/data/clients/repository";

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
  const result = await clientsRepository().createClient(input);
  if (result.success) {
    dispatchSystemTrigger("client.created", result.data.workspace_id, { clientId: result.data.id, clientName: `${result.data.first_name} ${result.data.last_name}` });
  }
  return result;
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

export async function markClientRecoveryPending(
  id: string,
  input: MarkClientRecoveryPendingInput,
): Promise<DataResult<Client>> {
  return clientsRepository().markClientRecoveryPending(id, input);
}

export async function resolveClientRecoveryPending(id: string): Promise<DataResult<Client>> {
  return clientsRepository().resolveClientRecoveryPending(id);
}

export async function getClientsWithPendingRecovery(workflow?: string): Promise<Client[]> {
  return clientsRepository().getClientsWithPendingRecovery(workflow);
}

export async function getClientNextAction(clientId: string): Promise<string | null> {
  return clientsRepository().getClientNextAction(clientId);
}

export async function getClientExtensionSummary(clientId: string): Promise<ClientExtensionSummary> {
  return clientsRepository().getClientExtensionSummary(clientId);
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
  const result = await eventsRepository().createEvent(input);
  if (result.success) {
    dispatchSystemTrigger("event.created", result.data.workspace_id, { eventId: result.data.id, clientId: result.data.client_id, title: result.data.title });
  }
  return result;
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
  const result = await eventsRepository().completeEvent(id);
  if (result.success) {
    dispatchSystemTrigger("event.completed", result.data.workspace_id, { eventId: result.data.id, clientId: result.data.client_id, title: result.data.title });
  }
  return result;
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

// Checkpoint 25 — Digital Asset Management Platform additions.

export async function listMediaAssetsForWorkspace(workspaceId: string, filters?: MediaAssetFilters): Promise<MediaAsset[]> {
  return mediaAssetsRepository().listMediaAssetsForWorkspace(workspaceId, filters);
}

export async function setMediaAssetFolder(id: string, folderId: string | null): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetFolder(id, folderId);
}

export async function setMediaAssetTags(id: string, tags: string[]): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetTags(id, tags);
}

export async function setMediaAssetColorLabel(id: string, colorLabel: string | null): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetColorLabel(id, colorLabel);
}

export async function setMediaAssetPriority(id: string, priority: "low" | "normal" | "high" | null): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetPriority(id, priority);
}

export async function setMediaAssetAiReady(id: string, aiReady: boolean): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetAiReady(id, aiReady);
}

export async function updateMediaAssetMetadata(id: string, patch: Partial<MediaAssetMetadata>): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().updateMediaAssetMetadata(id, patch);
}

export async function setMediaAssetStatus(
  id: string,
  status: MediaAssetStatus,
  actor: string,
  rejectionReason?: string | null,
  actorMemberId?: string | null,
): Promise<DataResult<MediaAsset>> {
  return mediaAssetsRepository().setMediaAssetStatus(id, status, actor, rejectionReason, actorMemberId);
}

export async function getMediaFolders(filters?: MediaFolderFilters): Promise<MediaFolder[]> {
  return mediaAssetsRepository().getMediaFolders(filters);
}

export async function getMediaFolderById(id: string): Promise<MediaFolder> {
  return mediaAssetsRepository().getMediaFolderById(id);
}

export async function createMediaFolder(input: MediaFolderInput): Promise<DataResult<MediaFolder>> {
  return mediaAssetsRepository().createMediaFolder(input);
}

export async function updateMediaFolder(id: string, input: MediaFolderUpdateInput): Promise<DataResult<MediaFolder>> {
  return mediaAssetsRepository().updateMediaFolder(id, input);
}

export async function moveMediaFolder(id: string, newParentFolderId: string | null): Promise<DataResult<MediaFolder>> {
  return mediaAssetsRepository().moveMediaFolder(id, newParentFolderId);
}

export async function archiveMediaFolder(id: string): Promise<DataResult<MediaFolder>> {
  return mediaAssetsRepository().archiveMediaFolder(id);
}

export async function restoreMediaFolder(id: string): Promise<DataResult<MediaFolder>> {
  return mediaAssetsRepository().restoreMediaFolder(id);
}

export async function getMediaCollections(): Promise<MediaCollection[]> {
  return mediaAssetsRepository().getMediaCollections();
}

export async function getMediaCollectionById(id: string): Promise<MediaCollection> {
  return mediaAssetsRepository().getMediaCollectionById(id);
}

export async function createMediaCollection(input: MediaCollectionInput): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().createMediaCollection(input);
}

export async function updateMediaCollection(id: string, input: MediaCollectionUpdateInput): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().updateMediaCollection(id, input);
}

export async function deleteMediaCollection(id: string): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().deleteMediaCollection(id);
}

export async function addAssetToCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().addAssetToCollection(collectionId, assetId);
}

export async function removeAssetFromCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().removeAssetFromCollection(collectionId, assetId);
}

export async function toggleMediaCollectionFavorite(id: string): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().toggleMediaCollectionFavorite(id);
}

export async function toggleMediaCollectionPinned(id: string): Promise<DataResult<MediaCollection>> {
  return mediaAssetsRepository().toggleMediaCollectionPinned(id);
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
  const result = await contractsRepository().markSigned(id);
  if (result.success) {
    dispatchSystemTrigger("contract.signed", result.data.workspace_id, { contractId: result.data.id, clientId: result.data.client_id });
  }
  return result;
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

export async function getContractExhibitById(id: string): Promise<ContractExhibit> {
  return contractsRepository().getContractExhibitById(id);
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

export type {
  InvoiceFilters,
  PaymentFilters,
  ExpenseFilters,
  ChartOfAccountFilters,
  JournalEntryFilters,
  AccountingPeriodFilters,
  GeneralLedgerReportFilters,
  TrialBalanceReportFilters,
  ProfitAndLossReportFilters,
  BalanceSheetReportFilters,
} from "@/lib/data/finance/repository";

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

/**
 * v2.0 Checkpoint 39 — the same "dead trigger" fix as `client.created`/
 * `event.created`/`event.completed`/`contract.signed` above, for
 * `invoice.paid`'s one remaining gap: `webhookProcessing.ts`'s own
 * `dispatchPaymentEvent` already dispatches it for the Stripe path, by
 * checking the resulting Invoice's own `status` after a payment lands
 * (Invoice transitions are computed by the repository itself, so re-reading
 * it is the only reliable way to know a given payment was the one that
 * finally paid it off). Mirrors that exact check for every payment recorded
 * directly in BloomOS (manual payments, non-Stripe methods).
 */
async function maybeDispatchInvoicePaid(invoiceId: string | null): Promise<void> {
  if (!invoiceId) return;
  const invoice = await financeRepository().getInvoiceById(invoiceId).catch(() => null);
  if (invoice?.status === "paid") {
    dispatchSystemTrigger("invoice.paid", invoice.workspace_id, { invoiceId: invoice.id, clientId: invoice.client_id, totalMinor: invoice.total_minor });
  }
}

export async function createPayment(input: PaymentInput): Promise<DataResult<Payment>> {
  const result = await financeRepository().createPayment(input);
  if (result.success) await maybeDispatchInvoicePaid(result.data.invoice_id);
  return result;
}

export async function updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>> {
  const result = await financeRepository().updatePayment(id, input);
  if (result.success) await maybeDispatchInvoicePaid(result.data.invoice_id);
  return result;
}

export async function markPaymentProcessing(id: string): Promise<DataResult<Payment>> {
  return financeRepository().markPaymentProcessing(id);
}

export async function markPaymentSucceeded(id: string): Promise<DataResult<Payment>> {
  const result = await financeRepository().markPaymentSucceeded(id);
  if (result.success) await maybeDispatchInvoicePaid(result.data.invoice_id);
  return result;
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

export async function getClientFinancialSummary(clientId: string): Promise<ClientFinancialSummary> {
  const [contracts, invoices, payments, expenses] = await Promise.all([
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);
  return computeClientFinancialSummary(clientId, contracts, invoices, payments, expenses);
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
// Finance Ledger (Repository Layer phase) — consumes the already-approved
// Finance Posting Engine RPCs; bundled into the same financeRepository()
// factory call above rather than a separate module, since it lives in the
// same lib/data/finance/ repository (see repository.ts's own doc comment).
// ---------------------------------------------------------------------------

export async function getChartOfAccounts(filters?: ChartOfAccountFilters): Promise<ChartOfAccount[]> {
  return financeRepository().listChartOfAccounts(filters);
}

export async function getChartOfAccount(id: string): Promise<ChartOfAccount> {
  return financeRepository().getChartOfAccount(id);
}

export async function getJournalEntries(filters?: JournalEntryFilters): Promise<JournalEntry[]> {
  return financeRepository().listJournalEntries(filters);
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  return financeRepository().getJournalEntry(id);
}

export async function getAccountingPeriods(filters?: AccountingPeriodFilters): Promise<AccountingPeriod[]> {
  return financeRepository().listAccountingPeriods(filters);
}

export async function getAccountingPeriod(id: string): Promise<AccountingPeriod> {
  return financeRepository().getAccountingPeriod(id);
}

export async function recordPaymentSettlement(input: PaymentSettlementInput): Promise<DataResult<Payment>> {
  return financeRepository().recordPaymentSettlement(input);
}

export async function recordExpenseTransition(expenseId: string, input: ExpenseTransitionInput): Promise<DataResult<Expense>> {
  return financeRepository().recordExpenseTransition(expenseId, input);
}

export async function recordManualAdjustment(input: ManualAdjustmentInput): Promise<DataResult<JournalEntry>> {
  return financeRepository().recordManualAdjustment(input);
}

export async function reverseJournalEntry(journalEntryId: string, input: JournalEntryReversalInput): Promise<DataResult<JournalEntry>> {
  return financeRepository().reverseJournalEntry(journalEntryId, input);
}

export async function createAccountingPeriod(input: AccountingPeriodCreateInput): Promise<DataResult<AccountingPeriod>> {
  return financeRepository().createAccountingPeriod(input);
}

export async function closeAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  return financeRepository().closeAccountingPeriod(id);
}

export async function lockAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  return financeRepository().lockAccountingPeriod(id);
}

// ---------------------------------------------------------------------------
// Finance Reports Foundation — derives exclusively from the ledger (journal_
// entries/journal_lines/chart_of_accounts), never from invoices/payments/
// expenses/purchases/inventory_movements directly. Cash Flow / AR Aging /
// AP Aging are not implemented in this phase — see docs/finance-reports.md's
// Deferred Reports section for the exact schema gap behind each one.
// ---------------------------------------------------------------------------

export async function getGeneralLedgerReport(filters: GeneralLedgerReportFilters): Promise<GeneralLedgerReport> {
  return financeRepository().getGeneralLedgerReport(filters);
}

export async function getTrialBalanceReport(filters: TrialBalanceReportFilters): Promise<TrialBalanceReport> {
  return financeRepository().getTrialBalanceReport(filters);
}

export async function getProfitAndLossReport(filters: ProfitAndLossReportFilters): Promise<ProfitAndLossReport> {
  return financeRepository().getProfitAndLossReport(filters);
}

export async function getBalanceSheetReport(filters: BalanceSheetReportFilters): Promise<BalanceSheetReport> {
  return financeRepository().getBalanceSheetReport(filters);
}

// ---------------------------------------------------------------------------
// Documents — the single shared file system for BloomOS. Every module
// (Client, Event, Contract, Contract Exhibit, Invoice, Payment, Expense,
// and the Workspace itself) attaches files through this one domain rather
// than a per-module upload system. A Document is business metadata only —
// the physical file is a MediaAsset (lib/data/media/), linked via
// media_asset_id, uploaded separately through the Shared Media Library
// rather than through any storage logic owned by this domain. Bundles
// Documents, Document Folders, and Document/Folder Notes/Timeline into one
// repository pair (lib/data/documents/repository.ts) — same
// selectRepository() pattern as every other module. Every function below
// is a thin, backend-agnostic wrapper; neither this file nor any UI ever
// branches on data mode.
// ---------------------------------------------------------------------------

export type {
  DocumentFilters,
  DocumentFolderFilters,
  DocumentFolderTreeNode,
  DocumentMetadataUpdateInput,
  DocumentReferenceType,
} from "@/lib/data/documents/repository";

function documentsRepository() {
  return selectRepository({ mock: mockDocumentsRepository, supabase: supabaseDocumentsRepository });
}

export async function getDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  return documentsRepository().getDocuments(filters);
}

export async function getDocumentById(id: string): Promise<Document> {
  return documentsRepository().getDocumentById(id);
}

export async function createDocumentMetadata(input: DocumentMetadataInput): Promise<DataResult<Document>> {
  return documentsRepository().createDocumentMetadata(input);
}

export async function updateDocumentMetadata(
  id: string,
  input: DocumentMetadataUpdateInput,
): Promise<DataResult<Document>> {
  return documentsRepository().updateDocumentMetadata(id, input);
}

export async function activateDocument(id: string): Promise<DataResult<Document>> {
  return documentsRepository().activateDocument(id);
}

export async function createDocumentVersion(input: NewDocumentVersionInput): Promise<DataResult<Document>> {
  return documentsRepository().createDocumentVersion(input);
}

export async function archiveDocument(id: string): Promise<DataResult<Document>> {
  return documentsRepository().archiveDocument(id);
}

export async function restoreDocument(id: string): Promise<DataResult<Document>> {
  return documentsRepository().restoreDocument(id);
}

export async function softDeleteDocument(id: string): Promise<DataResult<Document>> {
  return documentsRepository().softDeleteDocument(id);
}

export async function expireDocument(id: string): Promise<DataResult<Document>> {
  return documentsRepository().expireDocument(id);
}

export async function updateDocumentVisibility(id: string, visibility: DocumentVisibility): Promise<DataResult<Document>> {
  return documentsRepository().updateDocumentVisibility(id, visibility);
}

export async function moveDocumentToFolder(id: string, folderId: string | null): Promise<DataResult<Document>> {
  return documentsRepository().moveDocumentToFolder(id, folderId);
}

export async function getDocumentVersions(documentId: string): Promise<Document[]> {
  return documentsRepository().getDocumentVersions(documentId);
}

export async function getLatestDocumentVersion(documentId: string): Promise<Document> {
  return documentsRepository().getLatestDocumentVersion(documentId);
}

export async function getDocumentsByOwner(ownerType: EntityType, ownerId: string): Promise<Document[]> {
  return documentsRepository().getDocumentsByOwner(ownerType, ownerId);
}

export async function getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
  return documentsRepository().getDocumentsByCategory(category);
}

export async function getDocumentsByReference(
  referenceType: DocumentReferenceType,
  referenceId: string,
): Promise<Document[]> {
  return documentsRepository().getDocumentsByReference(referenceType, referenceId);
}

export async function getDocumentNextAction(documentId: string): Promise<string | null> {
  return documentsRepository().getDocumentNextAction(documentId);
}

export async function getDocumentOwnerSummary(ownerType: EntityType, ownerId: string): Promise<DocumentOwnerSummary> {
  return documentsRepository().getDocumentOwnerSummary(ownerType, ownerId);
}

export async function getWorkspaceDocumentSummary(): Promise<DocumentWorkspaceSummary> {
  return documentsRepository().getWorkspaceDocumentSummary();
}

export async function attachDocumentToContractExhibit(documentId: string, exhibitId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToContractExhibit(documentId, exhibitId);
}

export async function attachDocumentToPayment(documentId: string, paymentId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToPayment(documentId, paymentId);
}

export async function attachDocumentToExpense(documentId: string, expenseId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToExpense(documentId, expenseId);
}

export async function attachDocumentToInvoice(documentId: string, invoiceId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToInvoice(documentId, invoiceId);
}

export async function attachDocumentToEvent(documentId: string, eventId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToEvent(documentId, eventId);
}

export async function attachDocumentToClient(documentId: string, clientId: string): Promise<DataResult<Document>> {
  return documentsRepository().attachDocumentToClient(documentId, clientId);
}

// ---------------------------------------------------------------------------
// Document Folders — routes through documentsRepository(), same as
// Documents above.
// ---------------------------------------------------------------------------

export async function getDocumentFolders(filters: DocumentFolderFilters = {}): Promise<DocumentFolder[]> {
  return documentsRepository().getDocumentFolders(filters);
}

export async function getDocumentFolderById(id: string): Promise<DocumentFolder> {
  return documentsRepository().getDocumentFolderById(id);
}

export async function createDocumentFolder(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>> {
  return documentsRepository().createDocumentFolder(input);
}

export async function updateDocumentFolder(
  id: string,
  input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
): Promise<DataResult<DocumentFolder>> {
  return documentsRepository().updateDocumentFolder(id, input);
}

export async function moveDocumentFolder(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>> {
  return documentsRepository().moveDocumentFolder(id, newParentFolderId);
}

export async function archiveDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  return documentsRepository().archiveDocumentFolder(id);
}

export async function restoreDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  return documentsRepository().restoreDocumentFolder(id);
}

export async function getDocumentFolderTree(ownerType: EntityType, ownerId: string): Promise<DocumentFolderTreeNode[]> {
  return documentsRepository().getDocumentFolderTree(ownerType, ownerId);
}

export async function getDocumentFolderPath(id: string): Promise<DocumentFolder[]> {
  return documentsRepository().getDocumentFolderPath(id);
}

export async function applyDefaultFolderTemplate(input: {
  ownerType: EntityType;
  ownerId: string;
  templateKind: FolderTemplateKind;
  parentFolderId?: string | null;
}): Promise<DataResult<DocumentFolder[]>> {
  return documentsRepository().applyDefaultFolderTemplate(input);
}

// ---------------------------------------------------------------------------
// Document / Document Folder Notes and Timeline — routes through
// documentsRepository(), same as Documents above.
// ---------------------------------------------------------------------------

export async function getNotesByDocumentId(documentId: string): Promise<Note[]> {
  return documentsRepository().getNotesByDocumentId(documentId);
}

export async function createDocumentNote(documentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return documentsRepository().createDocumentNote(documentId, input);
}

export async function getTimelineByDocumentId(documentId: string): Promise<TimelineActivity[]> {
  return documentsRepository().getTimelineByDocumentId(documentId);
}

export async function getNotesByDocumentFolderId(folderId: string): Promise<Note[]> {
  return documentsRepository().getNotesByDocumentFolderId(folderId);
}

export async function createDocumentFolderNote(folderId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return documentsRepository().createDocumentFolderNote(folderId, input);
}

export async function getTimelineByDocumentFolderId(folderId: string): Promise<TimelineActivity[]> {
  return documentsRepository().getTimelineByDocumentFolderId(folderId);
}

// ---------------------------------------------------------------------------
// Team (members + invitations)
// ---------------------------------------------------------------------------

function teamRepository() {
  return selectRepository({ mock: mockTeamRepository, supabase: supabaseTeamRepository });
}

export async function getWorkspaceMembers(): Promise<TeamMember[]> {
  return teamRepository().getWorkspaceMembers();
}

export async function getWorkspaceMemberById(id: string): Promise<TeamMember> {
  return teamRepository().getWorkspaceMemberById(id);
}

export async function getCurrentWorkspaceMember(): Promise<TeamMember | null> {
  return teamRepository().getCurrentWorkspaceMember();
}

export async function updateWorkspaceMemberRole(id: string, role: WorkspaceMemberRole): Promise<DataResult<TeamMember>> {
  return teamRepository().updateWorkspaceMemberRole(id, role);
}

export async function deactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  return teamRepository().deactivateWorkspaceMember(id);
}

export async function reactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  return teamRepository().reactivateWorkspaceMember(id);
}

export async function removeWorkspaceMember(id: string): Promise<DataResult<null>> {
  return teamRepository().removeWorkspaceMember(id);
}

export async function getWorkspaceMemberPermissions(id: string): Promise<Permission[]> {
  return teamRepository().getWorkspaceMemberPermissions(id);
}

export async function canWorkspaceMember(id: string, permission: Permission): Promise<boolean> {
  return teamRepository().canWorkspaceMember(id, permission);
}

export async function getRolePermissions(role: WorkspaceMemberRole): Promise<Permission[]> {
  return teamRepository().getRolePermissions(role);
}

export async function getWorkspaceInvitations(filters: WorkspaceInvitationFilters = {}): Promise<WorkspaceInvitation[]> {
  return teamRepository().getWorkspaceInvitations(filters);
}

export async function getWorkspaceInvitationById(id: string): Promise<WorkspaceInvitation> {
  return teamRepository().getWorkspaceInvitationById(id);
}

export async function createWorkspaceInvitation(
  input: CreateWorkspaceInvitationInput,
): Promise<DataResult<WorkspaceInvitationWithToken>> {
  return teamRepository().createWorkspaceInvitation(input);
}

export async function resendWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitationWithToken>> {
  return teamRepository().resendWorkspaceInvitation(id);
}

export async function revokeWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitation>> {
  return teamRepository().revokeWorkspaceInvitation(id);
}

export async function acceptWorkspaceInvitation(token: string): Promise<DataResult<TeamMember>> {
  return teamRepository().acceptWorkspaceInvitation(token);
}

export async function expireWorkspaceInvitations(): Promise<void> {
  return teamRepository().expireWorkspaceInvitations();
}

export async function getInvitationByToken(token: string): Promise<InvitationPreview | null> {
  return teamRepository().getInvitationByToken(token);
}

export async function getInvitationStatus(id: string): Promise<InvitationStatus> {
  return teamRepository().getInvitationStatus(id);
}

export async function getInvitationNextAction(id: string): Promise<string | null> {
  return teamRepository().getInvitationNextAction(id);
}

export type { CreateWorkspaceInvitationInput, WorkspaceInvitationFilters } from "@/lib/data/team/repository";

// ---------------------------------------------------------------------------
// Client accounts + invitations
//
// Deliberately separate from Team above: a client account is never a
// workspace_members row, never carries an internal role, and never grants
// access to another Client's records. Foundation only — the full Client
// Portal (client-facing Events/Contracts/Invoices/Documents UI) is later,
// separately-scoped work. See docs/permissions.md.
// ---------------------------------------------------------------------------

function clientAccessRepository() {
  return selectRepository({ mock: mockClientAccessRepository, supabase: supabaseClientAccessRepository });
}

export async function getClientAccounts(clientId?: string): Promise<ClientAccount[]> {
  return clientAccessRepository().getClientAccounts(clientId);
}

export async function getClientAccountById(id: string): Promise<ClientAccount> {
  return clientAccessRepository().getClientAccountById(id);
}

export async function getClientAccountsByClientId(clientId: string): Promise<ClientAccount[]> {
  return clientAccessRepository().getClientAccountsByClientId(clientId);
}

export async function getClientAccountsForWorkspace(workspaceId: string): Promise<ClientAccount[]> {
  return clientAccessRepository().getClientAccountsForWorkspace(workspaceId);
}

export async function getCurrentClientAccount(): Promise<ClientAccount | null> {
  return clientAccessRepository().getCurrentClientAccount();
}

export async function getCurrentClientAccountContext(): Promise<ClientAccountContext | null> {
  return clientAccessRepository().getCurrentClientAccountContext();
}

export async function activateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  return clientAccessRepository().activateClientAccount(id);
}

export async function suspendClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  return clientAccessRepository().suspendClientAccount(id);
}

export async function reactivateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  return clientAccessRepository().reactivateClientAccount(id);
}

export async function revokeClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  return clientAccessRepository().revokeClientAccount(id);
}

export async function updateClientLastAccess(id: string): Promise<void> {
  return clientAccessRepository().updateClientLastAccess(id);
}

export async function canCurrentUserAccessClient(clientId: string): Promise<boolean> {
  return clientAccessRepository().canCurrentUserAccessClient(clientId);
}

export async function getClientInvitations(filters: ClientInvitationFilters = {}): Promise<ClientInvitation[]> {
  return clientAccessRepository().getClientInvitations(filters);
}

export async function getClientInvitationById(id: string): Promise<ClientInvitation> {
  return clientAccessRepository().getClientInvitationById(id);
}

export async function createClientInvitation(
  input: CreateClientInvitationInput,
): Promise<DataResult<ClientInvitationWithToken>> {
  return clientAccessRepository().createClientInvitation(input);
}

export async function resendClientInvitation(id: string): Promise<DataResult<ClientInvitationWithToken>> {
  return clientAccessRepository().resendClientInvitation(id);
}

export async function revokeClientInvitation(id: string): Promise<DataResult<ClientInvitation>> {
  return clientAccessRepository().revokeClientInvitation(id);
}

export async function acceptClientInvitation(token: string): Promise<DataResult<ClientAccount>> {
  return clientAccessRepository().acceptClientInvitation(token);
}

export async function expireClientInvitations(): Promise<void> {
  return clientAccessRepository().expireClientInvitations();
}

export async function getClientInvitationByToken(token: string): Promise<ClientInvitationPreview | null> {
  return clientAccessRepository().getClientInvitationByToken(token);
}

export async function getClientInvitationStatus(id: string): Promise<InvitationStatus> {
  return clientAccessRepository().getClientInvitationStatus(id);
}

export async function getClientInvitationNextAction(id: string): Promise<string | null> {
  return clientAccessRepository().getClientInvitationNextAction(id);
}

export type { CreateClientInvitationInput, ClientInvitationFilters } from "@/lib/data/clientAccess/repository";

// ---------------------------------------------------------------------------
// Client Portal (read-only, client-safe projections)
//
// Deliberately separate from every internal repository above — every
// function here is scoped by the new `*_select_client_account` RLS
// policies (Client Portal MVP), never by `requireWorkspaceSession()`,
// since a Client Portal caller never has a Workspace membership. Returns
// only the client-safe DTOs in types/clientPortal.ts, never an internal
// Event/Contract/Invoice/Payment/Document record. See docs/permissions.md.
// ---------------------------------------------------------------------------

function clientPortalRepository() {
  return selectRepository({ mock: mockClientPortalRepository, supabase: supabaseClientPortalRepository });
}

export async function getClientPortalOverview(): Promise<ClientPortalOverview> {
  return clientPortalRepository().getClientPortalOverview();
}

export async function getClientPortalEvents(): Promise<ClientPortalEvent[]> {
  return clientPortalRepository().getClientPortalEvents();
}

export async function getClientPortalEventById(id: string): Promise<ClientPortalEvent> {
  return clientPortalRepository().getClientPortalEventById(id);
}

export async function getClientPortalContracts(): Promise<ClientPortalContract[]> {
  return clientPortalRepository().getClientPortalContracts();
}

export async function getClientPortalContractById(id: string): Promise<ClientPortalContract> {
  return clientPortalRepository().getClientPortalContractById(id);
}

export async function getClientPortalInvoices(): Promise<ClientPortalInvoice[]> {
  return clientPortalRepository().getClientPortalInvoices();
}

export async function getClientPortalInvoiceById(id: string): Promise<ClientPortalInvoiceWithPayments> {
  return clientPortalRepository().getClientPortalInvoiceById(id);
}

export async function getClientPortalDocuments(): Promise<ClientPortalDocument[]> {
  return clientPortalRepository().getClientPortalDocuments();
}

export async function getClientPortalDocumentById(id: string): Promise<ClientPortalDocument> {
  return clientPortalRepository().getClientPortalDocumentById(id);
}

export async function getClientPortalDocumentDownloadUrl(id: string): Promise<DataResult<string>> {
  return clientPortalRepository().getClientPortalDocumentDownloadUrl(id);
}

export async function getClientPortalTimeline(): Promise<ClientPortalTimelineEntry[]> {
  return clientPortalRepository().getClientPortalTimeline();
}

/**
 * Checkpoint 14 — Activity logging is mock-only regardless of data mode
 * (see `clientPortalActivityStore.ts`'s own doc comment), but still needs
 * to resolve *which* client account is logging in via whichever
 * repository (mock or Supabase) the session actually authenticated
 * against — `getCurrentClientAccount()` above already does exactly that.
 * Silently no-ops without a session rather than throwing, since every
 * call site is a "log this in passing" side effect, never something a
 * page's own render should fail over.
 */
export async function logClientPortalActivityForCurrentSession(
  kind: ClientPortalActivityKind,
  entityId: string | null = null,
  entityLabel: string | null = null,
): Promise<void> {
  const account = await getCurrentClientAccount();
  if (!account) return;
  logClientPortalActivity(account.workspace_id, account.id, kind, entityId, entityLabel);
}

export async function getClientPortalActivity(): Promise<ClientPortalActivity[]> {
  const account = await getCurrentClientAccount();
  if (!account) return [];
  return listClientPortalActivity(account.workspace_id, account.id);
}

/**
 * Checkpoint 36, Step 17 — internal-team read of a specific Client Portal
 * account's own Activity log, for the new `ClientPortalActivitySection` on
 * Client Detail (`client_portal.view`). Distinct from `getClientPortalActivity`
 * above, which resolves the *current client's own* session — an internal
 * team member has no such session, so this takes the account directly.
 * UI-gated only (the component hides itself without the permission), the
 * same precedent `ClientAccessSection` already established on this page.
 */
export async function getClientPortalActivityForAccount(workspaceId: string, clientAccountId: string): Promise<ClientPortalActivity[]> {
  return listClientPortalActivity(workspaceId, clientAccountId);
}

export async function getClientPortalChecklist(): Promise<ClientPortalChecklistItem[]> {
  return getClientPortalChecklistService();
}

export async function completeClientPortalChecklistItem(id: string): Promise<DataResult<ClientPortalChecklistItem>> {
  return completeClientPortalChecklistItemService(id);
}

export async function commentOnClientPortalChecklistItem(id: string, comment: string): Promise<DataResult<ClientPortalChecklistItem>> {
  return commentOnClientPortalChecklistItemService(id, comment);
}

export async function getClientPortalThread(): Promise<ClientPortalMessageThread> {
  return getClientPortalThreadService();
}

export async function getClientPortalMessages(): Promise<ClientPortalMessage[]> {
  return getClientPortalMessagesService();
}

export async function sendClientPortalMessageAsClient(body: string): Promise<DataResult<ClientPortalMessage>> {
  return sendClientPortalMessageAsClientService(body);
}

export async function markClientPortalThreadReadForCurrentSession(): Promise<void> {
  return markClientPortalThreadReadForCurrentSessionService();
}

/**
 * Checkpoint 14, Step 9 — the Client Portal's own Notification Center.
 * Reuses the real, shared Notification module directly (`getCoreNotificationsService()`,
 * unchanged from every internal caller) rather than a parallel one —
 * `recipient_client_account_id` (added this checkpoint, see
 * `core/notifications/types.ts`'s own doc comment) is the one thing that
 * makes a client account a valid recipient at all.
 */
export async function getClientPortalNotifications(): Promise<Notification[]> {
  const account = await getCurrentClientAccount();
  if (!account) return [];
  const existing = await getCoreNotificationsService().getNotificationsForClientAccount(account.workspace_id, account.id);
  if (existing.length > 0) return existing;

  // Seeds a real, working demo notification the first time this specific client account's own Notification Center is ever read — never on module load (which would risk polluting the shared store other tests reset), and never more than once (guarded by `existing.length > 0` above).
  await getCoreNotificationsService().createInAppNotification(account.workspace_id, {
    recipientClientAccountId: account.id,
    title: "Welcome to your Client Portal",
    body: "You can track your event, documents, and invoices here any time.",
  });
  return getCoreNotificationsService().getNotificationsForClientAccount(account.workspace_id, account.id);
}

export async function markClientPortalNotificationRead(id: string): Promise<DataResult<Notification>> {
  return getCoreNotificationsService().markNotificationRead(id);
}

/**
 * Checkpoint 14, Step 4 — "Approve (placeholder), Reject (placeholder)."
 * Bolted onto `client_document_approvals` (mock-only, see
 * `clientDocumentApprovalStore.ts`'s own doc comment), never a new field
 * on the Document Platform's own `ComposedDocument` — a client's own
 * sentiment on a Document is a different axis from that Document's
 * draft/published/archived lifecycle (Checkpoint 12), and this checkpoint
 * never touches that lifecycle at all. Re-validates the Document is
 * actually one this client can see (`getClientPortalDocumentById` already
 * throws `NotFoundError` otherwise) before recording a decision.
 */
export async function approveClientPortalDocument(documentId: string, comment: string | null = null): Promise<DataResult<ClientPortalDocument>> {
  await getClientPortalDocumentById(documentId);
  const account = await getCurrentClientAccount();
  if (!account) return fail("No active client account.");
  setClientDocumentApprovalStatus(account.workspace_id, documentId, account.id, "approved", comment);
  return ok(await getClientPortalDocumentById(documentId));
}

export async function rejectClientPortalDocument(documentId: string, comment: string): Promise<DataResult<ClientPortalDocument>> {
  if (comment.trim().length === 0) return fail("Please fix the highlighted fields.", { comment: "Let us know why, so we can follow up" });
  await getClientPortalDocumentById(documentId);
  const account = await getCurrentClientAccount();
  if (!account) return fail("No active client account.");
  setClientDocumentApprovalStatus(account.workspace_id, documentId, account.id, "rejected", comment);
  return ok(await getClientPortalDocumentById(documentId));
}

/**
 * Checkpoint 14, Step 11 — "Proposal Summary," read-only. Surfaces the
 * client's own already-AI-authored `executive_summary` from their most
 * recently *accepted* Proposal — never triggers a new AI call, never
 * exposes Ask Bloom. `getProposalsRepository()` is always mock-only
 * regardless of data mode (see its own doc comment), same precedent as
 * the Timeline's own Proposal lookup; scoped to this client's own Events
 * only, one lookup per Event, exactly like `aggregateClientPortalTimeline`
 * already does.
 */
export async function getClientPortalProposalSummary(): Promise<{ proposalId: string; summary: string } | null> {
  const events = await getClientPortalEvents();
  const proposalsRepository = getProposalsRepository();
  for (const event of events) {
    const proposals = await proposalsRepository.getProposalsByEvent(event.id);
    const accepted = proposals.find((proposal) => proposal.status === "accepted");
    if (accepted) return { proposalId: accepted.id, summary: accepted.executive_summary };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inventory — foundation only (types, workflow, repository); no UI, no
// Supabase migration yet. `supabaseInventoryRepository` is a typed
// placeholder that throws rather than querying a table that doesn't exist
// or silently falling back to mock data in supabase mode.
// ---------------------------------------------------------------------------

export type { InventoryItemFilters, InventoryAvailability } from "@/lib/data/inventory/repository";

function inventoryRepository() {
  return selectRepository({ mock: mockInventoryRepository, supabase: supabaseInventoryRepository });
}

export async function listInventoryItems(filters: InventoryItemFilters = {}): Promise<InventoryItem[]> {
  return inventoryRepository().listInventoryItems(filters);
}

export async function getInventoryItem(id: string): Promise<InventoryItem> {
  return inventoryRepository().getInventoryItem(id);
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<DataResult<InventoryItem>> {
  return inventoryRepository().createInventoryItem(input);
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<DataResult<InventoryItem>> {
  return inventoryRepository().updateInventoryItem(id, input);
}

export async function archiveInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  return inventoryRepository().archiveInventoryItem(id);
}

export async function restoreInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  return inventoryRepository().restoreInventoryItem(id);
}

export async function recordInventoryMovement(
  inventoryItemId: string,
  input: RecordInventoryMovementInput,
): Promise<DataResult<InventoryMovement>> {
  return inventoryRepository().recordInventoryMovement(inventoryItemId, input);
}

export async function listInventoryMovements(inventoryItemId: string): Promise<InventoryMovement[]> {
  return inventoryRepository().listInventoryMovements(inventoryItemId);
}

export async function getInventoryAvailability(inventoryItemId: string): Promise<InventoryAvailability> {
  return inventoryRepository().getInventoryAvailability(inventoryItemId);
}

export async function getLowStockInventoryItems(): Promise<InventoryItem[]> {
  return inventoryRepository().getLowStockItems();
}

export async function getDamagedOrUnderRepairInventoryItems(): Promise<InventoryItem[]> {
  return inventoryRepository().getDamagedOrUnderRepairItems();
}

export async function getTimelineByInventoryItemId(inventoryItemId: string): Promise<TimelineActivity[]> {
  return inventoryRepository().getTimelineByInventoryItemId(inventoryItemId);
}

export async function getNotesByInventoryItemId(inventoryItemId: string): Promise<Note[]> {
  return inventoryRepository().getNotesByInventoryItemId(inventoryItemId);
}

export async function createInventoryItemNote(inventoryItemId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return inventoryRepository().createInventoryItemNote(inventoryItemId, input);
}

/** Normalizes the repository's "no note with this id" `null` into a DataResult failure, matching NotesSection's `Promise<DataResult<Note>>` mutation prop shape — same as updateVendorNote. */
export async function updateInventoryItemNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const result = await inventoryRepository().updateInventoryItemNote(noteId, input);
  return result ?? fail("Note not found.");
}

export async function toggleInventoryItemNotePin(noteId: string): Promise<DataResult<Note>> {
  const result = await inventoryRepository().toggleInventoryItemNotePin(noteId);
  return result ?? fail("Note not found.");
}

// ---------------------------------------------------------------------------
// Vendors — repository layer only; no UI yet. Both mock and Supabase
// repositories exist (unlike the earlier database-layer checkpoint, which
// deferred a mock repository since nothing consumed it) — every other
// module wired into this file requires both, so Vendors now matches that
// convention exactly.
// ---------------------------------------------------------------------------

export type { VendorFilters, VendorSort } from "@/lib/data/vendors/repository";

function vendorsRepository() {
  return selectRepository({ mock: mockVendorsRepository, supabase: supabaseVendorsRepository });
}

export async function getVendors(filters: VendorFilters = {}, sort: VendorSort = {}): Promise<Vendor[]> {
  return vendorsRepository().getVendors(filters, sort);
}

export async function getVendorById(id: string): Promise<Vendor> {
  return vendorsRepository().getVendorById(id);
}

export async function createVendor(input: CreateVendorInput): Promise<DataResult<Vendor>> {
  return vendorsRepository().createVendor(input);
}

export async function updateVendor(id: string, input: UpdateVendorInput): Promise<DataResult<Vendor>> {
  return vendorsRepository().updateVendor(id, input);
}

export async function archiveVendor(id: string): Promise<DataResult<Vendor>> {
  return vendorsRepository().archiveVendor(id);
}

export async function restoreVendor(id: string): Promise<DataResult<Vendor>> {
  return vendorsRepository().restoreVendor(id);
}

export async function setVendorStatus(id: string, status: VendorStatus): Promise<DataResult<Vendor>> {
  return vendorsRepository().setVendorStatus(id, status);
}

export async function setVendorPreferredStatus(id: string, isPreferred: boolean): Promise<DataResult<Vendor>> {
  return vendorsRepository().setVendorPreferredStatus(id, isPreferred);
}

export async function getTimelineByVendorId(vendorId: string): Promise<TimelineActivity[]> {
  return vendorsRepository().getTimelineByVendorId(vendorId);
}

export async function getNotesByVendorId(vendorId: string): Promise<Note[]> {
  return vendorsRepository().getNotesByVendorId(vendorId);
}

export async function createVendorNote(vendorId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return vendorsRepository().createVendorNote(vendorId, input);
}

/** Normalizes the repository's "no note with this id" `null` into a DataResult failure, matching NotesSection's `Promise<DataResult<Note>>` mutation prop shape. */
export async function updateVendorNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const result = await vendorsRepository().updateVendorNote(noteId, input);
  return result ?? fail("Note not found.");
}

export async function toggleVendorNotePin(noteId: string): Promise<DataResult<Note>> {
  const result = await vendorsRepository().toggleVendorNotePin(noteId);
  return result ?? fail("Note not found.");
}

// ---------------------------------------------------------------------------
// Purchases — foundation only (types, workflow, repository); no UI, no
// Supabase migration yet. `supabasePurchasesRepository` is a typed
// placeholder that throws rather than querying a table that doesn't exist
// or silently falling back to mock data in supabase mode — same convention
// as Inventory's own foundation phase.
// ---------------------------------------------------------------------------

export type { PurchaseFilters, PurchaseReceiptSummary } from "@/lib/data/purchases/repository";

function purchasesRepository() {
  return selectRepository({ mock: mockPurchasesRepository, supabase: supabasePurchasesRepository });
}

export async function listPurchases(filters: PurchaseFilters = {}): Promise<Purchase[]> {
  return purchasesRepository().listPurchases(filters);
}

export async function getPurchase(id: string): Promise<Purchase> {
  return purchasesRepository().getPurchase(id);
}

export async function createPurchase(input: CreatePurchaseInput): Promise<DataResult<Purchase>> {
  return purchasesRepository().createPurchase(input);
}

export async function updatePurchase(id: string, input: PurchaseInput): Promise<DataResult<Purchase>> {
  return purchasesRepository().updatePurchase(id, input);
}

export async function submitPurchase(id: string): Promise<DataResult<Purchase>> {
  return purchasesRepository().submitPurchase(id);
}

export async function cancelPurchase(id: string): Promise<DataResult<Purchase>> {
  return purchasesRepository().cancelPurchase(id);
}

export async function archivePurchase(id: string): Promise<DataResult<Purchase>> {
  return purchasesRepository().archivePurchase(id);
}

export async function restorePurchase(id: string): Promise<DataResult<Purchase>> {
  return purchasesRepository().restorePurchase(id);
}

export async function listPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  return purchasesRepository().listPurchaseItems(purchaseId);
}

export async function addPurchaseItem(purchaseId: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  return purchasesRepository().addPurchaseItem(purchaseId, input);
}

export async function updatePurchaseItem(id: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  return purchasesRepository().updatePurchaseItem(id, input);
}

export async function removePurchaseItem(id: string): Promise<DataResult<null>> {
  return purchasesRepository().removePurchaseItem(id);
}

export async function receivePurchaseItem(id: string, input: ReceivePurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  return purchasesRepository().receivePurchaseItem(id, input);
}

export async function getPurchaseReceiptSummary(purchaseId: string): Promise<PurchaseReceiptSummary> {
  return purchasesRepository().getPurchaseReceiptSummary(purchaseId);
}

export async function getPurchasesByVendorId(vendorId: string): Promise<Purchase[]> {
  return purchasesRepository().getPurchasesByVendorId(vendorId);
}

export async function getOpenPurchases(): Promise<Purchase[]> {
  return purchasesRepository().getOpenPurchases();
}

export async function getOverduePurchases(): Promise<Purchase[]> {
  return purchasesRepository().getOverduePurchases();
}

export async function getTimelineByPurchaseId(purchaseId: string): Promise<TimelineActivity[]> {
  return purchasesRepository().getTimelineByPurchaseId(purchaseId);
}

export async function getNotesByPurchaseId(purchaseId: string): Promise<Note[]> {
  return purchasesRepository().getNotesByPurchaseId(purchaseId);
}

export async function createPurchaseNote(purchaseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return purchasesRepository().createPurchaseNote(purchaseId, input);
}

/** Normalizes the repository's "no note with this id" `null` into a DataResult failure, matching updateVendorNote's exact shape. */
export async function updatePurchaseNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const result = await purchasesRepository().updatePurchaseNote(noteId, input);
  return result ?? fail("Note not found.");
}

export async function togglePurchaseNotePin(noteId: string): Promise<DataResult<Note>> {
  const result = await purchasesRepository().togglePurchaseNotePin(noteId);
  return result ?? fail("Note not found.");
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

// Despite the name, this is also the metrics source for the Documents page's summary
// cards (see DocumentsListView.tsx) — not solely the old /dashboard route. Keep in sync.
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

  const documents = await getDocuments({ includeArchived: true, includeDeleted: true });
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
// Services — Foundation phase (Phase 2a). Service/ServiceVersion (the
// versioned Blueprint), 17 normalized Template tables, and EventService
// (the Instance layer generated on assignment). Blueprint (Phase 2b) and
// Dependencies/Conflicts/Resource Packages/Service Health (Phase 2c) are
// not part of this contract yet — see docs/services.md.
// ---------------------------------------------------------------------------

function servicesRepository() {
  return selectRepository({ mock: mockServicesRepository, supabase: supabaseServicesRepository });
}

export async function listServiceCategories(includeArchived = false): Promise<ServiceCategory[]> {
  return servicesRepository().listServiceCategories(includeArchived);
}
export async function createServiceCategory(input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  return servicesRepository().createServiceCategory(input);
}
export async function updateServiceCategory(id: string, input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  return servicesRepository().updateServiceCategory(id, input);
}
export async function archiveServiceCategory(id: string): Promise<DataResult<ServiceCategory>> {
  return servicesRepository().archiveServiceCategory(id);
}

export async function listServices(filters: ServiceFilters = {}): Promise<Service[]> {
  return servicesRepository().listServices(filters);
}
export async function getService(id: string): Promise<Service> {
  return servicesRepository().getService(id);
}
export async function createService(input: ServiceInput): Promise<DataResult<Service>> {
  return servicesRepository().createService(input);
}
export async function updateService(id: string, input: ServiceInput): Promise<DataResult<Service>> {
  return servicesRepository().updateService(id, input);
}
export async function activateService(id: string): Promise<DataResult<Service>> {
  return servicesRepository().activateService(id);
}
export async function deactivateService(id: string): Promise<DataResult<Service>> {
  return servicesRepository().deactivateService(id);
}
export async function archiveService(id: string): Promise<DataResult<Service>> {
  return servicesRepository().archiveService(id);
}
export async function restoreService(id: string): Promise<DataResult<Service>> {
  return servicesRepository().restoreService(id);
}

export async function listServiceVersions(serviceId: string): Promise<ServiceVersion[]> {
  return servicesRepository().listServiceVersions(serviceId);
}
export async function getServiceVersion(id: string): Promise<ServiceVersion> {
  return servicesRepository().getServiceVersion(id);
}
export async function updateServiceVersionDraft(serviceId: string, input: ServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  return servicesRepository().updateServiceVersionDraft(serviceId, input);
}
export async function publishServiceVersion(serviceId: string, input: PublishServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  return servicesRepository().publishServiceVersion(serviceId, input);
}

export async function listServiceIncludedItems(serviceVersionId: string): Promise<ServiceIncludedItem[]> {
  return servicesRepository().listServiceIncludedItems(serviceVersionId);
}
export async function createServiceIncludedItem(serviceVersionId: string, input: ServiceIncludedItemInput): Promise<DataResult<ServiceIncludedItem>> {
  return servicesRepository().createServiceIncludedItem(serviceVersionId, input);
}
export async function updateServiceIncludedItem(id: string, input: ServiceIncludedItemInput): Promise<DataResult<ServiceIncludedItem>> {
  return servicesRepository().updateServiceIncludedItem(id, input);
}
export async function removeServiceIncludedItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceIncludedItem(id);
}

export async function listServiceAddOns(serviceVersionId: string): Promise<ServiceAddOn[]> {
  return servicesRepository().listServiceAddOns(serviceVersionId);
}
export async function createServiceAddOn(serviceVersionId: string, input: ServiceAddOnInput): Promise<DataResult<ServiceAddOn>> {
  return servicesRepository().createServiceAddOn(serviceVersionId, input);
}
export async function updateServiceAddOn(id: string, input: ServiceAddOnInput): Promise<DataResult<ServiceAddOn>> {
  return servicesRepository().updateServiceAddOn(id, input);
}
export async function removeServiceAddOn(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceAddOn(id);
}

export async function listServiceChecklistTemplateItems(serviceVersionId: string): Promise<ServiceChecklistTemplateItem[]> {
  return servicesRepository().listServiceChecklistTemplateItems(serviceVersionId);
}
export async function createServiceChecklistTemplateItem(serviceVersionId: string, input: ServiceChecklistTemplateItemInput): Promise<DataResult<ServiceChecklistTemplateItem>> {
  return servicesRepository().createServiceChecklistTemplateItem(serviceVersionId, input);
}
export async function updateServiceChecklistTemplateItem(id: string, input: ServiceChecklistTemplateItemInput): Promise<DataResult<ServiceChecklistTemplateItem>> {
  return servicesRepository().updateServiceChecklistTemplateItem(id, input);
}
export async function removeServiceChecklistTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceChecklistTemplateItem(id);
}

export async function listServiceTimelineTemplateItems(serviceVersionId: string): Promise<ServiceTimelineTemplateItem[]> {
  return servicesRepository().listServiceTimelineTemplateItems(serviceVersionId);
}
export async function createServiceTimelineTemplateItem(serviceVersionId: string, input: ServiceTimelineTemplateItemInput): Promise<DataResult<ServiceTimelineTemplateItem>> {
  return servicesRepository().createServiceTimelineTemplateItem(serviceVersionId, input);
}
export async function updateServiceTimelineTemplateItem(id: string, input: ServiceTimelineTemplateItemInput): Promise<DataResult<ServiceTimelineTemplateItem>> {
  return servicesRepository().updateServiceTimelineTemplateItem(id, input);
}
export async function removeServiceTimelineTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceTimelineTemplateItem(id);
}

export async function listServiceQuestionnaireQuestions(serviceVersionId: string): Promise<ServiceQuestionnaireQuestion[]> {
  return servicesRepository().listServiceQuestionnaireQuestions(serviceVersionId);
}
export async function createServiceQuestionnaireQuestion(serviceVersionId: string, input: ServiceQuestionnaireQuestionInput): Promise<DataResult<ServiceQuestionnaireQuestion>> {
  return servicesRepository().createServiceQuestionnaireQuestion(serviceVersionId, input);
}
export async function updateServiceQuestionnaireQuestion(id: string, input: ServiceQuestionnaireQuestionInput): Promise<DataResult<ServiceQuestionnaireQuestion>> {
  return servicesRepository().updateServiceQuestionnaireQuestion(id, input);
}
export async function removeServiceQuestionnaireQuestion(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceQuestionnaireQuestion(id);
}

export async function listServiceBudgetTemplateLines(serviceVersionId: string): Promise<ServiceBudgetTemplateLine[]> {
  return servicesRepository().listServiceBudgetTemplateLines(serviceVersionId);
}
export async function createServiceBudgetTemplateLine(serviceVersionId: string, input: ServiceBudgetTemplateLineInput): Promise<DataResult<ServiceBudgetTemplateLine>> {
  return servicesRepository().createServiceBudgetTemplateLine(serviceVersionId, input);
}
export async function updateServiceBudgetTemplateLine(id: string, input: ServiceBudgetTemplateLineInput): Promise<DataResult<ServiceBudgetTemplateLine>> {
  return servicesRepository().updateServiceBudgetTemplateLine(id, input);
}
export async function removeServiceBudgetTemplateLine(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceBudgetTemplateLine(id);
}

export async function listServiceApprovalTemplateItems(serviceVersionId: string): Promise<ServiceApprovalTemplateItem[]> {
  return servicesRepository().listServiceApprovalTemplateItems(serviceVersionId);
}
export async function createServiceApprovalTemplateItem(serviceVersionId: string, input: ServiceApprovalTemplateItemInput): Promise<DataResult<ServiceApprovalTemplateItem>> {
  return servicesRepository().createServiceApprovalTemplateItem(serviceVersionId, input);
}
export async function updateServiceApprovalTemplateItem(id: string, input: ServiceApprovalTemplateItemInput): Promise<DataResult<ServiceApprovalTemplateItem>> {
  return servicesRepository().updateServiceApprovalTemplateItem(id, input);
}
export async function removeServiceApprovalTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceApprovalTemplateItem(id);
}

export async function listServiceTravelTemplateItems(serviceVersionId: string): Promise<ServiceTravelTemplateItem[]> {
  return servicesRepository().listServiceTravelTemplateItems(serviceVersionId);
}
export async function createServiceTravelTemplateItem(serviceVersionId: string, input: ServiceTravelTemplateItemInput): Promise<DataResult<ServiceTravelTemplateItem>> {
  return servicesRepository().createServiceTravelTemplateItem(serviceVersionId, input);
}
export async function updateServiceTravelTemplateItem(id: string, input: ServiceTravelTemplateItemInput): Promise<DataResult<ServiceTravelTemplateItem>> {
  return servicesRepository().updateServiceTravelTemplateItem(id, input);
}
export async function removeServiceTravelTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceTravelTemplateItem(id);
}

export async function listServiceAiKnowledgeItems(serviceVersionId: string): Promise<ServiceAiKnowledgeItem[]> {
  return servicesRepository().listServiceAiKnowledgeItems(serviceVersionId);
}
export async function createServiceAiKnowledgeItem(serviceVersionId: string, input: ServiceAiKnowledgeItemInput): Promise<DataResult<ServiceAiKnowledgeItem>> {
  return servicesRepository().createServiceAiKnowledgeItem(serviceVersionId, input);
}
export async function updateServiceAiKnowledgeItem(id: string, input: ServiceAiKnowledgeItemInput): Promise<DataResult<ServiceAiKnowledgeItem>> {
  return servicesRepository().updateServiceAiKnowledgeItem(id, input);
}
export async function removeServiceAiKnowledgeItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceAiKnowledgeItem(id);
}

export async function listServiceRequiredDocuments(serviceVersionId: string): Promise<ServiceRequiredDocument[]> {
  return servicesRepository().listServiceRequiredDocuments(serviceVersionId);
}
export async function createServiceRequiredDocument(serviceVersionId: string, input: ServiceRequiredDocumentInput): Promise<DataResult<ServiceRequiredDocument>> {
  return servicesRepository().createServiceRequiredDocument(serviceVersionId, input);
}
export async function updateServiceRequiredDocument(id: string, input: ServiceRequiredDocumentInput): Promise<DataResult<ServiceRequiredDocument>> {
  return servicesRepository().updateServiceRequiredDocument(id, input);
}
export async function removeServiceRequiredDocument(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceRequiredDocument(id);
}

export async function listServiceInventoryTemplateItems(serviceVersionId: string): Promise<ServiceInventoryTemplateItem[]> {
  return servicesRepository().listServiceInventoryTemplateItems(serviceVersionId);
}
export async function createServiceInventoryTemplateItem(serviceVersionId: string, input: ServiceInventoryTemplateItemInput): Promise<DataResult<ServiceInventoryTemplateItem>> {
  return servicesRepository().createServiceInventoryTemplateItem(serviceVersionId, input);
}
export async function updateServiceInventoryTemplateItem(id: string, input: ServiceInventoryTemplateItemInput): Promise<DataResult<ServiceInventoryTemplateItem>> {
  return servicesRepository().updateServiceInventoryTemplateItem(id, input);
}
export async function removeServiceInventoryTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceInventoryTemplateItem(id);
}

export async function listServicePurchaseTemplateItems(serviceVersionId: string): Promise<ServicePurchaseTemplateItem[]> {
  return servicesRepository().listServicePurchaseTemplateItems(serviceVersionId);
}
export async function createServicePurchaseTemplateItem(serviceVersionId: string, input: ServicePurchaseTemplateItemInput): Promise<DataResult<ServicePurchaseTemplateItem>> {
  return servicesRepository().createServicePurchaseTemplateItem(serviceVersionId, input);
}
export async function updateServicePurchaseTemplateItem(id: string, input: ServicePurchaseTemplateItemInput): Promise<DataResult<ServicePurchaseTemplateItem>> {
  return servicesRepository().updateServicePurchaseTemplateItem(id, input);
}
export async function removeServicePurchaseTemplateItem(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServicePurchaseTemplateItem(id);
}

export async function listServiceVendorSuggestions(serviceVersionId: string): Promise<ServiceVendorSuggestion[]> {
  return servicesRepository().listServiceVendorSuggestions(serviceVersionId);
}
export async function createServiceVendorSuggestion(serviceVersionId: string, input: ServiceVendorSuggestionInput): Promise<DataResult<ServiceVendorSuggestion>> {
  return servicesRepository().createServiceVendorSuggestion(serviceVersionId, input);
}
export async function updateServiceVendorSuggestion(id: string, input: ServiceVendorSuggestionInput): Promise<DataResult<ServiceVendorSuggestion>> {
  return servicesRepository().updateServiceVendorSuggestion(id, input);
}
export async function removeServiceVendorSuggestion(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceVendorSuggestion(id);
}

export async function listServiceTeamRoleRequirements(serviceVersionId: string): Promise<ServiceTeamRoleRequirement[]> {
  return servicesRepository().listServiceTeamRoleRequirements(serviceVersionId);
}
export async function createServiceTeamRoleRequirement(serviceVersionId: string, input: ServiceTeamRoleRequirementInput): Promise<DataResult<ServiceTeamRoleRequirement>> {
  return servicesRepository().createServiceTeamRoleRequirement(serviceVersionId, input);
}
export async function updateServiceTeamRoleRequirement(id: string, input: ServiceTeamRoleRequirementInput): Promise<DataResult<ServiceTeamRoleRequirement>> {
  return servicesRepository().updateServiceTeamRoleRequirement(id, input);
}
export async function removeServiceTeamRoleRequirement(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceTeamRoleRequirement(id);
}

export async function listServiceSeasonalWindows(serviceVersionId: string): Promise<ServiceSeasonalWindow[]> {
  return servicesRepository().listServiceSeasonalWindows(serviceVersionId);
}
export async function createServiceSeasonalWindow(serviceVersionId: string, input: ServiceSeasonalWindowInput): Promise<DataResult<ServiceSeasonalWindow>> {
  return servicesRepository().createServiceSeasonalWindow(serviceVersionId, input);
}
export async function updateServiceSeasonalWindow(id: string, input: ServiceSeasonalWindowInput): Promise<DataResult<ServiceSeasonalWindow>> {
  return servicesRepository().updateServiceSeasonalWindow(id, input);
}
export async function removeServiceSeasonalWindow(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceSeasonalWindow(id);
}

export async function listServiceCapabilityRequirements(serviceVersionId: string): Promise<ServiceCapabilityRequirement[]> {
  return servicesRepository().listServiceCapabilityRequirements(serviceVersionId);
}
export async function createServiceCapabilityRequirement(serviceVersionId: string, input: ServiceCapabilityRequirementInput): Promise<DataResult<ServiceCapabilityRequirement>> {
  return servicesRepository().createServiceCapabilityRequirement(serviceVersionId, input);
}
export async function updateServiceCapabilityRequirement(id: string, input: ServiceCapabilityRequirementInput): Promise<DataResult<ServiceCapabilityRequirement>> {
  return servicesRepository().updateServiceCapabilityRequirement(id, input);
}
export async function removeServiceCapabilityRequirement(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeServiceCapabilityRequirement(id);
}

export async function listEventServicesByEvent(eventId: string): Promise<EventService[]> {
  return servicesRepository().listEventServicesByEvent(eventId);
}
export async function listEventServicesByService(serviceId: string): Promise<EventService[]> {
  return servicesRepository().listEventServicesByService(serviceId);
}
export async function getEventService(id: string): Promise<EventService> {
  return servicesRepository().getEventService(id);
}
export async function assignServiceToEvent(eventId: string, input: AssignServiceToEventInput): Promise<DataResult<EventService>> {
  return servicesRepository().assignServiceToEvent(eventId, input);
}
export async function removeEventService(id: string): Promise<DataResult<null>> {
  return servicesRepository().removeEventService(id);
}
export async function transitionEventServiceStatus(id: string, to: EventServiceStatus): Promise<DataResult<EventService>> {
  return servicesRepository().transitionEventServiceStatus(id, to);
}
export async function updateEventServiceOverrides(id: string, input: UpdateEventServiceOverridesInput): Promise<DataResult<EventService>> {
  return servicesRepository().updateEventServiceOverrides(id, input);
}
export async function getServiceUsageCounts(serviceIds: string[]): Promise<Record<string, number>> {
  return servicesRepository().getServiceUsageCounts(serviceIds);
}

export async function listEventServiceInventoryRequirements(eventServiceId: string): Promise<EventServiceInventoryRequirement[]> {
  return servicesRepository().listEventServiceInventoryRequirements(eventServiceId);
}
export async function fulfillEventServiceInventoryRequirement(id: string): Promise<DataResult<EventServiceInventoryRequirement>> {
  return servicesRepository().fulfillEventServiceInventoryRequirement(id);
}

export async function listEventServicePurchaseRequirements(eventServiceId: string): Promise<EventServicePurchaseRequirement[]> {
  return servicesRepository().listEventServicePurchaseRequirements(eventServiceId);
}
export async function linkEventServicePurchaseRequirementToPurchase(id: string, purchaseId: string): Promise<DataResult<EventServicePurchaseRequirement>> {
  return servicesRepository().linkEventServicePurchaseRequirementToPurchase(id, purchaseId);
}

export async function listEventServiceBudgetLines(eventServiceId: string): Promise<EventServiceBudgetLine[]> {
  return servicesRepository().listEventServiceBudgetLines(eventServiceId);
}
export async function listEventServiceTeamRequirements(eventServiceId: string): Promise<EventServiceTeamRequirement[]> {
  return servicesRepository().listEventServiceTeamRequirements(eventServiceId);
}

export async function listEventServiceVendorAssignments(eventServiceId: string): Promise<EventServiceVendorAssignment[]> {
  return servicesRepository().listEventServiceVendorAssignments(eventServiceId);
}
export async function confirmEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return servicesRepository().confirmEventServiceVendorAssignment(id);
}
export async function declineEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return servicesRepository().declineEventServiceVendorAssignment(id);
}

export async function listEventServiceQuestionnaireResponses(eventServiceId: string): Promise<EventServiceQuestionnaireResponse[]> {
  return servicesRepository().listEventServiceQuestionnaireResponses(eventServiceId);
}
export async function submitEventServiceQuestionnaireResponse(eventServiceId: string, input: EventServiceQuestionnaireResponseInput): Promise<DataResult<EventServiceQuestionnaireResponse>> {
  return servicesRepository().submitEventServiceQuestionnaireResponse(eventServiceId, input);
}

export async function getTimelineByServiceId(serviceId: string): Promise<TimelineActivity[]> {
  return servicesRepository().getTimelineByServiceId(serviceId);
}
export async function getNotesByServiceId(serviceId: string): Promise<Note[]> {
  return servicesRepository().getNotesByServiceId(serviceId);
}
export async function createServiceNote(serviceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return servicesRepository().createServiceNote(serviceId, input);
}
export async function updateServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  return servicesRepository().updateServiceNote(noteId, input);
}
export async function toggleServiceNotePin(noteId: string): Promise<DataResult<Note> | null> {
  return servicesRepository().toggleServiceNotePin(noteId);
}

export async function getTimelineByEventServiceId(eventServiceId: string): Promise<TimelineActivity[]> {
  return servicesRepository().getTimelineByEventServiceId(eventServiceId);
}
export async function getNotesByEventServiceId(eventServiceId: string): Promise<Note[]> {
  return servicesRepository().getNotesByEventServiceId(eventServiceId);
}
export async function createEventServiceNote(eventServiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  return servicesRepository().createEventServiceNote(eventServiceId, input);
}
/** Normalizes the repository's "no note with this id" `null` into a DataResult failure, matching updatePurchaseNote's/updateVendorNote's exact shape. */
export async function updateEventServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const result = await servicesRepository().updateEventServiceNote(noteId, input);
  return result ?? fail("Note not found.");
}
export async function toggleEventServiceNotePin(noteId: string): Promise<DataResult<Note>> {
  const result = await servicesRepository().toggleEventServiceNotePin(noteId);
  return result ?? fail("Note not found.");
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
  resetTeamMembersStore();
  resetWorkspaceInvitationsStore();
  resetClientAccountsStore();
  resetClientInvitationsStore();
  resetInventoryItemsStore();
  resetInventoryMovementsStore();
  resetVendorsStore();
  resetPurchasesStore();
  resetPurchaseItemsStore();
  resetServicesStore();
  resetServiceTemplatesStore();
  resetEventServicesStore();
}

/**
 * Test-only: exercises the internal default-checklist batch initializer
 * directly (e.g. to verify atomicity on a deliberately invalid template).
 * Never imported by UI — createEvent() (lib/data/events/mockRepository.ts)
 * is the only real caller.
 */
export const __applyDefaultChecklistTemplateForTests = applyDefaultChecklistTemplateForTests;

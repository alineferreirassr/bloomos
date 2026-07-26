import type { Database } from "@/types/database.types";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";
import type { Role } from "@/types/role";
import type { PermissionRecord, RolePermission } from "@/types/permissionRecord";
import type { WorkspaceInvitation } from "@/types/workspaceInvitation";
import type { Lead } from "@/types/lead";
import type { Client, ClientImportantDate } from "@/types/client";
import type { PendingRecovery } from "@/types/pendingRecovery";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Note, NoteAttachment } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { MediaAsset } from "@/types/mediaAsset";
import type { Contract, ContractVersionSnapshot } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Vendor } from "@/types/vendor";
import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import type { JournalEntry, JournalLine } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
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
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";
import type { Permission } from "@/core/enums/permission";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { LeadStatus } from "@/core/enums/leadStatus";
import type { ClientStatus } from "@/core/enums/clientStatus";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import type { PurchaseStatus } from "@/core/enums/purchaseStatus";
import type { InventoryItemType } from "@/core/enums/inventoryItemType";
import type { InventoryStatus } from "@/core/enums/inventoryStatus";
import type { InventoryCondition } from "@/core/enums/inventoryCondition";
import type { InventoryMovementType } from "@/core/enums/inventoryMovementType";
import type { ContactMethod } from "@/core/enums/contactMethod";
import type { EntityType } from "@/core/enums/entityType";
import type { EventType } from "@/core/enums/eventType";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import type { AssignedType } from "@/core/enums/assignedType";
import type { ScheduleCategory } from "@/core/enums/scheduleCategory";
import type { ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { NoteCategory } from "@/core/enums/noteCategory";
import type { NotePriority } from "@/core/enums/notePriority";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { ContractTemplateCategory } from "@/core/enums/contractTemplateCategory";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentType } from "@/core/enums/paymentType";
import type { AccountType } from "@/core/enums/accountType";
import type { NormalBalance } from "@/core/enums/normalBalance";
import type { PostingStatus } from "@/core/enums/postingStatus";
import type { AccountingPeriodStatus } from "@/core/enums/accountingPeriodStatus";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { PaymentMethod } from "@/core/enums/paymentMethod";
import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentStatus } from "@/core/enums/documentStatus";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { ServiceStatus } from "@/core/enums/serviceStatus";
import type { ServiceVersionStatus } from "@/core/enums/serviceVersionStatus";
import type { ServiceExperienceLevel } from "@/core/enums/serviceExperienceLevel";
import type { ServiceWeatherSensitivity } from "@/core/enums/serviceWeatherSensitivity";
import type { ServiceQuestionType } from "@/core/enums/serviceQuestionType";
import type { ServiceAiKnowledgeType } from "@/core/enums/serviceAiKnowledgeType";
import type { ServiceAiKnowledgeSeverity } from "@/core/enums/serviceAiKnowledgeSeverity";
import type { ServiceCapabilityType } from "@/core/enums/serviceCapabilityType";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import type { EventServiceVendorAssignmentStatus } from "@/core/enums/eventServiceVendorAssignmentStatus";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
type PermissionRow = Database["public"]["Tables"]["permissions"]["Row"];
type RolePermissionRow = Database["public"]["Tables"]["role_permissions"]["Row"];
type WorkspaceInvitationRow = Database["public"]["Tables"]["workspace_invitations"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ChecklistItemRow = Database["public"]["Tables"]["checklist_items"]["Row"];
type EventScheduleItemRow = Database["public"]["Tables"]["event_schedule_items"]["Row"];
type ContractTemplateRow = Database["public"]["Tables"]["contract_templates"]["Row"];
type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
type ContractExhibitRow = Database["public"]["Tables"]["contract_exhibits"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type TimelineActivityRow = Database["public"]["Tables"]["timeline_activities"]["Row"];
type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type DocumentFolderRow = Database["public"]["Tables"]["document_folders"]["Row"];
type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type PurchaseRow = Database["public"]["Tables"]["purchases"]["Row"];
type PurchaseItemRow = Database["public"]["Tables"]["purchase_items"]["Row"];
type InventoryItemRow = Database["public"]["Tables"]["inventory_items"]["Row"];
type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
type ChartOfAccountRow = Database["public"]["Tables"]["chart_of_accounts"]["Row"];
type JournalEntryRow = Database["public"]["Tables"]["journal_entries"]["Row"];
type JournalLineRow = Database["public"]["Tables"]["journal_lines"]["Row"];
type AccountingPeriodRow = Database["public"]["Tables"]["accounting_periods"]["Row"];
type ServiceCategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ServiceVersionRow = Database["public"]["Tables"]["service_versions"]["Row"];
type ServiceIncludedItemRow = Database["public"]["Tables"]["service_included_items"]["Row"];
type ServiceAddOnRow = Database["public"]["Tables"]["service_addons"]["Row"];
type ServiceChecklistTemplateItemRow = Database["public"]["Tables"]["service_checklist_template_items"]["Row"];
type ServiceTimelineTemplateItemRow = Database["public"]["Tables"]["service_timeline_template_items"]["Row"];
type ServiceQuestionnaireQuestionRow = Database["public"]["Tables"]["service_questionnaire_questions"]["Row"];
type ServiceBudgetTemplateLineRow = Database["public"]["Tables"]["service_budget_template_lines"]["Row"];
type ServiceApprovalTemplateItemRow = Database["public"]["Tables"]["service_approval_template_items"]["Row"];
type ServiceTravelTemplateItemRow = Database["public"]["Tables"]["service_travel_template_items"]["Row"];
type ServiceAiKnowledgeItemRow = Database["public"]["Tables"]["service_ai_knowledge_items"]["Row"];
type ServiceRequiredDocumentRow = Database["public"]["Tables"]["service_required_documents"]["Row"];
type ServiceInventoryTemplateItemRow = Database["public"]["Tables"]["service_inventory_template_items"]["Row"];
type ServicePurchaseTemplateItemRow = Database["public"]["Tables"]["service_purchase_template_items"]["Row"];
type ServiceVendorSuggestionRow = Database["public"]["Tables"]["service_vendor_suggestions"]["Row"];
type ServiceTeamRoleRequirementRow = Database["public"]["Tables"]["service_team_role_requirements"]["Row"];
type ServiceSeasonalWindowRow = Database["public"]["Tables"]["service_seasonal_windows"]["Row"];
type ServiceCapabilityRequirementRow = Database["public"]["Tables"]["service_capability_requirements"]["Row"];
type EventServiceRow = Database["public"]["Tables"]["event_services"]["Row"];
type EventServiceInventoryRequirementRow = Database["public"]["Tables"]["event_service_inventory_requirements"]["Row"];
type EventServicePurchaseRequirementRow = Database["public"]["Tables"]["event_service_purchase_requirements"]["Row"];
type EventServiceBudgetLineRow = Database["public"]["Tables"]["event_service_budget_lines"]["Row"];
type EventServiceTeamRequirementRow = Database["public"]["Tables"]["event_service_team_requirements"]["Row"];
type EventServiceVendorAssignmentRow = Database["public"]["Tables"]["event_service_vendor_assignments"]["Row"];
type EventServiceQuestionnaireResponseRow = Database["public"]["Tables"]["event_service_questionnaire_responses"]["Row"];

/**
 * Deliberate seam between raw database rows and domain types, even though
 * the shapes are ~identical today — this is where future column renames or
 * derived fields get absorbed without leaking the DB shape into callers.
 * Never pass a raw *Row straight through application code; always go
 * through one of these.
 */
export function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapWorkspaceRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapWorkspaceMemberRow(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role as WorkspaceMemberRole,
    status: row.status as WorkspaceMemberStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapRoleRow(row: RoleRow): Role {
  return {
    id: row.id as WorkspaceMemberRole,
    name: row.name,
    description: row.description,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapPermissionRow(row: PermissionRow): PermissionRecord {
  return {
    id: row.id as Permission,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapRolePermissionRow(row: RolePermissionRow): RolePermission {
  return {
    role_id: row.role_id,
    permission_id: row.permission_id as Permission,
    created_at: row.created_at,
  };
}

export function mapWorkspaceInvitationRow(row: WorkspaceInvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    email: row.email,
    invited_role: row.invited_role as WorkspaceMemberRole,
    invited_by: row.invited_by,
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_by: row.accepted_by,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapLeadRow(row: LeadRow): Lead {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    instagram: row.instagram,
    source: row.source,
    event_type: row.event_type,
    event_date: row.event_date,
    location: row.location,
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    message: row.message,
    status: row.status as LeadStatus,
    assigned_to: row.assigned_to,
    converted_client_id: row.converted_client_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    originating_lead_id: row.originating_lead_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    instagram: row.instagram,
    preferred_contact_method: row.preferred_contact_method as ContactMethod | null,
    partner_name: row.partner_name,
    relationship_status: row.relationship_status,
    important_dates: (row.important_dates as unknown as ClientImportantDate[] | null) ?? [],
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    source: row.source,
    tags: row.tags,
    internal_status: row.internal_status as ClientStatus,
    is_returning: row.is_returning,
    how_they_met: row.how_they_met,
    first_date: row.first_date,
    relationship_anniversary: row.relationship_anniversary,
    engagement_date: row.engagement_date,
    wedding_date: row.wedding_date,
    favorite_colors: row.favorite_colors,
    favorite_flowers: row.favorite_flowers,
    favorite_music: row.favorite_music,
    favorite_food: row.favorite_food,
    favorite_drinks: row.favorite_drinks,
    favorite_restaurants: row.favorite_restaurants,
    preferred_style: row.preferred_style,
    disliked_elements: row.disliked_elements,
    allergies: row.allergies,
    accessibility_needs: row.accessibility_needs,
    dietary_restrictions: row.dietary_restrictions,
    preferred_communication_time: row.preferred_communication_time,
    do_not_call: row.do_not_call,
    surprise_event_confidentiality: row.surprise_event_confidentiality,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    is_vip: row.is_vip,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    pending_recovery: (row.pending_recovery as unknown as PendingRecovery | null) ?? null,
  };
}

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    originating_lead_id: row.originating_lead_id,
    title: row.title,
    event_type: row.event_type as EventType,
    status: row.status as EventStatus,
    lifecycle_stage: row.lifecycle_stage as EventLifecycleStage,
    event_date: row.event_date,
    start_time: row.start_time,
    end_time: row.end_time,
    timezone: row.timezone,
    location_name: row.location_name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    latitude: row.latitude,
    longitude: row.longitude,
    guest_count: row.guest_count,
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    package_name: row.package_name,
    theme: row.theme,
    color_palette: row.color_palette,
    surprise_event: row.surprise_event,
    confidentiality_notes: row.confidentiality_notes,
    accessibility_notes: row.accessibility_notes,
    dietary_notes: row.dietary_notes,
    weather_plan: row.weather_plan,
    backup_location: row.backup_location,
    internal_summary: row.internal_summary,
    assigned_owner: row.assigned_owner,
    priority: row.priority as EventPriority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
  };
}

export function mapChecklistItemRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    category: row.category as ChecklistCategory,
    priority: row.priority as NotePriority,
    status: row.status as ChecklistStatus,
    due_date: row.due_date,
    completed_at: row.completed_at,
    assigned_type: row.assigned_type as AssignedType,
    assigned_id: row.assigned_id,
    assigned_name: row.assigned_name,
    sort_order: row.sort_order,
    source_event_service_id: row.source_event_service_id,
    template_snapshot: row.template_snapshot as unknown as ChecklistItem["template_snapshot"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventScheduleItemRow(row: EventScheduleItemRow): EventScheduleItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    assigned_to: row.assigned_to,
    category: row.category as ScheduleCategory,
    status: row.status as ScheduleStatus,
    sort_order: row.sort_order,
    source_event_service_id: row.source_event_service_id,
    template_snapshot: row.template_snapshot as unknown as EventScheduleItem["template_snapshot"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    title: row.title,
    content: row.content,
    category: row.category as NoteCategory,
    priority: row.priority as NotePriority,
    is_pinned: row.is_pinned,
    attachments: (row.attachments as unknown as NoteAttachment[] | null) ?? [],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMediaAssetRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    original_filename: row.original_filename,
    stored_filename: row.stored_filename,
    storage_bucket: row.storage_bucket,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    extension: row.extension,
    file_size: row.file_size,
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    duration: row.duration,
    version: row.version,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

/**
 * Maps a `documents` row into the domain `Document` shape. `mediaAssetRow`
 * is the joined `media_assets` row (via `documents.media_asset_id`), or
 * `null`/`undefined` when the Document has no file attached yet — every
 * storage-derived field (file_name, mime_type, size_bytes, storage_bucket,
 * storage_path, checksum) comes from here, never from `documents` itself,
 * which owns none of those columns. `storage_provider` is always
 * "supabase" here since this mapper only ever runs against real Supabase
 * rows.
 */
export function mapDocumentRow(row: DocumentRow, mediaAssetRow?: MediaAssetRow | null): Document {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    folder_id: row.folder_id,
    title: row.title,
    description: row.description,
    category: row.category as DocumentCategory,
    status: row.status as DocumentStatus,
    visibility: row.visibility as DocumentVisibility,
    media_asset_id: row.media_asset_id,
    file_name: mediaAssetRow ? mediaAssetRow.stored_filename : null,
    original_file_name: mediaAssetRow ? mediaAssetRow.original_filename : null,
    file_extension: mediaAssetRow ? mediaAssetRow.extension : null,
    mime_type: mediaAssetRow ? mediaAssetRow.mime_type : null,
    size_bytes: mediaAssetRow ? mediaAssetRow.file_size : null,
    storage_provider: "supabase",
    storage_bucket: mediaAssetRow ? mediaAssetRow.storage_bucket : null,
    storage_path: mediaAssetRow ? mediaAssetRow.storage_path : null,
    checksum: mediaAssetRow ? mediaAssetRow.checksum : null,
    version: row.version,
    is_latest_version: row.is_latest_version,
    parent_document_id: row.parent_document_id,
    contract_exhibit_id: row.contract_exhibit_id,
    event_id: row.event_id,
    client_id: row.client_id,
    contract_id: row.contract_id,
    invoice_id: row.invoice_id,
    payment_id: row.payment_id,
    expense_id: row.expense_id,
    uploaded_by: row.uploaded_by,
    uploaded_at: row.uploaded_at,
    expires_at: row.expires_at,
    archived_at: row.archived_at,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapDocumentFolderRow(row: DocumentFolderRow): DocumentFolder {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    parent_folder_id: row.parent_folder_id,
    name: row.name,
    description: row.description,
    sort_order: row.sort_order,
    visibility: row.visibility as DocumentVisibility,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapContractTemplateRow(row: ContractTemplateRow): ContractTemplate {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    category: row.category as ContractTemplateCategory,
    body: row.body,
    version: row.version,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapContractRow(row: ContractRow): Contract {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    event_id: row.event_id,
    template_id: row.template_id,
    contract_number: row.contract_number,
    title: row.title,
    description: row.description,
    status: row.status as ContractStatus,
    signature_status: row.signature_status as SignatureStatus,
    version: row.version,
    version_history: (row.version_history as unknown as ContractVersionSnapshot[] | null) ?? [],
    effective_date: row.effective_date,
    expiration_date: row.expiration_date,
    signed_at: row.signed_at,
    sent_at: row.sent_at,
    viewed_at: row.viewed_at,
    declined_at: row.declined_at,
    cancelled_at: row.cancelled_at,
    archived_at: row.archived_at,
    total_value: row.total_value,
    deposit_required: row.deposit_required,
    deposit_amount: row.deposit_amount,
    remaining_balance: row.remaining_balance,
    currency: row.currency,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapContractExhibitRow(row: ContractExhibitRow): ContractExhibit {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    contract_id: row.contract_id,
    title: row.title,
    description: row.description,
    display_order: row.display_order,
    document_id: row.document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    event_id: row.event_id,
    contract_id: row.contract_id,
    invoice_number: row.invoice_number,
    title: row.title,
    description: row.description,
    status: row.status as InvoiceStatus,
    issue_date: row.issue_date,
    due_date: row.due_date,
    subtotal_minor: row.subtotal_minor,
    tax_minor: row.tax_minor,
    discount_minor: row.discount_minor,
    total_minor: row.total_minor,
    paid_minor: row.paid_minor,
    balance_minor: row.balance_minor,
    currency: row.currency,
    notes: row.notes,
    sent_at: row.sent_at,
    viewed_at: row.viewed_at,
    paid_at: row.paid_at,
    overdue_at: row.overdue_at,
    voided_at: row.voided_at,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    invoice_id: row.invoice_id,
    client_id: row.client_id,
    event_id: row.event_id,
    contract_id: row.contract_id,
    payment_type: row.payment_type as PaymentType,
    status: row.status as PaymentStatus,
    amount_minor: row.amount_minor,
    currency: row.currency,
    payment_method: row.payment_method as PaymentMethod,
    reference: row.reference,
    transaction_date: row.transaction_date,
    received_at: row.received_at,
    failed_at: row.failed_at,
    refunded_at: row.refunded_at,
    notes: row.notes,
    document_id: row.document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_id: row.event_id,
    client_id: row.client_id,
    contract_id: row.contract_id,
    supplier_id: row.supplier_id,
    team_member_id: row.team_member_id,
    category: row.category as ExpenseCategory,
    status: row.status as ExpenseStatus,
    description: row.description,
    amount_minor: row.amount_minor,
    currency: row.currency,
    transaction_date: row.transaction_date,
    due_date: row.due_date,
    paid_at: row.paid_at,
    reimbursable: row.reimbursable,
    reimbursed_at: row.reimbursed_at,
    reference: row.reference,
    notes: row.notes,
    document_id: row.document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapTimelineActivityRow(row: TimelineActivityRow): TimelineActivity {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_type: row.owner_type as EntityType,
    owner_id: row.owner_id,
    type: row.type as TimelineActivityType,
    description: row.description,
    actor: row.actor,
    timestamp: row.timestamp,
    ...(row.metadata
      ? { metadata: row.metadata as unknown as Record<string, string | number | boolean | null> }
      : {}),
  };
}

export function mapVendorRow(row: VendorRow): Vendor {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    company_name: row.company_name,
    display_name: row.display_name,
    contact_person: row.contact_person,
    email: row.email,
    phone: row.phone,
    website: row.website,
    tax_id: row.tax_id,
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    country: row.country,
    notes: row.notes,
    status: row.status as VendorStatus,
    tags: row.tags,
    default_currency: row.default_currency,
    payment_terms: row.payment_terms,
    is_preferred: row.is_preferred,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    category: row.category,
    subcategory: row.subcategory,
    item_type: row.item_type as InventoryItemType,
    tags: row.tags,
    status: row.status as InventoryStatus,
    condition: row.condition as InventoryCondition | null,
    unit_of_measure: row.unit_of_measure,
    quantity_on_hand: row.quantity_on_hand,
    quantity_available: row.quantity_available,
    quantity_reserved: row.quantity_reserved,
    reorder_level: row.reorder_level,
    target_stock_level: row.target_stock_level,
    unit_cost: row.unit_cost,
    replacement_cost: row.replacement_cost,
    rental_value: row.rental_value,
    storage_location: row.storage_location,
    bin_location: row.bin_location,
    primary_vendor_id: row.primary_vendor_id,
    purchase_date: row.purchase_date,
    last_inventory_check_at: row.last_inventory_check_at,
    notes: row.notes,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapInventoryMovementRow(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    inventory_item_id: row.inventory_item_id,
    movement_type: row.movement_type as InventoryMovementType,
    quantity: row.quantity,
    quantity_before: row.quantity_before,
    quantity_after: row.quantity_after,
    reason: row.reason,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    performed_by: row.performed_by,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
  };
}

export function mapPurchaseRow(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    vendor_id: row.vendor_id,
    purchase_number: row.purchase_number,
    status: row.status as PurchaseStatus,
    order_date: row.order_date,
    expected_delivery_date: row.expected_delivery_date,
    actual_received_date: row.actual_received_date,
    currency: row.currency,
    subtotal_minor: row.subtotal_minor,
    tax_minor: row.tax_minor,
    shipping_minor: row.shipping_minor,
    discount_minor: row.discount_minor,
    total_minor: row.total_minor,
    notes: row.notes,
    vendor_reference: row.vendor_reference,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapPurchaseItemRow(row: PurchaseItemRow): PurchaseItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    purchase_id: row.purchase_id,
    inventory_item_id: row.inventory_item_id,
    name: row.name,
    sku: row.sku,
    quantity_ordered: row.quantity_ordered,
    quantity_received: row.quantity_received,
    unit_cost_minor: row.unit_cost_minor,
    line_subtotal_minor: row.line_subtotal_minor,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapChartOfAccountRow(row: ChartOfAccountRow): ChartOfAccount {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    account_number: row.account_number,
    name: row.name,
    account_type: row.account_type as AccountType,
    normal_balance: row.normal_balance as NormalBalance,
    parent_account_id: row.parent_account_id,
    description: row.description,
    is_system: row.is_system,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

/** lines/account enrichment is deliberately not set here — getJournalEntry attaches them separately after its own join, matching JournalEntry's own doc comment. */
export function mapJournalEntryRow(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    entry_date: row.entry_date,
    accounting_period_id: row.accounting_period_id,
    source_type: row.source_type,
    source_id: row.source_id,
    posting_key: row.posting_key,
    memo: row.memo,
    currency: row.currency,
    reversed_by_entry_id: row.reversed_by_entry_id,
    reverses_entry_id: row.reverses_entry_id,
    posting_status: row.posting_status as PostingStatus,
    failure_reason: row.failure_reason,
    posted_by: row.posted_by,
    created_at: row.created_at,
  };
}

export function mapJournalLineRow(row: JournalLineRow): JournalLine {
  return {
    id: row.id,
    journal_entry_id: row.journal_entry_id,
    workspace_id: row.workspace_id,
    account_id: row.account_id,
    debit_minor: row.debit_minor,
    credit_minor: row.credit_minor,
    currency: row.currency,
    amount_in_base_currency_minor: row.amount_in_base_currency_minor,
    line_memo: row.line_memo,
    line_order: row.line_order,
    created_at: row.created_at,
  };
}

export function mapAccountingPeriodRow(row: AccountingPeriodRow): AccountingPeriod {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    period_start: row.period_start,
    period_end: row.period_end,
    status: row.status as AccountingPeriodStatus,
    closed_at: row.closed_at,
    closed_by: row.closed_by,
    locked_at: row.locked_at,
    locked_by: row.locked_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceCategoryRow(row: ServiceCategoryRow): ServiceCategory {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    status: row.status as ServiceStatus,
    draft_version_id: row.draft_version_id,
    current_published_version_id: row.current_published_version_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapServiceVersionRow(row: ServiceVersionRow): ServiceVersion {
  return {
    id: row.id,
    service_id: row.service_id,
    workspace_id: row.workspace_id,
    version_number: row.version_number,
    status: row.status as ServiceVersionStatus,
    name_snapshot: row.name_snapshot,
    description_snapshot: row.description_snapshot,
    base_price_minor: row.base_price_minor,
    currency: row.currency,
    setup_duration_minutes: row.setup_duration_minutes,
    breakdown_duration_minutes: row.breakdown_duration_minutes,
    difficulty_score: row.difficulty_score,
    experience_level_required: row.experience_level_required as ServiceExperienceLevel | null,
    weather_sensitivity: row.weather_sensitivity as ServiceWeatherSensitivity,
    surprise_friendly: row.surprise_friendly,
    estimated_profit_minor: row.estimated_profit_minor,
    change_summary: row.change_summary,
    published_at: row.published_at,
    published_by: row.published_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceIncludedItemRow(row: ServiceIncludedItemRow): ServiceIncludedItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    description: row.description,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceAddOnRow(row: ServiceAddOnRow): ServiceAddOn {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    description: row.description,
    price_delta_minor: row.price_delta_minor,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceChecklistTemplateItemRow(row: ServiceChecklistTemplateItemRow): ServiceChecklistTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    title: row.title,
    description: row.description,
    category: row.category as ChecklistCategory,
    priority: row.priority as NotePriority,
    due_offset_days: row.due_offset_days,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceTimelineTemplateItemRow(row: ServiceTimelineTemplateItemRow): ServiceTimelineTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    title: row.title,
    description: row.description,
    category: row.category as ScheduleCategory,
    offset_minutes_from_event_start: row.offset_minutes_from_event_start,
    duration_minutes: row.duration_minutes,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceQuestionnaireQuestionRow(row: ServiceQuestionnaireQuestionRow): ServiceQuestionnaireQuestion {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    question_text: row.question_text,
    question_type: row.question_type as ServiceQuestionType,
    is_required: row.is_required,
    options: row.options,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceBudgetTemplateLineRow(row: ServiceBudgetTemplateLineRow): ServiceBudgetTemplateLine {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    category: row.category,
    estimated_revenue_minor: row.estimated_revenue_minor,
    estimated_cost_minor: row.estimated_cost_minor,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceApprovalTemplateItemRow(row: ServiceApprovalTemplateItemRow): ServiceApprovalTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    description: row.description,
    days_before_event_deadline: row.days_before_event_deadline,
    required_role: row.required_role,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceTravelTemplateItemRow(row: ServiceTravelTemplateItemRow): ServiceTravelTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    description: row.description,
    requires_equipment_transport: row.requires_equipment_transport,
    drive_time_buffer_minutes: row.drive_time_buffer_minutes,
    mileage_estimate: row.mileage_estimate,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceAiKnowledgeItemRow(row: ServiceAiKnowledgeItemRow): ServiceAiKnowledgeItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    knowledge_type: row.knowledge_type as ServiceAiKnowledgeType,
    content: row.content,
    severity: row.severity as ServiceAiKnowledgeSeverity,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceRequiredDocumentRow(row: ServiceRequiredDocumentRow): ServiceRequiredDocument {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    label: row.label,
    category: row.category,
    is_required: row.is_required,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceInventoryTemplateItemRow(row: ServiceInventoryTemplateItemRow): ServiceInventoryTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    inventory_item_id: row.inventory_item_id,
    item_name: row.item_name,
    quantity: row.quantity,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServicePurchaseTemplateItemRow(row: ServicePurchaseTemplateItemRow): ServicePurchaseTemplateItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    item_name: row.item_name,
    estimated_unit_cost_minor: row.estimated_unit_cost_minor,
    estimated_quantity: row.estimated_quantity,
    typical_vendor_id: row.typical_vendor_id,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceVendorSuggestionRow(row: ServiceVendorSuggestionRow): ServiceVendorSuggestion {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    vendor_id: row.vendor_id,
    note: row.note,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceTeamRoleRequirementRow(row: ServiceTeamRoleRequirementRow): ServiceTeamRoleRequirement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    role_label: row.role_label,
    quantity: row.quantity,
    note: row.note,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceSeasonalWindowRow(row: ServiceSeasonalWindowRow): ServiceSeasonalWindow {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    start_month: row.start_month,
    end_month: row.end_month,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapServiceCapabilityRequirementRow(row: ServiceCapabilityRequirementRow): ServiceCapabilityRequirement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    service_version_id: row.service_version_id,
    capability_type: row.capability_type as ServiceCapabilityType,
    label: row.label,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceRow(row: EventServiceRow): EventService {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_id: row.event_id,
    service_id: row.service_id,
    service_version_id: row.service_version_id,
    name: row.name,
    name_template_value: row.name_template_value,
    price_minor: row.price_minor,
    price_template_value: row.price_template_value,
    currency: row.currency,
    selected_add_on_ids: row.selected_add_on_ids,
    status: row.status as EventServiceStatus,
    assigned_at: row.assigned_at,
    assigned_by: row.assigned_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceInventoryRequirementRow(row: EventServiceInventoryRequirementRow): EventServiceInventoryRequirement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    inventory_item_id: row.inventory_item_id,
    item_name: row.item_name,
    quantity: row.quantity,
    is_fulfilled: row.is_fulfilled,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServicePurchaseRequirementRow(row: EventServicePurchaseRequirementRow): EventServicePurchaseRequirement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    item_name: row.item_name,
    estimated_unit_cost_minor: row.estimated_unit_cost_minor,
    estimated_quantity: row.estimated_quantity,
    typical_vendor_id: row.typical_vendor_id,
    fulfilled_purchase_id: row.fulfilled_purchase_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceBudgetLineRow(row: EventServiceBudgetLineRow): EventServiceBudgetLine {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    label: row.label,
    category: row.category,
    estimated_revenue_minor: row.estimated_revenue_minor,
    estimated_cost_minor: row.estimated_cost_minor,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceTeamRequirementRow(row: EventServiceTeamRequirementRow): EventServiceTeamRequirement {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    role_label: row.role_label,
    quantity: row.quantity,
    note: row.note,
    assigned_member_id: row.assigned_member_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceVendorAssignmentRow(row: EventServiceVendorAssignmentRow): EventServiceVendorAssignment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    vendor_id: row.vendor_id,
    status: row.status as EventServiceVendorAssignmentStatus,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapEventServiceQuestionnaireResponseRow(row: EventServiceQuestionnaireResponseRow): EventServiceQuestionnaireResponse {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    event_service_id: row.event_service_id,
    question_id: row.question_id,
    response_text: row.response_text,
    response_options: row.response_options,
    response_boolean: row.response_boolean,
    response_date: row.response_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

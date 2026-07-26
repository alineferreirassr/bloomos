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
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const NOW = "2026-07-12T09:00:00.000Z";

/** Maps each seeded "v1" (published) ServiceVersion id to its cloned "draft" id — mirrors exactly what publishServiceVersion's deep-copy produces in real use, without hand-duplicating every row below. */
const DRAFT_VERSION_OF: Record<string, string> = {
  service_version_photography_v1: "service_version_photography_draft",
  service_version_picnic_v1: "service_version_picnic_draft",
};

function withDraftClones<T extends { id: string; service_version_id: string }>(rows: T[]): T[] {
  const clones = rows
    .filter((row) => DRAFT_VERSION_OF[row.service_version_id])
    .map((row) => ({ ...row, id: `${row.id}_draft`, service_version_id: DRAFT_VERSION_OF[row.service_version_id] }));
  return [...rows, ...clones];
}

const V1_INCLUDED_ITEMS: ServiceIncludedItem[] = [
  { id: "sii_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Online gallery delivery", description: null, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "sii_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Full setup and breakdown", description: null, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_ADD_ONS: ServiceAddOn[] = [
  { id: "sao_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Same-day preview edit", description: null, price_delta_minor: 25000, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "sao_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Live acoustic musician", description: null, price_delta_minor: 40000, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_CHECKLIST_TEMPLATE_ITEMS: ServiceChecklistTemplateItem[] = [
  { id: "scti_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", title: "Confirm shot list with client", description: null, category: "photography", priority: "high", due_offset_days: 7, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "scti_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", title: "Confirm picnic location with venue", description: null, category: "venue", priority: "high", due_offset_days: 3, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_TIMELINE_TEMPLATE_ITEMS: ServiceTimelineTemplateItem[] = [
  { id: "stti_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", title: "Photographer arrival", description: null, category: "arrival", offset_minutes_from_event_start: -60, duration_minutes: 30, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "stti_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", title: "Picnic setup begins", description: null, category: "setup", offset_minutes_from_event_start: -90, duration_minutes: 60, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_QUESTIONNAIRE_QUESTIONS: ServiceQuestionnaireQuestion[] = [
  { id: "sqq_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", question_text: "Any must-have shots?", question_type: "long_text", is_required: false, options: null, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "sqq_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", question_text: "Preferred picnic theme?", question_type: "single_choice", is_required: true, options: ["Boho", "Classic", "Modern"], display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_BUDGET_TEMPLATE_LINES: ServiceBudgetTemplateLine[] = [
  { id: "sbtl_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Photography package", category: "photography", estimated_revenue_minor: 150000, estimated_cost_minor: 90000, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "sbtl_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Luxury Picnic package", category: "experience", estimated_revenue_minor: 85000, estimated_cost_minor: 50000, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_APPROVAL_TEMPLATE_ITEMS: ServiceApprovalTemplateItem[] = [
  { id: "sati_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Client approves final shot list", description: null, days_before_event_deadline: 5, required_role: null, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "sati_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Client approves picnic theme", description: null, days_before_event_deadline: 7, required_role: null, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_TRAVEL_TEMPLATE_ITEMS: ServiceTravelTemplateItem[] = [
  { id: "stvti_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Camera equipment transport", description: null, requires_equipment_transport: true, drive_time_buffer_minutes: 20, mileage_estimate: 15, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "stvti_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Picnic decor transport", description: null, requires_equipment_transport: true, drive_time_buffer_minutes: 30, mileage_estimate: 20, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_AI_KNOWLEDGE_ITEMS: ServiceAiKnowledgeItem[] = [
  { id: "saki_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", knowledge_type: "best_practice", content: "Arrive 60 minutes early to scout lighting before guests arrive.", severity: "medium", display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "saki_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", knowledge_type: "safety_reminder", content: "Confirm shade coverage — high weather sensitivity on hot days.", severity: "high", display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_REQUIRED_DOCUMENTS: ServiceRequiredDocument[] = [
  { id: "srd_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", label: "Signed model release", category: "legal", is_required: false, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "srd_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", label: "Venue permit", category: "legal", is_required: true, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_INVENTORY_TEMPLATE_ITEMS: ServiceInventoryTemplateItem[] = [
  { id: "siti_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", inventory_item_id: null, item_name: "Reflector kit", quantity: 1, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "siti_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", inventory_item_id: null, item_name: "Picnic blanket set", quantity: 1, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_PURCHASE_TEMPLATE_ITEMS: ServicePurchaseTemplateItem[] = [
  { id: "spti_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", item_name: "Memory cards", estimated_unit_cost_minor: 4000, estimated_quantity: 2, typical_vendor_id: null, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "spti_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", item_name: "Fresh flowers", estimated_unit_cost_minor: 8000, estimated_quantity: 1, typical_vendor_id: null, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_VENDOR_SUGGESTIONS: ServiceVendorSuggestion[] = [
  { id: "svs_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", vendor_id: "vendor_1", note: "Preferred photography partner.", display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "svs_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", vendor_id: "vendor_2", note: "Reliable for last-minute florals.", display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_TEAM_ROLE_REQUIREMENTS: ServiceTeamRoleRequirement[] = [
  { id: "strr_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", role_label: "Lead Photographer", quantity: 1, note: null, display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "strr_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", role_label: "Setup Coordinator", quantity: 1, note: null, display_order: 0, created_at: NOW, updated_at: NOW },
];

const V1_SEASONAL_WINDOWS: ServiceSeasonalWindow[] = [
  { id: "ssw_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", start_month: 1, end_month: 12, note: "Available year-round.", created_at: NOW, updated_at: NOW },
  { id: "ssw_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", start_month: 4, end_month: 10, note: "Outdoor-only — spring through fall.", created_at: NOW, updated_at: NOW },
];

const V1_CAPABILITY_REQUIREMENTS: ServiceCapabilityRequirement[] = [
  { id: "scr_1", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", capability_type: "skill", label: "Off-camera flash lighting", display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "scr_2", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", capability_type: "skill", label: "Floral styling", display_order: 0, created_at: NOW, updated_at: NOW },
  { id: "scr_3", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_photography_v1", capability_type: "equipment", label: "Backup camera body", display_order: 1, created_at: NOW, updated_at: NOW },
  { id: "scr_4", workspace_id: CURRENT_WORKSPACE_ID, service_version_id: "service_version_picnic_v1", capability_type: "equipment", label: "Cargo van", display_order: 1, created_at: NOW, updated_at: NOW },
];

function accessors<T>(getInitial: () => T[]) {
  let rows = getInitial();
  return {
    read: (): T[] => rows,
    write: (next: T[]): void => {
      rows = next;
    },
    reset: (): void => {
      rows = getInitial();
    },
  };
}

const includedItemsStore = accessors(() => withDraftClones(V1_INCLUDED_ITEMS));
const addOnsStore = accessors(() => withDraftClones(V1_ADD_ONS));
const checklistTemplateItemsStore = accessors(() => withDraftClones(V1_CHECKLIST_TEMPLATE_ITEMS));
const timelineTemplateItemsStore = accessors(() => withDraftClones(V1_TIMELINE_TEMPLATE_ITEMS));
const questionnaireQuestionsStore = accessors(() => withDraftClones(V1_QUESTIONNAIRE_QUESTIONS));
const budgetTemplateLinesStore = accessors(() => withDraftClones(V1_BUDGET_TEMPLATE_LINES));
const approvalTemplateItemsStore = accessors(() => withDraftClones(V1_APPROVAL_TEMPLATE_ITEMS));
const travelTemplateItemsStore = accessors(() => withDraftClones(V1_TRAVEL_TEMPLATE_ITEMS));
const aiKnowledgeItemsStore = accessors(() => withDraftClones(V1_AI_KNOWLEDGE_ITEMS));
const requiredDocumentsStore = accessors(() => withDraftClones(V1_REQUIRED_DOCUMENTS));
const inventoryTemplateItemsStore = accessors(() => withDraftClones(V1_INVENTORY_TEMPLATE_ITEMS));
const purchaseTemplateItemsStore = accessors(() => withDraftClones(V1_PURCHASE_TEMPLATE_ITEMS));
const vendorSuggestionsStore = accessors(() => withDraftClones(V1_VENDOR_SUGGESTIONS));
const teamRoleRequirementsStore = accessors(() => withDraftClones(V1_TEAM_ROLE_REQUIREMENTS));
const seasonalWindowsStore = accessors(() => withDraftClones(V1_SEASONAL_WINDOWS));
const capabilityRequirementsStore = accessors(() => withDraftClones(V1_CAPABILITY_REQUIREMENTS));

export const readServiceIncludedItems = includedItemsStore.read;
export const writeServiceIncludedItems = includedItemsStore.write;
export const readServiceAddOns = addOnsStore.read;
export const writeServiceAddOns = addOnsStore.write;
export const readServiceChecklistTemplateItems = checklistTemplateItemsStore.read;
export const writeServiceChecklistTemplateItems = checklistTemplateItemsStore.write;
export const readServiceTimelineTemplateItems = timelineTemplateItemsStore.read;
export const writeServiceTimelineTemplateItems = timelineTemplateItemsStore.write;
export const readServiceQuestionnaireQuestions = questionnaireQuestionsStore.read;
export const writeServiceQuestionnaireQuestions = questionnaireQuestionsStore.write;
export const readServiceBudgetTemplateLines = budgetTemplateLinesStore.read;
export const writeServiceBudgetTemplateLines = budgetTemplateLinesStore.write;
export const readServiceApprovalTemplateItems = approvalTemplateItemsStore.read;
export const writeServiceApprovalTemplateItems = approvalTemplateItemsStore.write;
export const readServiceTravelTemplateItems = travelTemplateItemsStore.read;
export const writeServiceTravelTemplateItems = travelTemplateItemsStore.write;
export const readServiceAiKnowledgeItems = aiKnowledgeItemsStore.read;
export const writeServiceAiKnowledgeItems = aiKnowledgeItemsStore.write;
export const readServiceRequiredDocuments = requiredDocumentsStore.read;
export const writeServiceRequiredDocuments = requiredDocumentsStore.write;
export const readServiceInventoryTemplateItems = inventoryTemplateItemsStore.read;
export const writeServiceInventoryTemplateItems = inventoryTemplateItemsStore.write;
export const readServicePurchaseTemplateItems = purchaseTemplateItemsStore.read;
export const writeServicePurchaseTemplateItems = purchaseTemplateItemsStore.write;
export const readServiceVendorSuggestions = vendorSuggestionsStore.read;
export const writeServiceVendorSuggestions = vendorSuggestionsStore.write;
export const readServiceTeamRoleRequirements = teamRoleRequirementsStore.read;
export const writeServiceTeamRoleRequirements = teamRoleRequirementsStore.write;
export const readServiceSeasonalWindows = seasonalWindowsStore.read;
export const writeServiceSeasonalWindows = seasonalWindowsStore.write;
export const readServiceCapabilityRequirements = capabilityRequirementsStore.read;
export const writeServiceCapabilityRequirements = capabilityRequirementsStore.write;

/** Test-only: restore every template store to its seeded state between test cases. */
export function resetServiceTemplatesStore(): void {
  includedItemsStore.reset();
  addOnsStore.reset();
  checklistTemplateItemsStore.reset();
  timelineTemplateItemsStore.reset();
  questionnaireQuestionsStore.reset();
  budgetTemplateLinesStore.reset();
  approvalTemplateItemsStore.reset();
  travelTemplateItemsStore.reset();
  aiKnowledgeItemsStore.reset();
  requiredDocumentsStore.reset();
  inventoryTemplateItemsStore.reset();
  purchaseTemplateItemsStore.reset();
  vendorSuggestionsStore.reset();
  teamRoleRequirementsStore.reset();
  seasonalWindowsStore.reset();
  capabilityRequirementsStore.reset();
}

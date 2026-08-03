import { CHECKLIST_CATEGORIES, CHECKLIST_CATEGORY_LABELS } from "@/core/enums/checklistCategory";
import { NOTE_PRIORITIES, NOTE_PRIORITY_LABELS } from "@/core/enums/notePriority";
import { SCHEDULE_CATEGORIES, SCHEDULE_CATEGORY_LABELS } from "@/core/enums/scheduleCategory";
import { SERVICE_QUESTION_TYPES, SERVICE_QUESTION_TYPE_LABELS } from "@/core/enums/serviceQuestionType";
import { SERVICE_AI_KNOWLEDGE_TYPES, SERVICE_AI_KNOWLEDGE_TYPE_LABELS } from "@/core/enums/serviceAiKnowledgeType";
import { SERVICE_AI_KNOWLEDGE_SEVERITIES, SERVICE_AI_KNOWLEDGE_SEVERITY_LABELS } from "@/core/enums/serviceAiKnowledgeSeverity";
import { SERVICE_CAPABILITY_TYPES, SERVICE_CAPABILITY_TYPE_LABELS } from "@/core/enums/serviceCapabilityType";
import { formatMoney } from "@/lib/money";
import type { TemplateCategoryKey } from "@/lib/queries/services/types";
import type { RequirementCardVariant } from "@/modules/services/components/RequirementCard";
import type { BadgeTone } from "@/components/ui/Badge";
import {
  includedItemMutations,
  addOnMutations,
  checklistTemplateItemMutations,
  timelineTemplateItemMutations,
  questionnaireQuestionMutations,
  budgetTemplateLineMutations,
  approvalTemplateItemMutations,
  travelTemplateItemMutations,
  aiKnowledgeItemMutations,
  requiredDocumentMutations,
  inventoryTemplateItemMutations,
  purchaseTemplateItemMutations,
  vendorSuggestionMutations,
  teamRoleRequirementMutations,
  capabilityRequirementMutations,
  seasonalWindowMutations,
} from "@/modules/services/hooks/useTemplateItemMutations";
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
import type {
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
} from "@/modules/services/schema";

/**
 * Every field kind the generic Inspector form (`TemplateItemInspectorForm`)
 * knows how to render and convert — adding a 17th template category never
 * needs a new component, only a new set of these descriptors. `"list"` is
 * the one category-specific escape hatch (`ServiceQuestionnaireQuestion.options`,
 * the only `string[] | null` field across all 16 categories) — rendered as
 * a single comma-separated text input rather than a bespoke chip-input
 * widget, since it's meaningful for exactly one field on one category.
 */
export type TemplateFieldKind = "text" | "textarea" | "number" | "money" | "boolean" | "select" | "list";

export interface TemplateFieldOption {
  value: string;
  label: string;
}

export interface TemplateFieldDescriptor {
  /** Must match the row's AND the input's property name exactly — the generic form reads/writes both through this one name. */
  name: string;
  label: string;
  kind: TemplateFieldKind;
  required?: boolean;
  /** Empty input converts to `null` rather than `""`/`0` — matches the field's real nullable column. */
  nullable?: boolean;
  options?: TemplateFieldOption[];
  hint?: string;
  placeholder?: string;
}

export interface TemplateRowMetadataBadge {
  label: string;
  tone?: BadgeTone;
}

/** The minimal shape every mutation hook bundle's four hooks share — matches `createTemplateItemMutations`'s real return in `useTemplateItemMutations.ts` structurally, without importing its unexported factory type. */
export interface TemplateCategoryMutations<TRow, TInput> {
  useCreate: (serviceId: string, serviceVersionId: string) => { mutateAsync: (input: TInput) => Promise<TRow>; isPending: boolean };
  useUpdate: (serviceId: string, serviceVersionId: string) => { mutateAsync: (vars: { id: string; input: TInput }) => Promise<TRow>; isPending: boolean };
  useRemove: (serviceId: string, serviceVersionId: string) => { mutateAsync: (id: string) => Promise<null>; isPending: boolean };
  useReorder: (serviceId: string, serviceVersionId: string) => { mutateAsync: (rows: TRow[]) => Promise<TRow[]>; isPending: boolean };
}

export interface TemplateCategoryAdapter<TRow extends { id: string }, TInput extends Record<string, unknown>> {
  key: TemplateCategoryKey;
  /** Plural, e.g. "Included Items". */
  label: string;
  /** Singular, e.g. "included item" — used in "Add included item" / confirmation copy. */
  itemNoun: string;
  supportsReorder: boolean;
  /** Only set for the 5 categories RequirementCard's icon vocabulary already covers (inventory/purchase/budget/team/vendor) — every other category uses the plain header. */
  requirementVariant?: RequirementCardVariant;
  fields: TemplateFieldDescriptor[];
  /** Rendered directly on the row (outside the Inspector) and autosaves on change — reserved for one simple, non-financial field per category, never a money field. */
  inlineFieldName?: string;
  toRowLabel: (row: TRow) => string;
  toRowDescription?: (row: TRow) => string | null;
  toRowMetadata?: (row: TRow) => TemplateRowMetadataBadge[];
  mutations: TemplateCategoryMutations<TRow, TInput>;
}

function enumOptions(values: readonly string[], labels: Record<string, string>): TemplateFieldOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

const MONTH_OPTIONS: TemplateFieldOption[] = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
].map((label, index) => ({ value: String(index + 1), label }));

function monthLabel(month: number): string {
  return MONTH_OPTIONS[month - 1]?.label ?? String(month);
}

export const includedItemAdapter: TemplateCategoryAdapter<ServiceIncludedItem, ServiceIncludedItemInput> = {
  key: "includedItems",
  label: "Included Items",
  itemNoun: "included item",
  supportsReorder: true,
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.description,
  mutations: includedItemMutations,
};

export const addOnAdapter: TemplateCategoryAdapter<ServiceAddOn, ServiceAddOnInput> = {
  key: "addOns",
  label: "Add-Ons",
  itemNoun: "add-on",
  supportsReorder: true,
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
    { name: "price_delta_minor", label: "Price", kind: "money", required: true },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.description,
  toRowMetadata: (row) => [{ label: formatMoney(row.price_delta_minor, "USD") }],
  mutations: addOnMutations,
};

export const checklistItemAdapter: TemplateCategoryAdapter<ServiceChecklistTemplateItem, ServiceChecklistTemplateItemInput> = {
  key: "checklistItems",
  label: "Checklist Items",
  itemNoun: "checklist item",
  supportsReorder: true,
  fields: [
    { name: "title", label: "Title", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
    { name: "category", label: "Category", kind: "select", required: true, options: enumOptions(CHECKLIST_CATEGORIES, CHECKLIST_CATEGORY_LABELS) },
    { name: "priority", label: "Priority", kind: "select", required: true, options: enumOptions(NOTE_PRIORITIES, NOTE_PRIORITY_LABELS) },
    { name: "due_offset_days", label: "Due (days before event)", kind: "number", nullable: true },
  ],
  toRowLabel: (row) => row.title,
  toRowDescription: (row) => row.description,
  toRowMetadata: (row) => [{ label: CHECKLIST_CATEGORY_LABELS[row.category] }, { label: NOTE_PRIORITY_LABELS[row.priority], tone: row.priority === "critical" ? "danger" : undefined }],
  mutations: checklistTemplateItemMutations,
};

export const timelineItemAdapter: TemplateCategoryAdapter<ServiceTimelineTemplateItem, ServiceTimelineTemplateItemInput> = {
  key: "timelineItems",
  label: "Timeline Items",
  itemNoun: "timeline item",
  supportsReorder: true,
  fields: [
    { name: "title", label: "Title", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
    { name: "category", label: "Category", kind: "select", required: true, options: enumOptions(SCHEDULE_CATEGORIES, SCHEDULE_CATEGORY_LABELS) },
    { name: "offset_minutes_from_event_start", label: "Offset from event start (minutes)", kind: "number", required: true, hint: "Negative values mean before the event starts." },
    { name: "duration_minutes", label: "Duration (minutes)", kind: "number", nullable: true },
  ],
  toRowLabel: (row) => row.title,
  toRowDescription: (row) => row.description,
  toRowMetadata: (row) => [
    { label: SCHEDULE_CATEGORY_LABELS[row.category] },
    { label: `${row.offset_minutes_from_event_start >= 0 ? "+" : ""}${row.offset_minutes_from_event_start} min` },
  ],
  mutations: timelineTemplateItemMutations,
};

export const travelItemAdapter: TemplateCategoryAdapter<ServiceTravelTemplateItem, ServiceTravelTemplateItemInput> = {
  key: "travelItems",
  label: "Travel & Logistics",
  itemNoun: "travel requirement",
  supportsReorder: true,
  inlineFieldName: "requires_equipment_transport",
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
    { name: "requires_equipment_transport", label: "Requires equipment transport", kind: "boolean" },
    { name: "drive_time_buffer_minutes", label: "Drive time buffer (minutes)", kind: "number", nullable: true },
    { name: "mileage_estimate", label: "Mileage estimate", kind: "number", nullable: true },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.description,
  toRowMetadata: (row) => (row.requires_equipment_transport ? [{ label: "Equipment transport", tone: "outline" }] : []),
  mutations: travelTemplateItemMutations,
};

export const questionnaireQuestionAdapter: TemplateCategoryAdapter<ServiceQuestionnaireQuestion, ServiceQuestionnaireQuestionInput> = {
  key: "questionnaireQuestions",
  label: "Questionnaire",
  itemNoun: "question",
  supportsReorder: true,
  inlineFieldName: "is_required",
  fields: [
    { name: "question_text", label: "Question", kind: "textarea", required: true },
    { name: "question_type", label: "Answer type", kind: "select", required: true, options: enumOptions(SERVICE_QUESTION_TYPES, SERVICE_QUESTION_TYPE_LABELS) },
    { name: "is_required", label: "Required", kind: "boolean" },
    { name: "options", label: "Choices", kind: "list", nullable: true, hint: "Comma-separated — only used for Single Choice / Multiple Choice." },
  ],
  toRowLabel: (row) => row.question_text,
  toRowMetadata: (row) => [{ label: SERVICE_QUESTION_TYPE_LABELS[row.question_type] }, ...(row.is_required ? [{ label: "Required", tone: "outline" as const }] : [])],
  mutations: questionnaireQuestionMutations,
};

export const requiredDocumentAdapter: TemplateCategoryAdapter<ServiceRequiredDocument, ServiceRequiredDocumentInput> = {
  key: "requiredDocuments",
  label: "Required Documents",
  itemNoun: "required document",
  supportsReorder: true,
  inlineFieldName: "is_required",
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "category", label: "Category", kind: "text", nullable: true },
    { name: "is_required", label: "Required", kind: "boolean" },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.category,
  toRowMetadata: (row) => (row.is_required ? [{ label: "Required", tone: "outline" }] : [{ label: "Optional", tone: "neutral" }]),
  mutations: requiredDocumentMutations,
};

export const approvalItemAdapter: TemplateCategoryAdapter<ServiceApprovalTemplateItem, ServiceApprovalTemplateItemInput> = {
  key: "approvalItems",
  label: "Approvals",
  itemNoun: "approval checkpoint",
  supportsReorder: true,
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "description", label: "Description", kind: "textarea", nullable: true },
    { name: "days_before_event_deadline", label: "Deadline (days before event)", kind: "number", nullable: true },
    { name: "required_role", label: "Required role", kind: "text", nullable: true },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.description,
  toRowMetadata: (row) => (row.required_role ? [{ label: row.required_role }] : []),
  mutations: approvalTemplateItemMutations,
};

export const inventoryItemAdapter: TemplateCategoryAdapter<ServiceInventoryTemplateItem, ServiceInventoryTemplateItemInput> = {
  key: "inventoryItems",
  label: "Inventory Needs",
  itemNoun: "inventory need",
  supportsReorder: true,
  requirementVariant: "inventory",
  inlineFieldName: "quantity",
  fields: [
    { name: "item_name", label: "Item name", kind: "text", required: true },
    { name: "quantity", label: "Quantity", kind: "number", required: true },
    { name: "inventory_item_id", label: "Linked Inventory item ID", kind: "text", nullable: true, hint: "Optional — paste a real Inventory item's ID to link it." },
  ],
  toRowLabel: (row) => row.item_name,
  toRowMetadata: (row) => [{ label: `× ${row.quantity}` }],
  mutations: inventoryTemplateItemMutations,
};

export const purchaseItemAdapter: TemplateCategoryAdapter<ServicePurchaseTemplateItem, ServicePurchaseTemplateItemInput> = {
  key: "purchaseItems",
  label: "Purchase Needs",
  itemNoun: "purchase need",
  supportsReorder: true,
  requirementVariant: "purchase",
  fields: [
    { name: "item_name", label: "Item name", kind: "text", required: true },
    { name: "estimated_quantity", label: "Estimated quantity", kind: "number", required: true },
    { name: "estimated_unit_cost_minor", label: "Estimated unit cost", kind: "money", required: true },
    { name: "typical_vendor_id", label: "Typical Vendor ID", kind: "text", nullable: true, hint: "Optional — paste a real Vendor's ID as a non-binding suggestion." },
  ],
  toRowLabel: (row) => row.item_name,
  toRowMetadata: (row) => [{ label: `× ${row.estimated_quantity}` }, { label: formatMoney(row.estimated_unit_cost_minor, "USD") }],
  mutations: purchaseTemplateItemMutations,
};

export const vendorSuggestionAdapter: TemplateCategoryAdapter<ServiceVendorSuggestion, ServiceVendorSuggestionInput> = {
  key: "vendorSuggestions",
  label: "Vendor Suggestions",
  itemNoun: "vendor suggestion",
  supportsReorder: true,
  requirementVariant: "vendor",
  fields: [
    { name: "vendor_id", label: "Vendor ID", kind: "text", required: true, hint: "Paste the suggested Vendor's ID." },
    { name: "note", label: "Note", kind: "textarea", nullable: true },
  ],
  toRowLabel: (row) => `Vendor ${row.vendor_id}`,
  toRowDescription: (row) => row.note,
  mutations: vendorSuggestionMutations,
};

export const teamRoleRequirementAdapter: TemplateCategoryAdapter<ServiceTeamRoleRequirement, ServiceTeamRoleRequirementInput> = {
  key: "teamRoleRequirements",
  label: "Team Roles",
  itemNoun: "team role",
  supportsReorder: true,
  requirementVariant: "team",
  inlineFieldName: "quantity",
  fields: [
    { name: "role_label", label: "Role", kind: "text", required: true },
    { name: "quantity", label: "Quantity", kind: "number", required: true },
    { name: "note", label: "Note", kind: "textarea", nullable: true },
  ],
  toRowLabel: (row) => row.role_label,
  toRowMetadata: (row) => [{ label: `× ${row.quantity}` }],
  mutations: teamRoleRequirementMutations,
};

export const capabilityRequirementAdapter: TemplateCategoryAdapter<ServiceCapabilityRequirement, ServiceCapabilityRequirementInput> = {
  key: "capabilityRequirements",
  label: "Capabilities",
  itemNoun: "capability requirement",
  supportsReorder: true,
  fields: [
    { name: "capability_type", label: "Type", kind: "select", required: true, options: enumOptions(SERVICE_CAPABILITY_TYPES, SERVICE_CAPABILITY_TYPE_LABELS) },
    { name: "label", label: "Label", kind: "text", required: true },
  ],
  toRowLabel: (row) => row.label,
  toRowMetadata: (row) => [{ label: SERVICE_CAPABILITY_TYPE_LABELS[row.capability_type] }],
  mutations: capabilityRequirementMutations,
};

export const budgetLineAdapter: TemplateCategoryAdapter<ServiceBudgetTemplateLine, ServiceBudgetTemplateLineInput> = {
  key: "budgetLines",
  label: "Budget Lines",
  itemNoun: "budget line",
  supportsReorder: true,
  requirementVariant: "budget",
  fields: [
    { name: "label", label: "Label", kind: "text", required: true },
    { name: "category", label: "Category", kind: "text", nullable: true },
    { name: "estimated_revenue_minor", label: "Estimated revenue", kind: "money", required: true },
    { name: "estimated_cost_minor", label: "Estimated cost", kind: "money", required: true },
  ],
  toRowLabel: (row) => row.label,
  toRowDescription: (row) => row.category,
  toRowMetadata: (row) => [
    { label: `Rev ${formatMoney(row.estimated_revenue_minor, "USD")}` },
    { label: `Cost ${formatMoney(row.estimated_cost_minor, "USD")}` },
  ],
  mutations: budgetTemplateLineMutations,
};

export const aiKnowledgeItemAdapter: TemplateCategoryAdapter<ServiceAiKnowledgeItem, ServiceAiKnowledgeItemInput> = {
  key: "aiKnowledgeItems",
  label: "AI Knowledge",
  itemNoun: "knowledge entry",
  supportsReorder: true,
  fields: [
    { name: "knowledge_type", label: "Type", kind: "select", required: true, options: enumOptions(SERVICE_AI_KNOWLEDGE_TYPES, SERVICE_AI_KNOWLEDGE_TYPE_LABELS) },
    { name: "content", label: "Content", kind: "textarea", required: true },
    { name: "severity", label: "Severity", kind: "select", required: true, options: enumOptions(SERVICE_AI_KNOWLEDGE_SEVERITIES, SERVICE_AI_KNOWLEDGE_SEVERITY_LABELS) },
  ],
  toRowLabel: (row) => SERVICE_AI_KNOWLEDGE_TYPE_LABELS[row.knowledge_type],
  toRowDescription: (row) => row.content,
  toRowMetadata: (row) => [{ label: SERVICE_AI_KNOWLEDGE_SEVERITY_LABELS[row.severity], tone: row.severity === "high" ? "danger" : undefined }],
  mutations: aiKnowledgeItemMutations,
};

export const seasonalWindowAdapter: TemplateCategoryAdapter<ServiceSeasonalWindow, ServiceSeasonalWindowInput> = {
  key: "seasonalWindows",
  label: "Seasonal Windows",
  itemNoun: "seasonal window",
  // The one category with no `display_order` column — no drag handle, no Move up/down, never faked.
  supportsReorder: false,
  fields: [
    { name: "start_month", label: "Start month", kind: "select", required: true, options: MONTH_OPTIONS },
    { name: "end_month", label: "End month", kind: "select", required: true, options: MONTH_OPTIONS },
    { name: "note", label: "Note", kind: "textarea", nullable: true },
  ],
  toRowLabel: (row) => `${monthLabel(row.start_month)} – ${monthLabel(row.end_month)}`,
  toRowDescription: (row) => row.note,
  mutations: seasonalWindowMutations,
};

/** One flat list, in the same order the Left Column groups render them — the query layer's own 6-group taxonomy is a display grouping only; this list is what every generic component (Sidebar quick-nav, category lookups) iterates. */
export const ALL_TEMPLATE_CATEGORY_ADAPTERS: TemplateCategoryAdapter<{ id: string }, Record<string, unknown>>[] = [
  includedItemAdapter,
  addOnAdapter,
  checklistItemAdapter,
  timelineItemAdapter,
  travelItemAdapter,
  questionnaireQuestionAdapter,
  requiredDocumentAdapter,
  approvalItemAdapter,
  inventoryItemAdapter,
  purchaseItemAdapter,
  vendorSuggestionAdapter,
  teamRoleRequirementAdapter,
  capabilityRequirementAdapter,
  budgetLineAdapter,
  aiKnowledgeItemAdapter,
  seasonalWindowAdapter,
] as unknown as TemplateCategoryAdapter<{ id: string }, Record<string, unknown>>[];

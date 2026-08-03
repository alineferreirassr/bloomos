import { z } from "zod";
import { SERVICE_QUESTION_TYPES } from "@/core/enums/serviceQuestionType";
import { SERVICE_EXPERIENCE_LEVELS } from "@/core/enums/serviceExperienceLevel";
import { SERVICE_WEATHER_SENSITIVITIES } from "@/core/enums/serviceWeatherSensitivity";
import { SERVICE_AI_KNOWLEDGE_TYPES } from "@/core/enums/serviceAiKnowledgeType";
import { SERVICE_AI_KNOWLEDGE_SEVERITIES } from "@/core/enums/serviceAiKnowledgeSeverity";
import { SERVICE_CAPABILITY_TYPES } from "@/core/enums/serviceCapabilityType";
import { CHECKLIST_CATEGORIES } from "@/core/enums/checklistCategory";
import { NOTE_PRIORITIES } from "@/core/enums/notePriority";
import { SCHEDULE_CATEGORIES } from "@/core/enums/scheduleCategory";

/** Same locally-duplicated helper convention as every other schema module (modules/purchases/schema.ts, modules/finance/schema.ts) — no shared modules/shared/schema.ts exists in this codebase. */
const moneyMinor = z.number().int("Enter a whole number of minor units").nonnegative("Enter a valid amount");
const positiveInt = z.number().int("Enter a whole number").positive("Enter a number greater than zero");
const nonNegativeInt = z.number().int("Enter a whole number").nonnegative("Enter a valid amount");
const currencyCode = z
  .string()
  .trim()
  .length(3, "Use a 3-letter currency code")
  .transform((v) => v.toUpperCase());
const displayOrder = z.number().int().nonnegative().default(0);

export const serviceCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServiceCategoryInput = z.infer<typeof serviceCategoryInputSchema>;

/** `status`/`draft_version_id`/`current_published_version_id` are absent — every transition goes through a dedicated repository method (activateService, deactivateService, archiveService, publishServiceVersion), never a plain field on this input, matching every other module's status-setter exclusion. */
export const serviceInputSchema = z.object({
  category_id: z.string().trim().nullable(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().nullable(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

/**
 * Edits the current DRAFT ServiceVersion's own fields — rejected by the
 * repository once that version has been published (see
 * canEditServiceVersionTemplates in core/workflows/serviceWorkflow.ts).
 * `version_number`/`published_at`/`published_by`/`change_summary`/
 * `name_snapshot`/`description_snapshot` are all absent — every one of them
 * is set only by publishServiceVersion, never by this input. Display
 * name/description are edited on the Service itself (serviceInputSchema)
 * — never on a version, draft or otherwise.
 */
export const serviceVersionInputSchema = z.object({
  base_price_minor: moneyMinor,
  currency: currencyCode,
  setup_duration_minutes: nonNegativeInt.nullable(),
  breakdown_duration_minutes: nonNegativeInt.nullable(),
  difficulty_score: z.number().int().min(1).max(5).nullable(),
  experience_level_required: z.enum(SERVICE_EXPERIENCE_LEVELS).nullable(),
  weather_sensitivity: z.enum(SERVICE_WEATHER_SENSITIVITIES),
  surprise_friendly: z.boolean(),
  estimated_profit_minor: z.number().int("Enter a whole number of minor units").nullable(),
});
export type ServiceVersionInput = z.infer<typeof serviceVersionInputSchema>;

export const publishServiceVersionInputSchema = z.object({
  change_summary: z.string().trim().nullable(),
});
export type PublishServiceVersionInput = z.infer<typeof publishServiceVersionInputSchema>;

export const serviceIncludedItemInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServiceIncludedItemInput = z.infer<typeof serviceIncludedItemInputSchema>;

export const serviceAddOnInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().nullable(),
  price_delta_minor: moneyMinor,
  display_order: displayOrder,
});
export type ServiceAddOnInput = z.infer<typeof serviceAddOnInputSchema>;

export const serviceChecklistTemplateItemInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullable(),
  category: z.enum(CHECKLIST_CATEGORIES),
  priority: z.enum(NOTE_PRIORITIES),
  due_offset_days: z.number().int().nullable(),
  display_order: displayOrder,
});
export type ServiceChecklistTemplateItemInput = z.infer<typeof serviceChecklistTemplateItemInputSchema>;

export const serviceTimelineTemplateItemInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().nullable(),
  category: z.enum(SCHEDULE_CATEGORIES),
  offset_minutes_from_event_start: z.number().int(),
  duration_minutes: nonNegativeInt.nullable(),
  display_order: displayOrder,
});
export type ServiceTimelineTemplateItemInput = z.infer<typeof serviceTimelineTemplateItemInputSchema>;

export const serviceQuestionnaireQuestionInputSchema = z.object({
  question_text: z.string().trim().min(1, "Question text is required"),
  question_type: z.enum(SERVICE_QUESTION_TYPES),
  is_required: z.boolean(),
  options: z.array(z.string().trim().min(1)).nullable(),
  display_order: displayOrder,
});
export type ServiceQuestionnaireQuestionInput = z.infer<typeof serviceQuestionnaireQuestionInputSchema>;

export const serviceBudgetTemplateLineInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  category: z.string().trim().nullable(),
  estimated_revenue_minor: moneyMinor,
  estimated_cost_minor: moneyMinor,
  display_order: displayOrder,
});
export type ServiceBudgetTemplateLineInput = z.infer<typeof serviceBudgetTemplateLineInputSchema>;

export const serviceApprovalTemplateItemInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().nullable(),
  days_before_event_deadline: nonNegativeInt.nullable(),
  required_role: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServiceApprovalTemplateItemInput = z.infer<typeof serviceApprovalTemplateItemInputSchema>;

export const serviceTravelTemplateItemInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  description: z.string().trim().nullable(),
  requires_equipment_transport: z.boolean(),
  drive_time_buffer_minutes: nonNegativeInt.nullable(),
  mileage_estimate: z.number().nonnegative().nullable(),
  display_order: displayOrder,
});
export type ServiceTravelTemplateItemInput = z.infer<typeof serviceTravelTemplateItemInputSchema>;

export const serviceAiKnowledgeItemInputSchema = z.object({
  knowledge_type: z.enum(SERVICE_AI_KNOWLEDGE_TYPES),
  content: z.string().trim().min(1, "Content is required"),
  severity: z.enum(SERVICE_AI_KNOWLEDGE_SEVERITIES),
  display_order: displayOrder,
});
export type ServiceAiKnowledgeItemInput = z.infer<typeof serviceAiKnowledgeItemInputSchema>;

export const serviceRequiredDocumentInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  category: z.string().trim().nullable(),
  is_required: z.boolean(),
  display_order: displayOrder,
});
export type ServiceRequiredDocumentInput = z.infer<typeof serviceRequiredDocumentInputSchema>;

export const serviceInventoryTemplateItemInputSchema = z.object({
  inventory_item_id: z.string().trim().nullable(),
  item_name: z.string().trim().min(1, "Item name is required"),
  quantity: positiveInt,
  display_order: displayOrder,
});
export type ServiceInventoryTemplateItemInput = z.infer<typeof serviceInventoryTemplateItemInputSchema>;

export const servicePurchaseTemplateItemInputSchema = z.object({
  item_name: z.string().trim().min(1, "Item name is required"),
  estimated_unit_cost_minor: moneyMinor,
  estimated_quantity: positiveInt,
  typical_vendor_id: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServicePurchaseTemplateItemInput = z.infer<typeof servicePurchaseTemplateItemInputSchema>;

export const serviceVendorSuggestionInputSchema = z.object({
  vendor_id: z.string().trim().min(1, "Vendor is required"),
  note: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServiceVendorSuggestionInput = z.infer<typeof serviceVendorSuggestionInputSchema>;

export const serviceTeamRoleRequirementInputSchema = z.object({
  role_label: z.string().trim().min(1, "Role is required"),
  quantity: positiveInt,
  note: z.string().trim().nullable(),
  display_order: displayOrder,
});
export type ServiceTeamRoleRequirementInput = z.infer<typeof serviceTeamRoleRequirementInputSchema>;

export const serviceSeasonalWindowInputSchema = z.object({
  start_month: z.number().int().min(1).max(12),
  end_month: z.number().int().min(1).max(12),
  note: z.string().trim().nullable(),
});
export type ServiceSeasonalWindowInput = z.infer<typeof serviceSeasonalWindowInputSchema>;

export const serviceCapabilityRequirementInputSchema = z.object({
  capability_type: z.enum(SERVICE_CAPABILITY_TYPES),
  label: z.string().trim().min(1, "Label is required"),
  display_order: displayOrder,
});
export type ServiceCapabilityRequirementInput = z.infer<typeof serviceCapabilityRequirementInputSchema>;

/**
 * Input to assign a Service to an Event. `service_version_id` is absent —
 * the repository always resolves it from the Service's own
 * `current_published_version_id` at call time (never caller-supplied),
 * so a caller can never pin an Event to an arbitrary version by mistake.
 * `selected_add_on_ids` defaults to none.
 */
export const assignServiceToEventInputSchema = z.object({
  service_id: z.string().trim().min(1, "Service is required"),
  selected_add_on_ids: z.array(z.string().trim().min(1)).default([]),
});
export type AssignServiceToEventInput = z.infer<typeof assignServiceToEventInputSchema>;

export const eventServiceQuestionnaireResponseInputSchema = z.object({
  question_id: z.string().trim().min(1),
  response_text: z.string().trim().nullable(),
  response_options: z.array(z.string().trim().min(1)).nullable(),
  response_boolean: z.boolean().nullable(),
  response_date: z.string().trim().nullable(),
});
export type EventServiceQuestionnaireResponseInput = z.infer<typeof eventServiceQuestionnaireResponseInputSchema>;

/**
 * The ONLY two fields an operator may override on an already-assigned
 * EventService — `name`/`price_minor` (live, current-booking values).
 * `name_template_value`/`price_template_value` (frozen at assignment) and
 * `service_version_id` (the permanent pin) are never part of this input —
 * there is no path through this schema that could touch them. Both fields
 * are optional so a caller can update just the name, just the price, or
 * both in one call; `.refine` only rejects the pointless case of updating
 * neither. Currency is not editable here — `EventService.currency` is
 * fixed at assignment time from the pinned ServiceVersion and never
 * becomes a live override field.
 */
export const updateEventServiceOverridesInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    price_minor: moneyMinor.optional(),
  })
  .refine((data) => data.name !== undefined || data.price_minor !== undefined, {
    message: "Provide a name or a price to update.",
  });
export type UpdateEventServiceOverridesInput = z.infer<typeof updateEventServiceOverridesInputSchema>;

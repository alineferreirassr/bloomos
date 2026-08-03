import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { DataResult } from "@/lib/data/result";
import {
  createServiceIncludedItem,
  updateServiceIncludedItem,
  removeServiceIncludedItem,
  createServiceAddOn,
  updateServiceAddOn,
  removeServiceAddOn,
  createServiceChecklistTemplateItem,
  updateServiceChecklistTemplateItem,
  removeServiceChecklistTemplateItem,
  createServiceTimelineTemplateItem,
  updateServiceTimelineTemplateItem,
  removeServiceTimelineTemplateItem,
  createServiceQuestionnaireQuestion,
  updateServiceQuestionnaireQuestion,
  removeServiceQuestionnaireQuestion,
  createServiceBudgetTemplateLine,
  updateServiceBudgetTemplateLine,
  removeServiceBudgetTemplateLine,
  createServiceApprovalTemplateItem,
  updateServiceApprovalTemplateItem,
  removeServiceApprovalTemplateItem,
  createServiceTravelTemplateItem,
  updateServiceTravelTemplateItem,
  removeServiceTravelTemplateItem,
  createServiceAiKnowledgeItem,
  updateServiceAiKnowledgeItem,
  removeServiceAiKnowledgeItem,
  createServiceRequiredDocument,
  updateServiceRequiredDocument,
  removeServiceRequiredDocument,
  createServiceInventoryTemplateItem,
  updateServiceInventoryTemplateItem,
  removeServiceInventoryTemplateItem,
  createServicePurchaseTemplateItem,
  updateServicePurchaseTemplateItem,
  removeServicePurchaseTemplateItem,
  createServiceVendorSuggestion,
  updateServiceVendorSuggestion,
  removeServiceVendorSuggestion,
  createServiceTeamRoleRequirement,
  updateServiceTeamRoleRequirement,
  removeServiceTeamRoleRequirement,
  createServiceCapabilityRequirement,
  updateServiceCapabilityRequirement,
  removeServiceCapabilityRequirement,
  createServiceSeasonalWindow,
  updateServiceSeasonalWindow,
  removeServiceSeasonalWindow,
} from "@/lib/data";
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
  ServiceCapabilityRequirementInput,
  ServiceSeasonalWindowInput,
} from "@/modules/services/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * Invalidation matrix — every one of the 16 template-table categories
 * shares this exact rule, since they are all structurally identical
 * create/update/remove/reorder operations against a single
 * `service_version_id`:
 *
 * | Mutation                    | Invalidates                                                          | Leaves untouched |
 * |-------------------------------|-----------------------------------------------------------------------|-------------------|
 * | create/update/remove/reorder  | templates(serviceVersionId), health(serviceId), publishPreview(serviceId), lists(), healthDashboards() | versions(serviceId) — version metadata (number/status/published_at) is untouched by template row edits; every `eventServiceWorkspace`/`assignmentWorkspace` key — a draft's template rows never affect an already-generated EventService, only future assignments made after the version is published |
 *
 * `serviceId` is passed alongside `serviceVersionId` into every hook here
 * specifically so this invalidation can reach `health`/`publishPreview`,
 * which are keyed by Service, not by Version — the repository's own
 * create/update/remove calls only take a version id, so there is no way to
 * derive the owning Service id from inside this file without an extra
 * lookup; the caller (a Template Builder screen, which is always reached
 * from a specific Service) already has both ids for free.
 */
function invalidateTemplateCategory(queryClient: QueryClient, serviceId: string, serviceVersionId: string) {
  queryClient.invalidateQueries({ queryKey: serviceKeys.templates(serviceVersionId) });
  queryClient.invalidateQueries({ queryKey: serviceKeys.health(serviceId) });
  queryClient.invalidateQueries({ queryKey: serviceKeys.publishPreview(serviceId) });
  queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
  queryClient.invalidateQueries({ queryKey: serviceKeys.healthDashboards() });
}

interface TemplateRow {
  id: string;
  display_order?: number;
}

/**
 * One generic mutation-hook factory shared by every template category —
 * mirrors `createSupabaseTemplateCrud` on the repository side. `deps.create`/
 * `update`/`remove` are the exact `@/lib/data` functions for one category;
 * this factory adds no business logic of its own, only calls-then-
 * invalidates. `deps.toInput` is omitted only for
 * `service_seasonal_windows`, the one category with no `display_order`
 * column (see 20260806100600_service_resource_templates.sql) — its
 * `useReorder` throws immediately rather than reordering against a field
 * that doesn't exist.
 */
function createTemplateItemMutations<TRow extends TemplateRow, TInput extends object>(deps: {
  create: (serviceVersionId: string, input: TInput) => Promise<DataResult<TRow>>;
  update: (id: string, input: TInput) => Promise<DataResult<TRow>>;
  remove: (id: string) => Promise<DataResult<null>>;
  /** Full existing rows are required (not partial patches) because `update` takes the whole Input, and reordering only ever changes `display_order` — every other field must round-trip unchanged. */
  toInput?: (row: TRow) => TInput;
}) {
  function useCreate(serviceId: string, serviceVersionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: TInput) => deps.create(serviceVersionId, input).then(throwIfFailed),
      onSuccess: () => invalidateTemplateCategory(queryClient, serviceId, serviceVersionId),
    });
  }

  function useUpdate(serviceId: string, serviceVersionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, input }: { id: string; input: TInput }) => deps.update(id, input).then(throwIfFailed),
      onSuccess: () => invalidateTemplateCategory(queryClient, serviceId, serviceVersionId),
    });
  }

  function useRemove(serviceId: string, serviceVersionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => deps.remove(id).then(throwIfFailed),
      onSuccess: () => invalidateTemplateCategory(queryClient, serviceId, serviceVersionId),
    });
  }

  function useReorder(serviceId: string, serviceVersionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (orderedRows: TRow[]) => {
        if (!deps.toInput) throw new Error("This category does not support reordering.");
        const toInput = deps.toInput;
        // The `as TInput` cast is only ever exercised for categories that
        // supplied `toInput` in the first place — every one of those
        // Input types genuinely has a `display_order` field (verified
        // against modules/services/schema.ts). The one category without
        // one (service_seasonal_windows) never reaches this line, since
        // it never sets `toInput` and the guard above throws first.
        const results = await Promise.all(orderedRows.map((row, index) => deps.update(row.id, { ...toInput(row), display_order: index } as TInput)));
        return results.map(throwIfFailed);
      },
      onSuccess: () => invalidateTemplateCategory(queryClient, serviceId, serviceVersionId),
    });
  }

  return { useCreate, useUpdate, useRemove, useReorder };
}

export const includedItemMutations = createTemplateItemMutations<import("@/types/serviceIncludedItem").ServiceIncludedItem, ServiceIncludedItemInput>({
  create: createServiceIncludedItem,
  update: updateServiceIncludedItem,
  remove: removeServiceIncludedItem,
  toInput: (row) => ({ label: row.label, description: row.description, display_order: row.display_order }),
});

export const addOnMutations = createTemplateItemMutations<import("@/types/serviceAddOn").ServiceAddOn, ServiceAddOnInput>({
  create: createServiceAddOn,
  update: updateServiceAddOn,
  remove: removeServiceAddOn,
  toInput: (row) => ({ label: row.label, description: row.description, price_delta_minor: row.price_delta_minor, display_order: row.display_order }),
});

export const checklistTemplateItemMutations = createTemplateItemMutations<import("@/types/serviceChecklistTemplateItem").ServiceChecklistTemplateItem, ServiceChecklistTemplateItemInput>({
  create: createServiceChecklistTemplateItem,
  update: updateServiceChecklistTemplateItem,
  remove: removeServiceChecklistTemplateItem,
  toInput: (row) => ({ title: row.title, description: row.description, category: row.category, priority: row.priority, due_offset_days: row.due_offset_days, display_order: row.display_order }),
});

export const timelineTemplateItemMutations = createTemplateItemMutations<import("@/types/serviceTimelineTemplateItem").ServiceTimelineTemplateItem, ServiceTimelineTemplateItemInput>({
  create: createServiceTimelineTemplateItem,
  update: updateServiceTimelineTemplateItem,
  remove: removeServiceTimelineTemplateItem,
  toInput: (row) => ({
    title: row.title,
    description: row.description,
    category: row.category,
    offset_minutes_from_event_start: row.offset_minutes_from_event_start,
    duration_minutes: row.duration_minutes,
    display_order: row.display_order,
  }),
});

export const questionnaireQuestionMutations = createTemplateItemMutations<import("@/types/serviceQuestionnaireQuestion").ServiceQuestionnaireQuestion, ServiceQuestionnaireQuestionInput>({
  create: createServiceQuestionnaireQuestion,
  update: updateServiceQuestionnaireQuestion,
  remove: removeServiceQuestionnaireQuestion,
  toInput: (row) => ({ question_text: row.question_text, question_type: row.question_type, is_required: row.is_required, options: row.options, display_order: row.display_order }),
});

export const budgetTemplateLineMutations = createTemplateItemMutations<import("@/types/serviceBudgetTemplateLine").ServiceBudgetTemplateLine, ServiceBudgetTemplateLineInput>({
  create: createServiceBudgetTemplateLine,
  update: updateServiceBudgetTemplateLine,
  remove: removeServiceBudgetTemplateLine,
  toInput: (row) => ({
    label: row.label,
    category: row.category,
    estimated_revenue_minor: row.estimated_revenue_minor,
    estimated_cost_minor: row.estimated_cost_minor,
    display_order: row.display_order,
  }),
});

export const approvalTemplateItemMutations = createTemplateItemMutations<import("@/types/serviceApprovalTemplateItem").ServiceApprovalTemplateItem, ServiceApprovalTemplateItemInput>({
  create: createServiceApprovalTemplateItem,
  update: updateServiceApprovalTemplateItem,
  remove: removeServiceApprovalTemplateItem,
  toInput: (row) => ({
    label: row.label,
    description: row.description,
    days_before_event_deadline: row.days_before_event_deadline,
    required_role: row.required_role,
    display_order: row.display_order,
  }),
});

export const travelTemplateItemMutations = createTemplateItemMutations<import("@/types/serviceTravelTemplateItem").ServiceTravelTemplateItem, ServiceTravelTemplateItemInput>({
  create: createServiceTravelTemplateItem,
  update: updateServiceTravelTemplateItem,
  remove: removeServiceTravelTemplateItem,
  toInput: (row) => ({
    label: row.label,
    description: row.description,
    requires_equipment_transport: row.requires_equipment_transport,
    drive_time_buffer_minutes: row.drive_time_buffer_minutes,
    mileage_estimate: row.mileage_estimate,
    display_order: row.display_order,
  }),
});

export const aiKnowledgeItemMutations = createTemplateItemMutations<import("@/types/serviceAiKnowledgeItem").ServiceAiKnowledgeItem, ServiceAiKnowledgeItemInput>({
  create: createServiceAiKnowledgeItem,
  update: updateServiceAiKnowledgeItem,
  remove: removeServiceAiKnowledgeItem,
  toInput: (row) => ({ knowledge_type: row.knowledge_type, content: row.content, severity: row.severity, display_order: row.display_order }),
});

export const requiredDocumentMutations = createTemplateItemMutations<import("@/types/serviceRequiredDocument").ServiceRequiredDocument, ServiceRequiredDocumentInput>({
  create: createServiceRequiredDocument,
  update: updateServiceRequiredDocument,
  remove: removeServiceRequiredDocument,
  toInput: (row) => ({ label: row.label, category: row.category, is_required: row.is_required, display_order: row.display_order }),
});

export const inventoryTemplateItemMutations = createTemplateItemMutations<import("@/types/serviceInventoryTemplateItem").ServiceInventoryTemplateItem, ServiceInventoryTemplateItemInput>({
  create: createServiceInventoryTemplateItem,
  update: updateServiceInventoryTemplateItem,
  remove: removeServiceInventoryTemplateItem,
  toInput: (row) => ({ inventory_item_id: row.inventory_item_id, item_name: row.item_name, quantity: row.quantity, display_order: row.display_order }),
});

export const purchaseTemplateItemMutations = createTemplateItemMutations<import("@/types/servicePurchaseTemplateItem").ServicePurchaseTemplateItem, ServicePurchaseTemplateItemInput>({
  create: createServicePurchaseTemplateItem,
  update: updateServicePurchaseTemplateItem,
  remove: removeServicePurchaseTemplateItem,
  toInput: (row) => ({
    item_name: row.item_name,
    estimated_unit_cost_minor: row.estimated_unit_cost_minor,
    estimated_quantity: row.estimated_quantity,
    typical_vendor_id: row.typical_vendor_id,
    display_order: row.display_order,
  }),
});

export const vendorSuggestionMutations = createTemplateItemMutations<import("@/types/serviceVendorSuggestion").ServiceVendorSuggestion, ServiceVendorSuggestionInput>({
  create: createServiceVendorSuggestion,
  update: updateServiceVendorSuggestion,
  remove: removeServiceVendorSuggestion,
  toInput: (row) => ({ vendor_id: row.vendor_id, note: row.note, display_order: row.display_order }),
});

export const teamRoleRequirementMutations = createTemplateItemMutations<import("@/types/serviceTeamRoleRequirement").ServiceTeamRoleRequirement, ServiceTeamRoleRequirementInput>({
  create: createServiceTeamRoleRequirement,
  update: updateServiceTeamRoleRequirement,
  remove: removeServiceTeamRoleRequirement,
  toInput: (row) => ({ role_label: row.role_label, quantity: row.quantity, note: row.note, display_order: row.display_order }),
});

export const capabilityRequirementMutations = createTemplateItemMutations<import("@/types/serviceCapabilityRequirement").ServiceCapabilityRequirement, ServiceCapabilityRequirementInput>({
  create: createServiceCapabilityRequirement,
  update: updateServiceCapabilityRequirement,
  remove: removeServiceCapabilityRequirement,
  toInput: (row) => ({ capability_type: row.capability_type, label: row.label, display_order: row.display_order }),
});

// No `toInput` — service_seasonal_windows has no `display_order` column, so this is the one category `useReorder` is never wired up for.
export const seasonalWindowMutations = createTemplateItemMutations<import("@/types/serviceSeasonalWindow").ServiceSeasonalWindow, ServiceSeasonalWindowInput>({
  create: createServiceSeasonalWindow,
  update: updateServiceSeasonalWindow,
  remove: removeServiceSeasonalWindow,
});

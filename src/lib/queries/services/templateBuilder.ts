import {
  getServiceVersion,
  listServiceIncludedItems,
  listServiceAddOns,
  listServiceChecklistTemplateItems,
  listServiceTimelineTemplateItems,
  listServiceTravelTemplateItems,
  listServiceQuestionnaireQuestions,
  listServiceRequiredDocuments,
  listServiceApprovalTemplateItems,
  listServiceInventoryTemplateItems,
  listServicePurchaseTemplateItems,
  listServiceVendorSuggestions,
  listServiceTeamRoleRequirements,
  listServiceCapabilityRequirements,
  listServiceBudgetTemplateLines,
  listServiceSeasonalWindows,
  listServiceAiKnowledgeItems,
} from "@/lib/data";
import type { TemplateBuilderData, TemplateCategoryData } from "@/lib/queries/services/types";

/**
 * All 16 categories composed into ONE call, grouped exactly per the
 * approved UX design's 6-group taxonomy — deliberately not 16 separate
 * hooks/fetches, so the Template Builder never issues a fetch waterfall
 * just to render its sidebar counts. "expected" vs "optional" mirrors
 * health.ts's own weighting so the sidebar's amber/gray dots and the
 * Health tab's missing list never disagree about what counts.
 */
export async function getTemplateBuilder(serviceVersionId: string): Promise<TemplateBuilderData> {
  const [
    version,
    includedItems,
    addOns,
    checklistItems,
    timelineItems,
    travelItems,
    questionnaireQuestions,
    requiredDocuments,
    approvalItems,
    inventoryItems,
    purchaseItems,
    vendorSuggestions,
    teamRoleRequirements,
    capabilityRequirements,
    budgetLines,
    seasonalWindows,
    aiKnowledgeItems,
  ] = await Promise.all([
    getServiceVersion(serviceVersionId),
    listServiceIncludedItems(serviceVersionId),
    listServiceAddOns(serviceVersionId),
    listServiceChecklistTemplateItems(serviceVersionId),
    listServiceTimelineTemplateItems(serviceVersionId),
    listServiceTravelTemplateItems(serviceVersionId),
    listServiceQuestionnaireQuestions(serviceVersionId),
    listServiceRequiredDocuments(serviceVersionId),
    listServiceApprovalTemplateItems(serviceVersionId),
    listServiceInventoryTemplateItems(serviceVersionId),
    listServicePurchaseTemplateItems(serviceVersionId),
    listServiceVendorSuggestions(serviceVersionId),
    listServiceTeamRoleRequirements(serviceVersionId),
    listServiceCapabilityRequirements(serviceVersionId),
    listServiceBudgetTemplateLines(serviceVersionId),
    listServiceSeasonalWindows(serviceVersionId),
    listServiceAiKnowledgeItems(serviceVersionId),
  ]);

  function category<TRow>(key: TemplateCategoryData<TRow>["key"], rows: TRow[], expectation: TemplateCategoryData<TRow>["expectation"]): TemplateCategoryData<TRow> {
    return { key, rows, count: rows.length, expectation };
  }

  return {
    serviceVersionId,
    isEditable: version.status === "draft",
    groups: [
      {
        groupName: "What the client sees",
        categories: [category("includedItems", includedItems, "optional"), category("addOns", addOns, "optional")],
      },
      {
        groupName: "Day-of operations",
        categories: [
          category("checklistItems", checklistItems, "expected"),
          category("timelineItems", timelineItems, "expected"),
          category("travelItems", travelItems, "optional"),
        ],
      },
      {
        groupName: "Before the event — readiness",
        categories: [
          category("questionnaireQuestions", questionnaireQuestions, "expected"),
          category("requiredDocuments", requiredDocuments, "optional"),
          category("approvalItems", approvalItems, "optional"),
        ],
      },
      {
        groupName: "Resources & staffing",
        categories: [
          category("inventoryItems", inventoryItems, "optional"),
          category("purchaseItems", purchaseItems, "optional"),
          category("vendorSuggestions", vendorSuggestions, "optional"),
          category("teamRoleRequirements", teamRoleRequirements, "expected"),
          category("capabilityRequirements", capabilityRequirements, "optional"),
        ],
      },
      {
        groupName: "Financial planning",
        categories: [category("budgetLines", budgetLines, "expected")],
      },
      {
        groupName: "Planning intelligence",
        categories: [category("aiKnowledgeItems", aiKnowledgeItems, "optional"), category("seasonalWindows", seasonalWindows, "optional")],
      },
    ],
  };
}

import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const checklistDocumentType: DocumentTypeDefinition = {
  id: "checklist",
  label: "Checklist",
  description: "A task list document for an Event — internal or Client-facing.",
  icon: "ListChecks",
  suggestedMergeFieldKeys: ["workspace_name", "event_title", "event_date"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const questionnaireDocumentType: DocumentTypeDefinition = {
  id: "questionnaire",
  label: "Questionnaire",
  description: "A form-style document collecting a Client's own preferences ahead of an Event.",
  icon: "ClipboardList",
  suggestedMergeFieldKeys: ["workspace_name", "client_name", "partner_name", "event_title"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

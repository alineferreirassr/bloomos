import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const welcomeGuideDocumentType: DocumentTypeDefinition = {
  id: "welcome-guide",
  label: "Welcome Guide",
  description: "An onboarding document sent to a new Client — what to expect, how to reach the team.",
  icon: "BookOpen",
  suggestedMergeFieldKeys: ["workspace_name", "client_name", "partner_name", "event_title", "event_date"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

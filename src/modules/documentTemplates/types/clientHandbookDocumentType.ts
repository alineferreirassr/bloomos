import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const clientHandbookDocumentType: DocumentTypeDefinition = {
  id: "client-handbook",
  label: "Client Handbook",
  description: "A comprehensive reference guide for a Client — policies, what to expect, and how to work with the team, branded to the Workspace.",
  icon: "Library",
  suggestedMergeFieldKeys: ["brand_name", "brand_website", "client_name", "workspace_name"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

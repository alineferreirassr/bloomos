import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const proposalDocumentType: DocumentTypeDefinition = {
  id: "proposal",
  label: "Proposal",
  description: "A client-facing proposal document — services, timeline, and recommendations.",
  icon: "FileText",
  suggestedMergeFieldKeys: ["workspace_name", "client_name", "partner_name", "event_title", "event_date", "event_location", "client_proposal_history"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

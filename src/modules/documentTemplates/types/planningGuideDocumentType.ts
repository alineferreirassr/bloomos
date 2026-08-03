import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const planningGuideDocumentType: DocumentTypeDefinition = {
  id: "planning-guide",
  label: "Planning Guide",
  description: "A timeline and milestone guide for a Client's own Event — what happens when, and what's needed from them along the way.",
  icon: "Map",
  suggestedMergeFieldKeys: ["client_name", "event_title", "event_date", "journey_stage"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

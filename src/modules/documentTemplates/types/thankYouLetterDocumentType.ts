import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const thankYouLetterDocumentType: DocumentTypeDefinition = {
  id: "thank-you-letter",
  label: "Thank You Letter",
  description: "A closing-out note sent once a Client's own Event has wrapped — the Client Journey's own natural next document after a completed Event.",
  icon: "Heart",
  suggestedMergeFieldKeys: ["client_name", "event_title", "journey_stage", "brand_name"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

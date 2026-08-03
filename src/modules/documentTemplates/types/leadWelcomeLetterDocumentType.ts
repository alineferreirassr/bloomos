import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const leadWelcomeLetterDocumentType: DocumentTypeDefinition = {
  id: "lead-welcome-letter",
  label: "Lead Welcome Letter",
  description: "A first-touch letter sent to a new Lead before they become a Client — the pre-Client counterpart to the Welcome Guide.",
  icon: "Mail",
  suggestedMergeFieldKeys: ["lead_name", "lead_event_type", "brand_name", "brand_website"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

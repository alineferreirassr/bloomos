import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const faqDocumentType: DocumentTypeDefinition = {
  id: "faq",
  label: "FAQ",
  description: "A branded, reusable answer sheet for the questions Clients ask most — shareable on its own or bundled with other documents.",
  icon: "MessageCircleQuestion",
  suggestedMergeFieldKeys: ["brand_name", "brand_website", "brand_footer_text"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

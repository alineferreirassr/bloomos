import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const vendorReferralLetterDocumentType: DocumentTypeDefinition = {
  id: "vendor-referral-letter",
  label: "Vendor Referral Letter",
  description: "A branded introduction letter referring a Client to a trusted Vendor — the one Vendor-facing document type in this Library.",
  icon: "Handshake",
  suggestedMergeFieldKeys: ["vendor_name", "vendor_contact_email", "brand_name", "client_name"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

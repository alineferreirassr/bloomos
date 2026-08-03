import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const contractDocumentType: DocumentTypeDefinition = {
  id: "contract",
  label: "Contract",
  description: "A binding agreement generated for a Client — services, timeline, and payment terms.",
  icon: "FileSignature",
  suggestedMergeFieldKeys: [
    "workspace_name",
    "client_name",
    "partner_name",
    "event_title",
    "event_date",
    "event_location",
    "contract_total",
    "contract_deposit_amount",
    "contract_remaining_balance",
  ],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

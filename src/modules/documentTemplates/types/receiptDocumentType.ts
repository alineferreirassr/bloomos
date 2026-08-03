import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const receiptDocumentType: DocumentTypeDefinition = {
  id: "receipt",
  label: "Receipt",
  description: "A proof-of-payment document for a Client, generated once an Invoice is paid.",
  icon: "ReceiptText",
  suggestedMergeFieldKeys: ["workspace_name", "client_name", "invoice_number", "invoice_total", "invoice_balance"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

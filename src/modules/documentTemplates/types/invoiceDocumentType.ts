import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const invoiceDocumentType: DocumentTypeDefinition = {
  id: "invoice",
  label: "Invoice",
  description: "A billing document for a Client — line totals, tax, and payment terms.",
  icon: "Receipt",
  suggestedMergeFieldKeys: [
    "workspace_name",
    "client_name",
    "invoice_number",
    "invoice_subtotal",
    "invoice_tax",
    "invoice_discount",
    "invoice_total",
    "invoice_balance",
    "invoice_due_date",
    "invoice_payment_terms",
  ],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};

import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";

export const GENERATE_INVOICE_DOCUMENT_ACTION_ID = "generate-invoice-document";

const generateInvoiceDocumentAction = makeGenerateDocumentAction({
  id: GENERATE_INVOICE_DOCUMENT_ACTION_ID,
  name: "Generate Invoice",
  description: "Compiles the Workspace's own published Invoice Template into a real Document, through the Document Compiler.",
  documentTypeId: "invoice",
  category: "finance",
});

export default generateInvoiceDocumentAction;

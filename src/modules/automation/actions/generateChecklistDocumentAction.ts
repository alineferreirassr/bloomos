import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";

export const GENERATE_CHECKLIST_DOCUMENT_ACTION_ID = "generate-checklist-document";

const generateChecklistDocumentAction = makeGenerateDocumentAction({
  id: GENERATE_CHECKLIST_DOCUMENT_ACTION_ID,
  name: "Generate Checklist",
  description: "Compiles the Workspace's own published Checklist Template into a real Document, through the Document Compiler.",
  documentTypeId: "checklist",
  category: "operations",
});

export default generateChecklistDocumentAction;

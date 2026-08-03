import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";

export const GENERATE_WELCOME_GUIDE_DOCUMENT_ACTION_ID = "generate-welcome-guide-document";

const generateWelcomeGuideDocumentAction = makeGenerateDocumentAction({
  id: GENERATE_WELCOME_GUIDE_DOCUMENT_ACTION_ID,
  name: "Generate Welcome Guide",
  description: "Compiles the Workspace's own published Welcome Guide Template into a real Document, through the Document Compiler.",
  documentTypeId: "welcome-guide",
  category: "crm",
});

export default generateWelcomeGuideDocumentAction;

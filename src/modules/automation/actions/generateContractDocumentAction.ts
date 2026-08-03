import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";

export const GENERATE_CONTRACT_DOCUMENT_ACTION_ID = "generate-contract-document";

const generateContractDocumentAction = makeGenerateDocumentAction({
  id: GENERATE_CONTRACT_DOCUMENT_ACTION_ID,
  name: "Generate Contract",
  description: "Compiles the Workspace's own published Contract Template into a real Document, through the Document Compiler.",
  documentTypeId: "contract",
  category: "crm",
});

export default generateContractDocumentAction;

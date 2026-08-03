import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";

export const GENERATE_PROPOSAL_DOCUMENT_ACTION_ID = "generate-proposal-document";

/**
 * Distinct from Checkpoint 9's own `generate-proposal` Action — that one
 * runs the Proposal Generator Skill and produces a JSON `ProposalDraft`;
 * this one compiles the Workspace's own published Proposal Template into a
 * real, formatted Document. The two are different pipeline stages, not
 * duplicates: a Proposal Draft is reviewed content, a compiled Document is
 * the client-facing artifact.
 */
const generateProposalDocumentAction = makeGenerateDocumentAction({
  id: GENERATE_PROPOSAL_DOCUMENT_ACTION_ID,
  name: "Generate Proposal Document",
  description: "Compiles the Workspace's own published Proposal Template into a real Document, through the Document Compiler.",
  documentTypeId: "proposal",
  category: "proposal",
});

export default generateProposalDocumentAction;

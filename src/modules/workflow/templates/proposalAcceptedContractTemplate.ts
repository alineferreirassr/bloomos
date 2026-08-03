import type { WorkflowTemplate } from "@/types/workflow";

/**
 * "Proposal Accepted → Generate Contract → Create Notification → Create
 * Memory" — built entirely from Checkpoint 10/12's own already-registered
 * node types: `trigger.proposal-accepted`, `action.generate-contract-document`
 * (the real Document Compiler action, not a stub), `action.create-notification`,
 * `action.create-memory`. Positions are just a readable left-to-right
 * layout — the Canvas re-lays nothing out automatically, so a Template's
 * own `graph` needs real, non-overlapping coordinates.
 */
export const proposalAcceptedContractTemplate: WorkflowTemplate = {
  id: "template.proposal-accepted-contract",
  name: "Proposal Accepted → Contract",
  description: "When a Proposal is accepted, generate the Contract, notify the team, and record what happened as Memory.",
  category: "proposal",
  graph: {
    variables: [],
    nodes: [
      { id: "start", kind: "start", nodeTypeId: "control.start", position: { x: 40, y: 200 }, label: "Start", data: {} },
      { id: "trigger", kind: "trigger", nodeTypeId: "trigger.proposal-accepted", position: { x: 300, y: 200 }, label: "Proposal Accepted", data: {} },
      { id: "generate-contract", kind: "action", nodeTypeId: "action.generate-contract-document", position: { x: 560, y: 200 }, label: "Generate Contract", data: {} },
      { id: "notify", kind: "action", nodeTypeId: "action.create-notification", position: { x: 820, y: 200 }, label: "Create Notification", data: {} },
      { id: "memory", kind: "action", nodeTypeId: "action.create-memory", position: { x: 1080, y: 200 }, label: "Create Memory", data: {} },
      { id: "end", kind: "end", nodeTypeId: "control.end", position: { x: 1340, y: 200 }, label: "End", data: {} },
    ],
    edges: [
      { id: "e-start-trigger", sourceNodeId: "start", targetNodeId: "trigger", branch: null },
      { id: "e-trigger-contract", sourceNodeId: "trigger", targetNodeId: "generate-contract", branch: null },
      { id: "e-contract-notify", sourceNodeId: "generate-contract", targetNodeId: "notify", branch: null },
      { id: "e-notify-memory", sourceNodeId: "notify", targetNodeId: "memory", branch: null },
      { id: "e-memory-end", sourceNodeId: "memory", targetNodeId: "end", branch: null },
    ],
  },
};

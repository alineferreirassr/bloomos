import type { WorkflowTemplate } from "@/types/workflow";

/**
 * "Invoice Paid → Update Finance → Notify CRM → Create Memory" from the
 * checkpoint's own spec — BloomOS has no dedicated ledger-mutating
 * "Update Finance" Action yet (only Finance *reporting*, via the Finance
 * Assistant Skill), so "Update Finance" is honestly represented here as
 * `action.run-skill.finance-assistant` (Checkpoint 13's own dynamically
 * discovered Skill node — see `skillActionNodes.ts`), and "Notify CRM" as
 * the real, generic `action.create-notification` (BloomOS's own one
 * notification mechanism, not a CRM-specific one). Renaming a node's own
 * *label* per template instance (`label` here, vs. the registered node
 * type's own `name`) keeps the graph honest about what actually runs while
 * still reading naturally.
 */
export const invoicePaidFinanceTemplate: WorkflowTemplate = {
  id: "template.invoice-paid-finance",
  name: "Invoice Paid → Finance Update",
  description: "When an Invoice is paid, run the Finance Assistant, notify the team, and record what happened as Memory.",
  category: "finance",
  graph: {
    variables: [],
    nodes: [
      { id: "start", kind: "start", nodeTypeId: "control.start", position: { x: 40, y: 200 }, label: "Start", data: {} },
      { id: "trigger", kind: "trigger", nodeTypeId: "trigger.invoice-paid", position: { x: 300, y: 200 }, label: "Invoice Paid", data: {} },
      { id: "finance", kind: "action", nodeTypeId: "action.run-skill.finance-assistant", position: { x: 560, y: 200 }, label: "Update Finance", data: {} },
      { id: "notify", kind: "action", nodeTypeId: "action.create-notification", position: { x: 820, y: 200 }, label: "Notify CRM", data: {} },
      { id: "memory", kind: "action", nodeTypeId: "action.create-memory", position: { x: 1080, y: 200 }, label: "Create Memory", data: {} },
      { id: "end", kind: "end", nodeTypeId: "control.end", position: { x: 1340, y: 200 }, label: "End", data: {} },
    ],
    edges: [
      { id: "e-start-trigger", sourceNodeId: "start", targetNodeId: "trigger", branch: null },
      { id: "e-trigger-finance", sourceNodeId: "trigger", targetNodeId: "finance", branch: null },
      { id: "e-finance-notify", sourceNodeId: "finance", targetNodeId: "notify", branch: null },
      { id: "e-notify-memory", sourceNodeId: "notify", targetNodeId: "memory", branch: null },
      { id: "e-memory-end", sourceNodeId: "memory", targetNodeId: "end", branch: null },
    ],
  },
};

import type { WorkflowTemplate } from "@/types/workflow";

/**
 * "New Client → Run CRM Assistant → Generate Welcome Guide → Create
 * Reminder" from the checkpoint's own spec. Uses `trigger.client-created`
 * (Checkpoint 13's own new Trigger — see `triggerNodes.ts`),
 * `action.run-skill.crm-assistant` (the dynamically discovered Skill node
 * for the real CRM Assistant Skill), the real Document Compiler's
 * `action.generate-welcome-guide-document`, and `action.create-task` for
 * "Create Reminder" — `createTaskAction.ts`'s own implementation already
 * records its to-do as a Note with `category: "reminder"`, so this is a
 * literal reminder, not a renamed stand-in.
 */
export const newClientWelcomeTemplate: WorkflowTemplate = {
  id: "template.new-client-welcome",
  name: "New Client → Welcome",
  description: "When a new Client is recorded, run the CRM Assistant, generate their Welcome Guide, and set a follow-up reminder.",
  category: "crm",
  graph: {
    variables: [],
    nodes: [
      { id: "start", kind: "start", nodeTypeId: "control.start", position: { x: 40, y: 200 }, label: "Start", data: {} },
      { id: "trigger", kind: "trigger", nodeTypeId: "trigger.client-created", position: { x: 300, y: 200 }, label: "New Client", data: {} },
      { id: "crm-assistant", kind: "action", nodeTypeId: "action.run-skill.crm-assistant", position: { x: 560, y: 200 }, label: "Run CRM Assistant", data: {} },
      { id: "welcome-guide", kind: "action", nodeTypeId: "action.generate-welcome-guide-document", position: { x: 820, y: 200 }, label: "Generate Welcome Guide", data: {} },
      { id: "reminder", kind: "action", nodeTypeId: "action.create-task", position: { x: 1080, y: 200 }, label: "Create Reminder", data: {} },
      { id: "end", kind: "end", nodeTypeId: "control.end", position: { x: 1340, y: 200 }, label: "End", data: {} },
    ],
    edges: [
      { id: "e-start-trigger", sourceNodeId: "start", targetNodeId: "trigger", branch: null },
      { id: "e-trigger-crm", sourceNodeId: "trigger", targetNodeId: "crm-assistant", branch: null },
      { id: "e-crm-welcome", sourceNodeId: "crm-assistant", targetNodeId: "welcome-guide", branch: null },
      { id: "e-welcome-reminder", sourceNodeId: "welcome-guide", targetNodeId: "reminder", branch: null },
      { id: "e-reminder-end", sourceNodeId: "reminder", targetNodeId: "end", branch: null },
    ],
  },
};

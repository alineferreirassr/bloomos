import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const WORKFLOW_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    status: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const SIMULATION_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    workflow_id: { type: "string" },
    path_count: { type: "integer" },
    issue_count: { type: "integer" },
    occurred_at: { type: "string" },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — Workflow's own 2 built-in events. Never an execution event — this checkpoint's stop condition and Checkpoint 16's own precedent both exclude a "workflow executed via the Public API" concept; these two fire on Publish and on Simulate only. */
export function registerWorkflowWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "workflow.published", category: "workflow", name: "Workflow Published", description: "A Workflow was published, compiling to live Automations.", version: 1, payloadSchema: WORKFLOW_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "workflow.simulated", category: "workflow", name: "Workflow Simulated", description: "A Workflow's Execution Simulator was run.", version: 1, payloadSchema: SIMULATION_PAYLOAD_SCHEMA });
  registered = true;
}

import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const PORTAL_LOGIN_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    client_account_id: { type: "string" },
    client_id: { type: "string" },
    occurred_at: { type: "string" },
  },
};

const CHECKLIST_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    completed_at: { type: ["string", "null"] },
  },
};

const DOCUMENT_DOWNLOADED_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    document_id: { type: "string" },
    client_account_id: { type: "string" },
    occurred_at: { type: "string" },
  },
};

const PROPOSAL_VIEWED_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    proposal_id: { type: "string" },
    client_account_id: { type: "string" },
    occurred_at: { type: "string" },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — Client Portal's own 4 built-in events. */
export function registerPortalWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "portal.login", category: "portal", name: "Portal Login", description: "A Client signed in to the Client Portal.", version: 1, payloadSchema: PORTAL_LOGIN_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "checklist.completed", category: "portal", name: "Checklist Item Completed", description: "A Client completed a Checklist item in the Portal.", version: 1, payloadSchema: CHECKLIST_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "document.downloaded", category: "portal", name: "Document Downloaded", description: "A Client downloaded a Document from the Portal.", version: 1, payloadSchema: DOCUMENT_DOWNLOADED_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "proposal.viewed", category: "portal", name: "Proposal Viewed", description: "A Client viewed a Proposal in the Portal.", version: 1, payloadSchema: PROPOSAL_VIEWED_PAYLOAD_SCHEMA });
  registered = true;
}

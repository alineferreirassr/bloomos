import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const CLIENT_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  description: "The same redacted shape the Public API's toApiClient() produces — see core/api/mappers.ts.",
  properties: {
    id: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    email: { type: "string" },
    status: { type: "string" },
    is_returning: { type: "boolean" },
    is_vip: { type: "boolean" },
    wedding_date: { type: ["string", "null"] },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
};

const EVENT_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  description: "The same redacted shape the Public API's toApiEvent() produces — see core/api/mappers.ts.",
  properties: {
    id: { type: "string" },
    client_id: { type: "string" },
    title: { type: "string" },
    event_type: { type: "string" },
    status: { type: "string" },
    event_date: { type: ["string", "null"] },
    guest_count: { type: ["integer", "null"] },
    created_at: { type: "string" },
  },
};

const PROPOSAL_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    event_id: { type: "string" },
    status: { type: "string" },
    accepted_at: { type: ["string", "null"] },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — CRM's own 4 built-in events. */
export function registerCrmWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "A new Client was added to the Workspace.", version: 1, payloadSchema: CLIENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "client.updated", category: "crm", name: "Client Updated", description: "An existing Client's details changed.", version: 1, payloadSchema: CLIENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "event.created", category: "crm", name: "Event Created", description: "A new Event was added to the Workspace.", version: 1, payloadSchema: EVENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "proposal.accepted", category: "crm", name: "Proposal Accepted", description: "A Client accepted a Proposal.", version: 1, payloadSchema: PROPOSAL_PAYLOAD_SCHEMA });
  registered = true;
}

import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const DOCUMENT_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    templateId: { type: "string" },
    documentTypeId: { type: "string" },
    status: { type: "string" },
    currentVersion: { type: "integer" },
    createdAt: { type: "string" },
  },
};

const TEMPLATE_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    documentTypeId: { type: "string" },
    updatedAt: { type: "string" },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — Documents' own 3 built-in events. */
export function registerDocumentWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "document.generated", category: "documents", name: "Document Generated", description: "A Document was composed from a Template.", version: 1, payloadSchema: DOCUMENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "document.published", category: "documents", name: "Document Published", description: "A Document version was published (made current).", version: 1, payloadSchema: DOCUMENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "template.published", category: "documents", name: "Template Published", description: "A Document Template was published.", version: 1, payloadSchema: TEMPLATE_PAYLOAD_SCHEMA });
  registered = true;
}

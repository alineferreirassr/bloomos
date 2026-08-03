import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const EXECUTIVE_SUMMARY_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    windowKey: { type: "string" },
    executiveSummary: { type: "string" },
    performanceHighlights: { type: "array", items: { type: "string" } },
    generated_at: { type: "string" },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — Analytics' own 1 built-in event. */
export function registerAnalyticsWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "executive.summary.generated", category: "analytics", name: "Executive Summary Generated", description: "Bloom AI generated a new Executive Summary.", version: 1, payloadSchema: EXECUTIVE_SUMMARY_PAYLOAD_SCHEMA });
  registered = true;
}

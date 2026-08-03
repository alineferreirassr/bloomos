import { registerCrmWebhookEvents } from "@/modules/webhooks/events/crmEvents";
import { registerFinanceWebhookEvents } from "@/modules/webhooks/events/financeEvents";
import { registerDocumentWebhookEvents } from "@/modules/webhooks/events/documentEvents";
import { registerWorkflowWebhookEvents } from "@/modules/webhooks/events/workflowEvents";
import { registerPortalWebhookEvents } from "@/modules/webhooks/events/portalEvents";
import { registerAnalyticsWebhookEvents } from "@/modules/webhooks/events/analyticsEvents";

let registered = false;

/** Checkpoint 17, Step 1's own "every event must self-register" — the one place every built-in Webhook Event actually gets loaded, mirroring `registerBuiltinMetrics()`'s exact idempotent-loader shape. Every entry point that reads the Webhook Event Registry calls this once first. */
export function registerBuiltinWebhookEvents(): void {
  if (registered) return;
  registerCrmWebhookEvents();
  registerFinanceWebhookEvents();
  registerDocumentWebhookEvents();
  registerWorkflowWebhookEvents();
  registerPortalWebhookEvents();
  registerAnalyticsWebhookEvents();
  registered = true;
}

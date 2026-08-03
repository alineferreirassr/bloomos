import { registerAutomationConnectors } from "@/modules/marketplace/connectors/automationConnectors";
import { registerCalendarConnectors } from "@/modules/marketplace/connectors/calendarConnectors";
import { registerCommunicationConnectors } from "@/modules/marketplace/connectors/communicationConnectors";
import { registerCrmConnectors } from "@/modules/marketplace/connectors/crmConnectors";
import { registerEmailConnectors } from "@/modules/marketplace/connectors/emailConnectors";
import { registerPaymentsConnectors } from "@/modules/marketplace/connectors/paymentsConnectors";
import { registerProductivityConnectors } from "@/modules/marketplace/connectors/productivityConnectors";
import { registerStorageConnectors } from "@/modules/marketplace/connectors/storageConnectors";

let registered = false;

/** Checkpoint 18 — idempotent loader for all 12 built-in connectors, mirroring `registerBuiltinWebhookEvents()`. */
export function registerBuiltinConnectors(): void {
  if (registered) return;
  registerCalendarConnectors();
  registerStorageConnectors();
  registerEmailConnectors();
  registerCommunicationConnectors();
  registerPaymentsConnectors();
  registerAutomationConnectors();
  registerProductivityConnectors();
  registerCrmConnectors();
  registered = true;
}

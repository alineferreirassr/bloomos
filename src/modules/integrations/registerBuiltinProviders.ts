import { registerAutomationProviders } from "@/modules/integrations/providers/automationProviders";
import { registerCalendarProviders } from "@/modules/integrations/providers/calendarProviders";
import { registerCommunicationProviders } from "@/modules/integrations/providers/communicationProviders";
import { registerCrmProviders } from "@/modules/integrations/providers/crmProviders";
import { registerEmergingCategoryProviders } from "@/modules/integrations/providers/emergingCategoryProviders";
import { registerMessagingProviders } from "@/modules/integrations/providers/messagingProviders";
import { registerPaymentsProviders } from "@/modules/integrations/providers/paymentsProviders";
import { registerProductivityProviders } from "@/modules/integrations/providers/productivityProviders";
import { registerStorageProviders } from "@/modules/integrations/providers/storageProviders";

let registered = false;

/** v2 Checkpoint 22 — idempotent loader for all built-in providers (16 original + `twilio`/`dropbox` added Checkpoint 43), mirroring `registerBuiltinConnectors()` (Checkpoint 18). */
export function registerBuiltinProviders(): void {
  if (registered) return;
  registerPaymentsProviders();
  registerCalendarProviders();
  registerStorageProviders();
  registerCommunicationProviders();
  registerMessagingProviders();
  registerCrmProviders();
  registerAutomationProviders();
  registerProductivityProviders();
  registerEmergingCategoryProviders();
  registered = true;
}

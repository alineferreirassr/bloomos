import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/** v2 Checkpoint 22, Step 2 — Calendar's own built-in provider. Reuses the Marketplace's (Checkpoint 18) exact `google-calendar` connector id. */
export function registerCalendarProviders(): void {
  if (registered) return;

  registerProvider({
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    icon: "Calendar",
    version: 2,
    capabilities: ["calendar", "oauth"],
    // v2 Checkpoint 43 — a real GoogleCalendarProvider (core/integrations/providers/googleCalendar/)
    // now implements CalendarProvider against the real Google Calendar REST API. No OAuth client is
    // configured in this environment, so the connection remains unverified — see docs/calendar-integration.md.
    description: "Sync Event schedules to an external Google Calendar. Real adapter implemented; connection unverified — no OAuth client credentials are configured in this environment.",
    requiredPermission: "integrations.calendar",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: ["event.created"],
    oauth: {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      defaultScopes: ["https://www.googleapis.com/auth/calendar"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registered = true;
}

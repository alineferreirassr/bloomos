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

  // GCAL-02 — a deliberate, second, separate provider id for the same
  // real-world service (Google Calendar) — an explicit exception to this
  // registry's usual "one id per real-world service" convention (see
  // `ProviderDefinition.id`'s own doc comment), justified by GCAL-01's own
  // audit: the entry above is workspace-owned, write-capable, and exists
  // to push BloomOS Events out via the Workflow/Marketplace automation
  // platform (`event.created`) — a different purpose, ownership model,
  // and required scope than a member's own personal, read-only calendar
  // connection. Reusing the entry above (or narrowing its scope) would
  // either violate least-privilege for the new read-only use, or regress
  // the existing outbound adapter's write capability for any newly
  // established connection — both explicitly rejected. This entry is
  // member-owned (see `MEMBER_OWNED_PROVIDER_IDS` in
  // `manageOAuthConnectionActions.ts`), requests only
  // `calendar.readonly`, and reuses the same underlying Google OAuth
  // client credentials (`GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`,
  // see `oauthTokenExchange.ts`) as the entry above — two separate BloomOS
  // connections/consent flows against the same real Google Cloud OAuth
  // client, exactly like Gmail and this file's own `google-calendar` are
  // already two separate provider ids for two different Google products.
  registerProvider({
    id: "google-calendar-readonly",
    name: "Google Calendar — Personal Read-Only",
    category: "calendar",
    icon: "Calendar",
    version: 1,
    capabilities: ["calendar", "oauth"],
    description:
      "Connect your own Google Calendar, read-only — used to identify your account. Deliberately a separate connection from the workspace-owned \"Google Calendar\" provider above (which pushes BloomOS Events out and keeps its own broader scope unchanged): this one is member-owned, requests only read access, and never creates, updates, or deletes anything in your calendar. No OAuth client credentials are configured in this environment, so the connection remains unverified.",
    requiredPermission: "integrations.calendar",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      defaultScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registered = true;
}

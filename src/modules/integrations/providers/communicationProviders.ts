import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/**
 * v2 Checkpoint 22, Step 2 — Communication's own 4 built-in providers.
 * `slack` reuses the Marketplace's (Checkpoint 18) exact connector id.
 * `gmail`/`outlook` were their own `email` category in the Marketplace
 * (`types/connector.ts`'s `ConnectorCategory`) — `ProviderCategory` has no
 * separate `email` value, so both fold into `communication` here, a
 * deliberate simplification, not an oversight.
 */
export function registerCommunicationProviders(): void {
  if (registered) return;

  registerProvider({
    id: "slack",
    name: "Slack",
    category: "communication",
    icon: "Hash",
    version: 1,
    capabilities: ["messaging", "oauth", "webhook"],
    description: "Post Event and Automation notifications into a Slack channel. Infrastructure only — no real Slack workspace is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: ["checklist.completed"],
    oauth: {
      authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
      tokenEndpoint: "https://slack.com/api/oauth.v2.access",
      defaultScopes: ["chat:write"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "discord",
    name: "Discord",
    category: "communication",
    icon: "MessageCircle",
    version: 1,
    capabilities: ["messaging", "oauth"],
    description: "Post Event and Automation notifications into a Discord server. Infrastructure only — no real Discord server is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
      tokenEndpoint: "https://discord.com/api/oauth2/token",
      revocationEndpoint: "https://discord.com/api/oauth2/token/revoke",
      defaultScopes: ["webhook.incoming"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "gmail",
    name: "Gmail",
    category: "communication",
    icon: "Mail",
    version: 2,
    capabilities: ["communication", "oauth"],
    // v2 Checkpoint 43 — a real GmailProvider (core/integrations/providers/gmail/) now implements
    // CommunicationProvider.sendEmail against the real Gmail REST API. No OAuth client is configured
    // in this environment, so the connection remains unverified — see docs/email-integration.md.
    description: "Send approved Communication Template emails through a connected Gmail account. Real adapter implemented; connection unverified — no OAuth client credentials are configured in this environment.",
    requiredPermission: "integrations.email",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: ["proposal.accepted"],
    oauth: {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      defaultScopes: ["https://www.googleapis.com/auth/gmail.send"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "outlook",
    name: "Outlook",
    category: "communication",
    icon: "Inbox",
    version: 1,
    capabilities: ["communication", "oauth"],
    description: "Send Proposal and Invoice emails through a connected Outlook account. Infrastructure only — no real Outlook account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      defaultScopes: ["Mail.Send"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registered = true;
}

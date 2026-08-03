import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/**
 * v2 Checkpoint 22, Step 2 — the 4 providers covering categories the
 * Marketplace (Checkpoint 18) never built a connector for at all
 * (`accounting`, `esignature`, `ai`, `social`), so there's no existing id
 * to reuse — these are genuinely new registry entries, chosen to round
 * out `PROVIDER_CATEGORIES` to full coverage. Same discipline as every
 * other provider file: infrastructure only, no real account is ever
 * contacted.
 */
export function registerEmergingCategoryProviders(): void {
  if (registered) return;

  registerProvider({
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    icon: "Calculator",
    version: 1,
    capabilities: ["accounting", "oauth"],
    description: "Post paid Invoices and Journal Entries to an external QuickBooks ledger. Infrastructure only — no real QuickBooks account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["finance.read"],
    subscribedWebhookEvents: ["invoice.paid"],
    oauth: {
      authorizationEndpoint: "https://appcenter.intuit.com/connect/oauth2",
      tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      revocationEndpoint: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
      defaultScopes: ["com.intuit.quickbooks.accounting"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "docusign",
    name: "DocuSign",
    category: "esignature",
    icon: "PenTool",
    version: 2,
    capabilities: ["signature", "webhook", "oauth"],
    // v2 Checkpoint 43 — a real DocuSignProvider (core/integrations/providers/docusign/) now implements
    // SignatureProvider/WebhookProvider against DocuSign's real REST API. No OAuth client is configured
    // in this environment, so the connection itself remains unverified — see docs/signature-integration.md.
    description: "Send Contracts out for e-signature through DocuSign. Real adapter implemented; connection unverified — no OAuth client credentials are configured in this environment.",
    requiredPermission: "integrations.signatures",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: ["proposal.accepted"],
    oauth: {
      authorizationEndpoint: "https://account.docusign.com/oauth/auth",
      tokenEndpoint: "https://account.docusign.com/oauth/token",
      defaultScopes: ["signature"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "jasper",
    name: "Jasper",
    category: "ai",
    icon: "Sparkles",
    version: 1,
    capabilities: ["ai_services", "oauth"],
    description: "Draft marketing copy for Proposals through a connected Jasper account. Infrastructure only — no real Jasper account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://api.jasper.ai/oauth/authorize",
      tokenEndpoint: "https://api.jasper.ai/oauth/token",
      defaultScopes: [],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registerProvider({
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    icon: "Linkedin",
    version: 1,
    capabilities: ["oauth"],
    description: "Share published Gallery highlights to a connected LinkedIn Page. Infrastructure only — no real LinkedIn account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
      tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
      defaultScopes: ["w_member_social"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registered = true;
}

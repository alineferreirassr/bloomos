# Provider Registry

v2 Checkpoint 22, Step 2. A plain `Map`-based registry (`core/integrations/providerRegistry.ts`) — the exact same shape as every other registry in this codebase (`core/webhooks/eventRegistry.ts`, `core/marketplace/connectorRegistry.ts`, `core/automation/actionRegistry.ts`, `core/ai/skills/registry.ts`). Never a class. Built-in providers self-register from their own file under `modules/integrations/providers/`, loaded once via `registerBuiltinProviders()`.

## Reuse over duplication

4 of the 16 built-in providers reuse the Marketplace's (Checkpoint 18) **exact connector id** — the same real-world service, referenced through two separate registries (this one is capability-based; Marketplace's is category-based), never a second colliding id:

| Provider id | Also a Marketplace connector? |
|---|---|
| `stripe` | Yes |
| `slack` | Yes |
| `google-calendar` | Yes |
| `google-drive` | Yes |

The remaining 8 Marketplace connectors (`paypal`, `discord`, `gmail`, `outlook`, `hubspot`, `zapier`, `make`, `notion`) are also reused by id in the Provider Registry, for the same reason — one real service, one id, everywhere it's referenced. Only 4 providers are genuinely new registry entries, covering the 4 `ProviderCategory` values Marketplace never built a connector for at all: `accounting`, `esignature`, `ai`, `social`.

## Every registered provider

| Provider | Category | Capabilities | Reused from Marketplace |
|---|---|---|---|
| Stripe | payments | payment, webhook, oauth | Yes |
| PayPal | payments | payment, oauth | Yes |
| Google Calendar | calendar | calendar, oauth | Yes |
| Google Drive | storage | storage, oauth | Yes |
| Slack | communication | messaging, oauth, webhook | Yes |
| Discord | communication | messaging, oauth | Yes |
| Gmail | communication | communication, oauth | Yes |
| Outlook | communication | communication, oauth | Yes |
| HubSpot | crm | oauth, webhook | Yes |
| Zapier | automation | webhook | Yes |
| Make | automation | webhook | Yes |
| Notion | productivity | oauth, storage | Yes |
| QuickBooks | accounting | accounting, oauth | No — new category |
| DocuSign | esignature | webhook, oauth | No — new category |
| Jasper | ai | ai_services, oauth | No — new category |
| LinkedIn | social | oauth | No — new category |

`gmail`/`outlook` were their own `email` `ConnectorCategory` in the Marketplace — `ProviderCategory` has no separate `email` value, so both fold into `communication` here, a deliberate simplification.

## Why `quickbooks`/`docusign`/`jasper`/`linkedin`, specifically

The checkpoint's own stop condition explicitly names Stripe, Google, OpenAI, Anthropic, Twilio, and Microsoft as providers this checkpoint must never *connect*. Declarative metadata-only registry entries for real, distinct services outside that named list were chosen for the 4 categories with no existing Marketplace connector, so no entry in this registry could be read as connecting (even declaratively) to one of the explicitly named providers.

## `ProviderDefinition` shape

```ts
interface ProviderDefinition {
  id: string;
  name: string;
  category: ProviderCategory;       // 12 values
  icon: string;                     // resolved by the UI, never a component reference
  version: number;
  capabilities: ProviderCapability[]; // which sdk.ts interface(s) it implements
  description: string;
  requiredPermission: Permission;   // always workspace.manage today
  requiredApiScopes: ApiScope[];    // declared, never enforced against a real request
  subscribedWebhookEvents: WebhookEventType[]; // metadata only
  oauth?: ProviderOAuthMetadata;    // present only for capabilities.includes("oauth")
}
```

`oauth` metadata (`authorizationEndpoint`/`tokenEndpoint`/`defaultScopes`/`supportsPkce`) uses each provider's real, publicly documented OAuth 2.0 endpoints — never called by anything in this checkpoint (see `docs/oauth-engine.md`). This is the shape a real handshake would need; declaring it correctly is what makes wiring in a real SDK implementation "minimal effort," per the checkpoint's own success criterion.

## Registry API

```ts
registerProvider(definition: ProviderDefinition): void
unregisterProvider(id: string): void
getProvider(id: string): ProviderDefinition | undefined
listProviders(): ProviderDefinition[]
listProvidersByCategory(category: ProviderCategory): ProviderDefinition[]
resetProviderRegistry(): void // test-only
```


## v2 Checkpoint 43 additions

5 provider definitions were updated in place (not replaced) to point at a real adapter instead of a metadata-only placeholder: `google-calendar`, `gmail`, `google-drive` (existing entries, `version` bumped, `description` updated to disclose the real adapter), plus one genuinely new file, `modules/integrations/providers/messagingProviders.ts`, registering `twilio`. `docusign` (already registered in `emergingCategoryProviders.ts`) gained the `signature` capability and moved off placeholder status. No provider id changed — the same "never a second, colliding id for the same real-world service" discipline this doc already established for the Marketplace overlap.

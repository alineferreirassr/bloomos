import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/** v2 Checkpoint 22, Step 2 — Storage's own built-in provider(s). `google-drive` reuses the Marketplace's (Checkpoint 18) exact connector id. */
export function registerStorageProviders(): void {
  if (registered) return;

  registerProvider({
    id: "google-drive",
    name: "Google Drive",
    category: "storage",
    icon: "HardDrive",
    version: 2,
    capabilities: ["storage", "oauth"],
    // v2 Checkpoint 43 — a real GoogleDriveProvider (core/integrations/providers/googleDrive/) now
    // implements StorageProvider against the real Google Drive REST API. No OAuth client is configured
    // in this environment, so the connection remains unverified — see docs/storage-integration.md.
    description: "Back Documents and Gallery assets up to an external Google Drive folder. Real adapter implemented; connection unverified — no OAuth client credentials are configured in this environment.",
    requiredPermission: "integrations.storage",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: ["document.generated"],
    oauth: {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
      defaultScopes: ["https://www.googleapis.com/auth/drive.file"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  // v2 Checkpoint 43 — Dropbox is provider-ready only (metadata registered, no adapter
  // implementation) per the checkpoint's own "priority: Google Drive, Dropbox may remain
  // provider-ready" scoping. Genuinely new id — neither registry had it before.
  registerProvider({
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    icon: "Box",
    version: 1,
    capabilities: ["storage", "oauth"],
    description: "Back Documents and Gallery assets up to an external Dropbox folder. Provider-ready only — no adapter implementation exists yet, and no real Dropbox account is ever contacted.",
    requiredPermission: "integrations.storage",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: [],
    oauth: {
      authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
      tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
      defaultScopes: ["files.content.write", "files.content.read"],
      supportsPkce: true,
    },
  } satisfies ProviderDefinition);

  registered = true;
}

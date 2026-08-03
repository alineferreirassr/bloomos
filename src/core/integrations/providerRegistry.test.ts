import { beforeEach, describe, expect, it } from "vitest";
import { getProvider, listProviders, listProvidersByCategory, registerProvider, resetProviderRegistry, unregisterProvider } from "@/core/integrations/providerRegistry";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import type { ProviderDefinition } from "@/core/integrations/types";

const sample: ProviderDefinition = {
  id: "sample-provider",
  name: "Sample Provider",
  category: "productivity",
  icon: "Star",
  version: 1,
  capabilities: ["oauth"],
  description: "A test-only provider.",
  requiredPermission: "workspace.manage",
  requiredApiScopes: [],
  subscribedWebhookEvents: [],
};

beforeEach(() => {
  resetProviderRegistry();
});

describe("providerRegistry", () => {
  it("registers and retrieves a provider by id", () => {
    registerProvider(sample);
    expect(getProvider("sample-provider")).toEqual(sample);
  });

  it("unregisters a provider", () => {
    registerProvider(sample);
    unregisterProvider("sample-provider");
    expect(getProvider("sample-provider")).toBeUndefined();
  });

  it("filters by category", () => {
    registerProvider(sample);
    registerProvider({ ...sample, id: "sample-2", category: "payments" });
    expect(listProvidersByCategory("productivity")).toHaveLength(1);
    expect(listProviders()).toHaveLength(2);
  });
});

describe("registerBuiltinProviders", () => {
  it("registers at least 14 providers exactly once (idempotent), reusing the Marketplace's exact ids for the 4 overlapping services", () => {
    resetProviderRegistry();
    registerBuiltinProviders();
    registerBuiltinProviders();

    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(14);
    expect(new Set(providers.map((p) => p.id)).size).toBe(providers.length);
    for (const id of ["stripe", "slack", "google-calendar", "google-drive"]) {
      expect(getProvider(id)).toBeDefined();
    }
  });
});

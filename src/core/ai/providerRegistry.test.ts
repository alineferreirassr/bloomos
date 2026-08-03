import { afterEach, describe, expect, it } from "vitest";
import {
  registerAIProviderEntry,
  unregisterAIProviderEntry,
  getRegisteredAIProviderEntry,
  listRegisteredAIProviders,
  setDefaultAIProviderId,
  getDefaultAIProviderId,
  setAIProviderHealth,
  resetAIProviderRegistry,
  selectAIProviders,
} from "@/core/ai/providerRegistry";
import type { AIProvider } from "@/core/ai/types";

function stubProvider(name: string): AIProvider {
  return { name, complete: async () => ({ content: "ok", requiresApproval: true, model: `${name}-model`, finishReason: "stop" }) };
}

describe("AI provider registry", () => {
  afterEach(() => resetAIProviderRegistry());

  it("registers and retrieves a provider entry", () => {
    registerAIProviderEntry({ id: "primary", provider: stubProvider("primary"), capabilities: ["text_generation"] });
    const entry = getRegisteredAIProviderEntry("primary");
    expect(entry?.provider.name).toBe("primary");
    expect(entry?.health.availability).toBe("available");
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerAIProviderEntry({ id: "primary", provider: stubProvider("v1"), capabilities: [] });
    registerAIProviderEntry({ id: "primary", provider: stubProvider("v2"), capabilities: [] });
    expect(listRegisteredAIProviders()).toHaveLength(1);
    expect(getRegisteredAIProviderEntry("primary")?.provider.name).toBe("v2");
  });

  it("removes a provider entry and clears the default if it pointed there", () => {
    registerAIProviderEntry({ id: "primary", provider: stubProvider("primary"), capabilities: [] });
    setDefaultAIProviderId("primary");
    unregisterAIProviderEntry("primary");
    expect(getRegisteredAIProviderEntry("primary")).toBeUndefined();
    expect(getDefaultAIProviderId()).toBeUndefined();
  });

  it("updates health for a registered provider without touching other fields", () => {
    registerAIProviderEntry({ id: "primary", provider: stubProvider("primary"), capabilities: ["text_generation"] });
    setAIProviderHealth("primary", { availability: "degraded", lastError: "slow" });
    const entry = getRegisteredAIProviderEntry("primary");
    expect(entry?.health.availability).toBe("degraded");
    expect(entry?.capabilities).toEqual(["text_generation"]);
  });

  it("setting health on an unregistered id is a no-op", () => {
    expect(() => setAIProviderHealth("missing", { availability: "unavailable" })).not.toThrow();
  });

  describe("selectAIProviders", () => {
    it("returns an empty list when nothing is registered", () => {
      expect(selectAIProviders()).toEqual([]);
    });

    it("orders preferred, then fallbacks in order, then the default, de-duplicated", () => {
      registerAIProviderEntry({ id: "a", provider: stubProvider("a"), capabilities: [] });
      registerAIProviderEntry({ id: "b", provider: stubProvider("b"), capabilities: [] });
      registerAIProviderEntry({ id: "c", provider: stubProvider("c"), capabilities: [] });
      setDefaultAIProviderId("c");

      const result = selectAIProviders({ preferredProviderId: "b", fallbackProviderIds: ["a", "c", "b"] });
      expect(result.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
    });

    it("excludes providers missing a required capability", () => {
      registerAIProviderEntry({ id: "a", provider: stubProvider("a"), capabilities: ["text_generation"] });
      registerAIProviderEntry({ id: "b", provider: stubProvider("b"), capabilities: ["text_generation", "vision"] });

      const result = selectAIProviders({ requiredCapabilities: ["vision"], fallbackProviderIds: ["a", "b"] });
      expect(result.map((entry) => entry.id)).toEqual(["b"]);
    });

    it("excludes an unavailable provider but keeps a degraded one", () => {
      registerAIProviderEntry({ id: "a", provider: stubProvider("a"), capabilities: [] });
      registerAIProviderEntry({ id: "b", provider: stubProvider("b"), capabilities: [] });
      setAIProviderHealth("a", { availability: "unavailable" });
      setAIProviderHealth("b", { availability: "degraded" });

      const result = selectAIProviders({ fallbackProviderIds: ["a", "b"] });
      expect(result.map((entry) => entry.id)).toEqual(["b"]);
    });

    it("ignores an unknown preferred or fallback id rather than throwing", () => {
      registerAIProviderEntry({ id: "a", provider: stubProvider("a"), capabilities: [] });
      const result = selectAIProviders({ preferredProviderId: "ghost", fallbackProviderIds: ["also-ghost", "a"] });
      expect(result.map((entry) => entry.id)).toEqual(["a"]);
    });
  });
});

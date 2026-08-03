import { afterEach, describe, expect, it } from "vitest";
import { registerConnector, unregisterConnector, getConnector, listConnectors, listConnectorsByCategory, resetConnectorRegistry } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

function definition(overrides: Partial<ConnectorDefinition> = {}): ConnectorDefinition {
  return {
    id: "test-connector",
    name: "Test Connector",
    category: "productivity",
    icon: "FileText",
    version: 1,
    status: "available",
    description: "A test connector.",
    requiredPermission: "workspace.manage",
    configSchema: [],
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: [],
    ...overrides,
  };
}

afterEach(() => {
  resetConnectorRegistry();
});

describe("connectorRegistry", () => {
  it("registers and retrieves a definition by id", () => {
    registerConnector(definition());
    expect(getConnector("test-connector")?.name).toBe("Test Connector");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getConnector("test-connector")).toBeUndefined();
  });

  it("lists every registered definition", () => {
    registerConnector(definition({ id: "a" }));
    registerConnector(definition({ id: "b", category: "crm" }));
    expect(listConnectors()).toHaveLength(2);
  });

  it("filters by category", () => {
    registerConnector(definition({ id: "a", category: "productivity" }));
    registerConnector(definition({ id: "b", category: "crm" }));
    expect(listConnectorsByCategory("crm").map((d) => d.id)).toEqual(["b"]);
  });

  it("unregister removes a definition", () => {
    registerConnector(definition());
    unregisterConnector("test-connector");
    expect(getConnector("test-connector")).toBeUndefined();
  });

  it("registering the same id twice overwrites, never duplicates in listConnectors", () => {
    registerConnector(definition({ name: "First" }));
    registerConnector(definition({ name: "Second" }));
    expect(listConnectors()).toHaveLength(1);
    expect(getConnector("test-connector")?.name).toBe("Second");
  });

  it("reset clears the entire registry", () => {
    registerConnector(definition());
    resetConnectorRegistry();
    expect(listConnectors()).toHaveLength(0);
  });
});

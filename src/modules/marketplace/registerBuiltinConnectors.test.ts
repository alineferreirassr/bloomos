import { describe, expect, it } from "vitest";
import { registerBuiltinConnectors } from "@/modules/marketplace/registerBuiltinConnectors";
import { listConnectors, resetConnectorRegistry } from "@/core/marketplace/connectorRegistry";
import { CONNECTOR_CATEGORIES } from "@/types/connector";

describe("registerBuiltinConnectors", () => {
  it("registers all 12 built-in connectors exactly once, idempotently, each with a valid category", () => {
    resetConnectorRegistry();
    registerBuiltinConnectors();
    registerBuiltinConnectors();

    const connectors = listConnectors();
    expect(connectors).toHaveLength(12);
    expect(new Set(connectors.map((c) => c.id)).size).toBe(12);
    for (const connector of connectors) {
      expect(CONNECTOR_CATEGORIES).toContain(connector.category);
      expect(connector.requiredPermission).toBe("workspace.manage");
      expect(connector.status).toBe("available");
    }

    const ids = connectors.map((c) => c.id).sort();
    expect(ids).toEqual(
      [
        "discord",
        "gmail",
        "google-calendar",
        "google-drive",
        "hubspot",
        "make",
        "notion",
        "outlook",
        "paypal",
        "slack",
        "stripe",
        "zapier",
      ].sort(),
    );
  });
});

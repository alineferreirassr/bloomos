import { describe, expect, it, beforeEach } from "vitest";
import { registerSearchableEntity, getSearchableEntities, isEntitySearchable, getSearchableEntityConfig } from "@/core/search/registry";
import { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
import { nullSearchProvider, getActiveSearchProvider, setActiveSearchProvider } from "@/core/search/service";
import { rankSearchResults, runSearch } from "@/core/search/pipeline";
import type { SearchProvider, SearchResult } from "@/core/search/types";

describe("search registry", () => {
  it("registers an entity and makes it retrievable", () => {
    registerSearchableEntity({ entityType: "lead", label: "Lead", module: "CRM", route: (id) => `/leads/${id}` });

    expect(isEntitySearchable("lead")).toBe(true);
    expect(getSearchableEntityConfig("lead")?.label).toBe("Lead");
  });

  it("reports an unregistered entity type as not searchable", () => {
    expect(isEntitySearchable("workspace")).toBe(false);
  });

  it("allows registering an entity type with no route yet, for modules ahead of shipping", () => {
    registerSearchableEntity({ entityType: "contract", label: "Contract", module: "CRM" });

    const config = getSearchableEntityConfig("contract");
    expect(config).toBeDefined();
    expect(config?.route).toBeUndefined();
  });
});

describe("registerDefaultSearchableEntities", () => {
  it("registers Leads, Clients, Events, Documents, Invoices, Payments, Expenses, Inventory, and Vendors", () => {
    registerDefaultSearchableEntities();
    const registered = getSearchableEntities().map((c) => c.entityType);

    for (const entityType of ["lead", "client", "event", "document", "invoice", "payment", "expense", "inventory_item", "vendor"]) {
      expect(registered).toContain(entityType);
    }
  });

  it("gives every registered module a route, including Inventory and Vendors", () => {
    registerDefaultSearchableEntities();

    expect(getSearchableEntityConfig("lead")?.route?.("lead_1")).toBe("/leads/lead_1");
    expect(getSearchableEntityConfig("inventory_item")?.route?.("item_1")).toBe("/inventory/item_1");
    expect(getSearchableEntityConfig("vendor")?.route?.("vendor_1")).toBe("/vendors/vendor_1");
  });
});

describe("search service", () => {
  beforeEach(() => {
    setActiveSearchProvider(nullSearchProvider);
  });

  it("defaults to the null provider, which returns no results without indexing anything", async () => {
    const results = await getActiveSearchProvider().search({ workspaceId: "ws_a", term: "anything" });
    expect(results).toEqual([]);
  });

  it("allows swapping in a real provider without any caller changing", async () => {
    const stubResult = [{ entityType: "lead" as const, entityId: "lead_1", title: "Jordan Blake", route: "/leads/lead_1" }];
    const stubProvider: SearchProvider = { search: async () => stubResult };

    setActiveSearchProvider(stubProvider);
    const results = await getActiveSearchProvider().search({ workspaceId: "ws_a", term: "Jordan" });

    expect(results).toEqual(stubResult);
  });
});

describe("rankSearchResults", () => {
  const base: Omit<SearchResult, "entityId" | "score"> = { entityType: "lead", title: "x", route: "/leads/x" };

  it("sorts by score descending", () => {
    const results: SearchResult[] = [
      { ...base, entityId: "a", score: 0.2 },
      { ...base, entityId: "b", score: 0.9 },
      { ...base, entityId: "c", score: 0.5 },
    ];

    const ranked = rankSearchResults(results, { workspaceId: "ws_a", term: "x" });
    expect(ranked.map((r) => r.entityId)).toEqual(["b", "c", "a"]);
  });

  it("treats a missing score as lower than any scored result, without crashing", () => {
    const results: SearchResult[] = [
      { ...base, entityId: "scored", score: 0.1 },
      { ...base, entityId: "unscored" },
    ];

    const ranked = rankSearchResults(results, { workspaceId: "ws_a", term: "x" });
    expect(ranked.map((r) => r.entityId)).toEqual(["scored", "unscored"]);
  });

  it("applies query.limit after ranking", () => {
    const results: SearchResult[] = [
      { ...base, entityId: "a", score: 0.2 },
      { ...base, entityId: "b", score: 0.9 },
      { ...base, entityId: "c", score: 0.5 },
    ];

    const ranked = rankSearchResults(results, { workspaceId: "ws_a", term: "x", limit: 2 });
    expect(ranked.map((r) => r.entityId)).toEqual(["b", "c"]);
  });

  it("leaves input untouched when no limit is given", () => {
    const results: SearchResult[] = [{ ...base, entityId: "a", score: 1 }];
    expect(rankSearchResults(results, { workspaceId: "ws_a", term: "x" })).toHaveLength(1);
  });
});

describe("runSearch", () => {
  it("calls the active provider then ranks its results", async () => {
    const stubProvider: SearchProvider = {
      search: async () => [
        { entityType: "lead", entityId: "low", title: "Low", route: "/leads/low", score: 0.1 },
        { entityType: "lead", entityId: "high", title: "High", route: "/leads/high", score: 0.8 },
      ],
    };
    setActiveSearchProvider(stubProvider);

    const results = await runSearch({ workspaceId: "ws_a", term: "anything" });
    expect(results.map((r) => r.entityId)).toEqual(["high", "low"]);

    setActiveSearchProvider(nullSearchProvider);
  });
});

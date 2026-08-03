import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  listServices: vi.fn(),
  listServiceCategories: vi.fn(),
  getServiceVersion: vi.fn(),
  getServiceUsageCounts: vi.fn(),
}));
vi.mock("@/lib/queries/services/health", () => ({
  getServiceHealth: vi.fn(),
}));

import { getServicesCatalog, searchServices } from "@/lib/queries/services/catalog";
import { listServices, listServiceCategories, getServiceVersion, getServiceUsageCounts } from "@/lib/data";
import { getServiceHealth } from "@/lib/queries/services/health";

function service(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "service_1", workspace_id: "ws", category_id: "cat_1", name: "Photography", description: null, status: "active", draft_version_id: "draft_1", current_published_version_id: "published_1", created_at: "", updated_at: "", archived_at: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServiceUsageCounts).mockResolvedValue({});
});

describe("getServicesCatalog", () => {
  it("joins the category name in-memory rather than a per-row lookup call", async () => {
    vi.mocked(listServices).mockResolvedValue([service()] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([{ id: "cat_1", name: "Photography", workspace_id: "ws", description: null, display_order: 0, created_at: "", updated_at: "", archived_at: null }] as never);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 80, missing: [] });

    const result = await getServicesCatalog();
    expect(result.rows[0].categoryName).toBe("Photography");
    expect(listServiceCategories).toHaveBeenCalledTimes(1);
  });

  it("resolves both draft and published version summaries in parallel", async () => {
    vi.mocked(listServices).mockResolvedValue([service()] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockImplementation((id: string) => Promise.resolve({ id } as never));
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });

    const result = await getServicesCatalog();
    expect(result.rows[0].draftVersion).toEqual({ id: "draft_1" });
    expect(result.rows[0].publishedVersion).toEqual({ id: "published_1" });
    expect(getServiceVersion).toHaveBeenCalledWith("draft_1");
    expect(getServiceVersion).toHaveBeenCalledWith("published_1");
  });

  it("leaves publishedVersion null for a Service with no published version yet", async () => {
    vi.mocked(listServices).mockResolvedValue([service({ current_published_version_id: null })] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "draft_1" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 20, missing: [] });

    const result = await getServicesCatalog();
    expect(result.rows[0].publishedVersion).toBeNull();
  });

  it("passes filters straight through to listServices without reinterpreting them", async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(listServiceCategories).mockResolvedValue([]);

    await getServicesCatalog({ status: "active", search: "photo" });
    expect(listServices).toHaveBeenCalledWith({ status: "active", search: "photo" });
  });

  it("strips usage/sortBy out before calling listServices — they're query-layer-only dimensions listServices has no concept of", async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(listServiceCategories).mockResolvedValue([]);

    await getServicesCatalog({ status: "active", usage: "assigned", sortBy: "usage" });
    expect(listServices).toHaveBeenCalledWith({ status: "active" });
  });

  it("includes usageCount on every row, fetched in exactly one getServiceUsageCounts call for the whole page — never one lookup per row", async () => {
    const services = [service({ id: "service_1" }), service({ id: "service_2" }), service({ id: "service_3" })];
    vi.mocked(listServices).mockResolvedValue(services as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 3, service_2: 0 });

    const result = await getServicesCatalog();
    expect(getServiceUsageCounts).toHaveBeenCalledTimes(1);
    expect(getServiceUsageCounts).toHaveBeenCalledWith(["service_1", "service_2", "service_3"]);
    expect(result.rows.find((r) => r.service.id === "service_1")?.usageCount).toBe(3);
    expect(result.rows.find((r) => r.service.id === "service_2")?.usageCount).toBe(0);
    expect(result.rows.find((r) => r.service.id === "service_3")?.usageCount).toBe(0);
  });

  it("filters to only assigned (usageCount > 0) Services when usage: 'assigned'", async () => {
    const services = [service({ id: "service_1" }), service({ id: "service_2" })];
    vi.mocked(listServices).mockResolvedValue(services as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 2 });

    const result = await getServicesCatalog({ usage: "assigned" });
    expect(result.rows.map((r) => r.service.id)).toEqual(["service_1"]);
  });

  it("filters to only unassigned (usageCount === 0) Services when usage: 'unassigned'", async () => {
    const services = [service({ id: "service_1" }), service({ id: "service_2" })];
    vi.mocked(listServices).mockResolvedValue(services as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 2 });

    const result = await getServicesCatalog({ usage: "unassigned" });
    expect(result.rows.map((r) => r.service.id)).toEqual(["service_2"]);
  });

  it("sorts by usage (highest first) when sortBy: 'usage'", async () => {
    const services = [service({ id: "service_1" }), service({ id: "service_2" }), service({ id: "service_3" })];
    vi.mocked(listServices).mockResolvedValue(services as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 1, service_2: 5, service_3: 3 });

    const result = await getServicesCatalog({ sortBy: "usage" });
    expect(result.rows.map((r) => r.service.id)).toEqual(["service_2", "service_3", "service_1"]);
  });
});

describe("searchServices", () => {
  it("delegates to getServicesCatalog with the query as the search filter, never a second matching implementation", async () => {
    vi.mocked(listServices).mockResolvedValue([service(), service({ id: "service_2" })] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });

    await searchServices("photo");
    expect(listServices).toHaveBeenCalledWith({ search: "photo" });
  });

  it("respects an optional result limit", async () => {
    vi.mocked(listServices).mockResolvedValue([service(), service({ id: "service_2" })] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });

    const results = await searchServices("photo", { limit: 1 });
    expect(results).toHaveLength(1);
  });

  it("forwards usage/sortBy options into the same catalog composition, including usageCount on results", async () => {
    vi.mocked(listServices).mockResolvedValue([service({ id: "service_1" }), service({ id: "service_2" })] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "v" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 4 });

    const results = await searchServices("photo", { usage: "assigned" });
    expect(results.map((r) => r.service.id)).toEqual(["service_1"]);
    expect(results[0].usageCount).toBe(4);
  });
});

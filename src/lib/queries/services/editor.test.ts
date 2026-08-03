import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getService: vi.fn(),
  getServiceVersion: vi.fn(),
  listServiceVersions: vi.fn(),
  getTimelineByServiceId: vi.fn(),
  getServiceUsageCounts: vi.fn(),
}));
vi.mock("@/lib/queries/services/health", () => ({
  getServiceHealth: vi.fn(),
}));
vi.mock("@/lib/queries/services/templateBuilder", () => ({
  getTemplateBuilder: vi.fn(),
}));
// core/workflows/serviceWorkflow is deliberately NOT mocked — getPublishPreview's
// tests below exercise the real computeNextServiceVersionNumber/
// canPublishServiceVersion pure functions, the same ones the mock/Supabase
// repositories and the publish RPC are built from.
import { getServiceEditor, getVersionHistory, getPublishPreview } from "@/lib/queries/services/editor";
import { getService, getServiceVersion, listServiceVersions, getTimelineByServiceId, getServiceUsageCounts } from "@/lib/data";
import { getServiceHealth } from "@/lib/queries/services/health";
import { getTemplateBuilder } from "@/lib/queries/services/templateBuilder";

function emptyBuilder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    serviceVersionId: "draft_1",
    isEditable: true,
    groups: [
      { groupName: "Day-of operations", categories: [{ key: "checklistItems", rows: [], count: 0, expectation: "expected" }] },
    ],
    ...overrides,
  };
}

function service(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "service_1", workspace_id: "ws", category_id: null, name: "Photography", description: null, status: "active", draft_version_id: "draft_1", current_published_version_id: "published_1", created_at: "", updated_at: "", archived_at: null, ...overrides };
}
function versionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "draft_1", service_id: "service_1", workspace_id: "ws", version_number: null, status: "draft", name_snapshot: null, description_snapshot: null, base_price_minor: 100000, currency: "USD", setup_duration_minutes: null, breakdown_duration_minutes: null, difficulty_score: null, experience_level_required: null, weather_sensitivity: "none", surprise_friendly: false, estimated_profit_minor: null, change_summary: null, published_at: null, published_by: null, created_at: "", updated_at: "", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServiceEditor", () => {
  it("composes service, draft, published version, health, and a capped recent-timeline slice in parallel", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(getServiceVersion).mockImplementation((id: string) => Promise.resolve(versionRow({ id }) as never));
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 75, missing: [] });
    vi.mocked(getTimelineByServiceId).mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ id: `t${i}` })) as never);
    vi.mocked(getServiceUsageCounts).mockResolvedValue({ service_1: 4 });

    const editor = await getServiceEditor("service_1");
    expect(editor.draftVersion.id).toBe("draft_1");
    expect(editor.publishedVersion?.id).toBe("published_1");
    expect(editor.health.percent).toBe(75);
    expect(editor.recentTimeline).toHaveLength(10);
    expect(editor.usageCount).toBe(4);
  });

  it("leaves publishedVersion null when the Service has never been published", async () => {
    vi.mocked(getService).mockResolvedValue(service({ current_published_version_id: null }) as never);
    vi.mocked(getServiceVersion).mockResolvedValue(versionRow() as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 20, missing: [] });
    vi.mocked(getTimelineByServiceId).mockResolvedValue([]);
    vi.mocked(getServiceUsageCounts).mockResolvedValue({});

    const editor = await getServiceEditor("service_1");
    expect(editor.publishedVersion).toBeNull();
    expect(getServiceVersion).toHaveBeenCalledTimes(1);
    expect(editor.usageCount).toBe(0);
  });
});

describe("getVersionHistory", () => {
  it("flags exactly the row matching the Service's own draft_version_id as the current draft", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(listServiceVersions).mockResolvedValue([versionRow({ id: "draft_1" }), versionRow({ id: "published_1", status: "published", version_number: 1 })] as never);

    const history = await getVersionHistory("service_1");
    expect(history.rows.find((r) => r.version.id === "draft_1")?.isCurrentDraft).toBe(true);
    expect(history.rows.find((r) => r.version.id === "published_1")?.isCurrentDraft).toBe(false);
  });
});

describe("getPublishPreview", () => {
  it("computes the next version number from existing version numbers and reuses canPublishServiceVersion's own blocking rule", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(getServiceVersion).mockResolvedValue(versionRow({ base_price_minor: 100000, updated_at: "2026-01-05T00:00:00.000Z" }) as never);
    vi.mocked(listServiceVersions).mockResolvedValue([
      versionRow({ id: "published_1", version_number: 1 }),
      versionRow({ id: "published_2", version_number: 2 }),
    ] as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 90, missing: [] });
    vi.mocked(getTemplateBuilder).mockResolvedValue(
      emptyBuilder({
        groups: [{ groupName: "Day-of operations", categories: [{ key: "checklistItems", rows: [{ id: "c1" }], count: 1, expectation: "expected" }] }],
      }) as never,
    );

    const preview = await getPublishPreview("service_1");
    expect(preview.nextVersionNumber).toBe(3);
    expect(preview.canPublish).toBe(true);
    expect(preview.blockingErrors).toEqual([]);
    expect(preview.draftVersionId).toBe("draft_1");
    expect(preview.draftVersionUpdatedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(preview.currentPublishedVersionNumber).toBe(1);
    expect(preview.affectedCategories).toEqual(["checklistItems"]);
    expect(preview.templateCompletion.percent).toBe(100);
    expect(preview.warnings).toEqual([]);
  });

  it("surfaces a blocking error instead of guessing when the draft isn't publishable", async () => {
    vi.mocked(getService).mockResolvedValue(service({ current_published_version_id: null }) as never);
    vi.mocked(getServiceVersion).mockResolvedValue(versionRow({ status: "published" }) as never);
    vi.mocked(listServiceVersions).mockResolvedValue([]);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });
    vi.mocked(getTemplateBuilder).mockResolvedValue(emptyBuilder() as never);

    const preview = await getPublishPreview("service_1");
    expect(preview.canPublish).toBe(false);
    expect(preview.blockingErrors).toHaveLength(1);
    expect(preview.blockingErrors[0]).toMatch(/only a draft version/i);
    expect(preview.currentPublishedVersionNumber).toBeNull();
  });

  it("turns every health.missing entry into a non-blocking warning", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(getServiceVersion).mockResolvedValue(versionRow({ base_price_minor: 100000 }) as never);
    vi.mocked(listServiceVersions).mockResolvedValue([versionRow({ version_number: 1 })] as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 60, missing: [{ label: "Budget", jumpTo: { kind: "templateCategory", category: "budgetLines" } }] });
    vi.mocked(getTemplateBuilder).mockResolvedValue(emptyBuilder() as never);

    const preview = await getPublishPreview("service_1");
    expect(preview.canPublish).toBe(true);
    expect(preview.warnings).toEqual(["Budget is missing or incomplete."]);
  });
});

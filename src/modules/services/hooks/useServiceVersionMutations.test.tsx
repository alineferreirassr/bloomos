import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  updateServiceVersionDraft: vi.fn(),
  publishServiceVersion: vi.fn(),
}));

import { useUpdateServiceVersionDraft, usePublishServiceVersion } from "@/modules/services/hooks/useServiceVersionMutations";
import { updateServiceVersionDraft, publishServiceVersion } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpdateServiceVersionDraft", () => {
  it("invalidates editor/versions/health/lists/healthDashboards, never templates(versionId) — template rows are untouched by the version's own scalar fields", async () => {
    vi.mocked(updateServiceVersionDraft).mockResolvedValue({ success: true, data: { id: "draft_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateServiceVersionDraft("service_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({
        base_price_minor: 150000,
        currency: "USD",
        setup_duration_minutes: null,
        breakdown_duration_minutes: null,
        difficulty_score: null,
        experience_level_required: null,
        weather_sensitivity: "none",
        surprise_friendly: false,
        estimated_profit_minor: null,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.editor("service_1"), serviceKeys.versions("service_1"), serviceKeys.health("service_1"), serviceKeys.lists(), serviceKeys.healthDashboards()]),
    );
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.templates("draft_1"));
  });
});

describe("usePublishServiceVersion", () => {
  it("invalidates detail(id) broadly plus templates(oldDraftId), lists(), and healthDashboards()", async () => {
    vi.mocked(publishServiceVersion).mockResolvedValue({ success: true, data: { id: "draft_1", version_number: 1, status: "published" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePublishServiceVersion("service_1", "draft_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ change_summary: "Initial release" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.detail("service_1"), serviceKeys.templates("draft_1"), serviceKeys.lists(), serviceKeys.healthDashboards()]),
    );
  });

  it("maps a P0022 (draft not found) style repository failure through the same error contract as every other mutation", async () => {
    vi.mocked(publishServiceVersion).mockResolvedValue({ success: false, error: "Draft version not found." } as never);

    const { result } = renderHook(() => usePublishServiceVersion("service_1", "draft_1"), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync({ change_summary: null })).rejects.toThrow("Draft version not found.");
    });
  });
});

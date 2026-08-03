import { describe, expect, it, beforeEach } from "vitest";
import { mockFeatureFlagsRepository, resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";

describe("mockFeatureFlagsRepository", () => {
  beforeEach(() => {
    resetFeatureFlagsStore();
  });

  it("treats an unset flag as disabled, never enabled by omission", async () => {
    expect(await mockFeatureFlagsRepository.isFeatureEnabled("ws_a", "calendar")).toBe(false);
  });

  it("creates a flag on first set, and lists it", async () => {
    const result = await mockFeatureFlagsRepository.setFeatureFlag("ws_a", "calendar", true);
    expect(result.success).toBe(true);
    expect(await mockFeatureFlagsRepository.isFeatureEnabled("ws_a", "calendar")).toBe(true);

    const flags = await mockFeatureFlagsRepository.listFeatureFlags("ws_a");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ workspace_id: "ws_a", key: "calendar", enabled: true });
  });

  it("updates an existing flag in place rather than duplicating it", async () => {
    await mockFeatureFlagsRepository.setFeatureFlag("ws_a", "calendar", true);
    await mockFeatureFlagsRepository.setFeatureFlag("ws_a", "calendar", false);

    const flags = await mockFeatureFlagsRepository.listFeatureFlags("ws_a");
    expect(flags).toHaveLength(1);
    expect(flags[0].enabled).toBe(false);
  });

  it("scopes flags per Workspace — one Workspace's flag never leaks into another's", async () => {
    await mockFeatureFlagsRepository.setFeatureFlag("ws_a", "calendar", true);
    expect(await mockFeatureFlagsRepository.isFeatureEnabled("ws_b", "calendar")).toBe(false);
  });

  it("rejects a blank key", async () => {
    const result = await mockFeatureFlagsRepository.setFeatureFlag("ws_a", "  ", true);
    expect(result.success).toBe(false);
  });
});

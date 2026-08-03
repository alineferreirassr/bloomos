import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { evaluateFeatureFlag, getCoreFeatureFlagsService } from "@/core/featureFlags/service";
import { getLocalFeatureFlagOverrides, hasLocalFeatureFlagOverride } from "@/core/featureFlags/localOverride";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";

// `process.env.NODE_ENV` is typed read-only by Next.js's own types — `vi.stubEnv`/`vi.unstubAllEnvs` is Vitest's built-in seam for exactly this, restoring the original value automatically.
describe("evaluateFeatureFlag", () => {
  beforeEach(() => {
    resetFeatureFlagsStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("evaluates false with no stored flag and no override", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "");
    expect(await evaluateFeatureFlag("ws_a", "calendar")).toBe(false);
  });

  it("evaluates true once the repository has the flag enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "");
    await getCoreFeatureFlagsService().setFeatureFlag("ws_a", "calendar", true);
    expect(await evaluateFeatureFlag("ws_a", "calendar")).toBe(true);
  });

  it("a local override forces true regardless of the stored value", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "calendar");
    expect(await evaluateFeatureFlag("ws_a", "calendar")).toBe(true);
  });

  it("never applies a local override in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "calendar");
    expect(hasLocalFeatureFlagOverride("calendar")).toBe(false);
    expect(await evaluateFeatureFlag("ws_a", "calendar")).toBe(false);
  });
});

describe("getLocalFeatureFlagOverrides", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses a comma-separated list, trimming whitespace", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "calendar, command_palette ,universal_search");
    expect(getLocalFeatureFlagOverrides()).toEqual(new Set(["calendar", "command_palette", "universal_search"]));
  });

  it("returns an empty set when the env var is empty", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_OVERRIDES", "");
    expect(getLocalFeatureFlagOverrides()).toEqual(new Set());
  });
});

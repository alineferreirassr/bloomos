/**
 * A local-development-only override, read from a comma-separated
 * `NEXT_PUBLIC_FEATURE_OVERRIDES` env var (e.g.
 * `NEXT_PUBLIC_FEATURE_OVERRIDES=calendar,command_palette`) — lets an
 * engineer force a flag on locally without touching the (mock, this
 * phase) Workspace-scoped store. Never consulted outside development: a
 * production build must always evaluate the real, persisted flag.
 */
export function getLocalFeatureFlagOverrides(): Set<string> {
  if (process.env.NODE_ENV === "production") return new Set();

  const raw = process.env.NEXT_PUBLIC_FEATURE_OVERRIDES ?? "";
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  );
}

export function hasLocalFeatureFlagOverride(key: string): boolean {
  return getLocalFeatureFlagOverrides().has(key);
}

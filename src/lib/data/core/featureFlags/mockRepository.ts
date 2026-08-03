import type { FeatureFlag } from "@/types/featureFlag";
import type { FeatureFlagsRepository } from "@/lib/data/core/featureFlags/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let flags: FeatureFlag[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetFeatureFlagsStore(): void {
  flags = [];
}

function findFlag(workspaceId: string, key: string): FeatureFlag | undefined {
  return flags.find((flag) => flag.workspace_id === workspaceId && flag.key === key);
}

async function listFeatureFlags(workspaceId: string): Promise<FeatureFlag[]> {
  await delay(100);
  return flags.filter((flag) => flag.workspace_id === workspaceId).sort((a, b) => a.key.localeCompare(b.key));
}

/** No stored row means "not enabled" — a flag is opt-in, never opt-out by omission. */
async function isFeatureEnabled(workspaceId: string, key: string): Promise<boolean> {
  await delay(50);
  return findFlag(workspaceId, key)?.enabled ?? false;
}

async function setFeatureFlag(workspaceId: string, key: string, enabled: boolean): Promise<DataResult<FeatureFlag>> {
  await delay(100);
  if (key.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { key: "Key is required" });
  }

  const existing = findFlag(workspaceId, key);
  if (existing) {
    const updated: FeatureFlag = { ...existing, enabled, updated_at: nowIso() };
    flags = flags.map((flag) => (flag.id === existing.id ? updated : flag));
    return ok(updated);
  }

  const created: FeatureFlag = {
    id: generateId("feature_flag"),
    workspace_id: workspaceId,
    key,
    enabled,
    updated_at: nowIso(),
  };
  flags = [...flags, created];
  return ok(created);
}

export const mockFeatureFlagsRepository: FeatureFlagsRepository = {
  listFeatureFlags,
  isFeatureEnabled,
  setFeatureFlag,
};

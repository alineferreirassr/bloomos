import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Same rationale as `workspaceContextBuilder` — formats the already-resolved
 * acting user rather than re-fetching identity. Returns `null` when no
 * `userId` was supplied, since an AI request issued without a resolvable
 * actor shouldn't fabricate one.
 */
export const userContextBuilder: AIContextBuilder = {
  key: "user",
  priority: 1,
  async build({ refs }) {
    if (!refs.userId) return null;
    return {
      data: { id: refs.userId, name: refs.userName ?? null },
      source: "caller-provided session actor",
    };
  },
};

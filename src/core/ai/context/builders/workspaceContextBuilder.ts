import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Formats the Workspace facts a caller already resolved via its own session
 * lookup (e.g. `resolveMemberSessionSnapshot`) — this builder never queries a
 * Workspace repository itself, since re-deriving auth/session state inside
 * `core/ai` would duplicate a concern that stays with the calling feature
 * (see `generateEventOperationsBrief.ts`'s own session resolution).
 */
export const workspaceContextBuilder: AIContextBuilder = {
  key: "workspace",
  priority: 0,
  async build({ workspaceId, refs }) {
    return {
      data: { id: workspaceId, name: refs.workspaceName ?? null },
      source: "caller-provided session workspace",
    };
  },
};

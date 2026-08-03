import { fetchDailyOperationsBriefMaterials } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import { buildDailyOperationsBriefContext } from "@/modules/ai/dailyBrief/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Wraps the workspace-wide Daily Brief context pipeline
 * (`fetchDailyOperationsBriefMaterials` + `buildDailyOperationsBriefContext`)
 * as a registered Context Orchestrator section — the same "wrap the fetch
 * pipeline as one builder" shape `eventContextBuilder.ts` already uses, just
 * at workspace scope. Lives in `modules/ai/dailyBrief`, not
 * `core/ai/context/builders`, for the same reason `eventContextBuilder`
 * does: it depends on feature-specific modules `core/ai` must never import.
 *
 * Requires `refs.memberId` (the acting member's own membership id, used
 * only to scope the unread-notification count to them — there is no
 * "unread notifications for the whole Workspace" concept); returns `null`
 * when it's missing, matching every other builder's "never partial data"
 * contract.
 */
export const dailyBriefContextBuilder: AIContextBuilder = {
  key: "dailyBriefContext",
  priority: 4,
  async build({ workspaceId, refs }) {
    if (!refs.memberId) return null;
    const materials = await fetchDailyOperationsBriefMaterials(workspaceId, refs.memberId);
    const context = buildDailyOperationsBriefContext(materials);
    return { data: context, source: "fetchDailyOperationsBriefMaterials+buildDailyOperationsBriefContext" };
  },
};

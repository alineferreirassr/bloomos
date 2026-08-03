import { computeVisibleMetrics } from "@/core/analytics/engine";
import { buildAnalyticsSummaryContext } from "@/modules/analytics/aiSummary/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { TrendWindowKey } from "@/types/analytics";

/**
 * Wraps the Analytics Engine as a registered Context Orchestrator section —
 * the same "wrap the fetch pipeline as one builder" shape every other
 * feature-specific builder (`dailyBriefContextBuilder`,
 * `financeAssistantContextBuilder`) already uses. Only computes metrics
 * the *requesting member* can see (Step 10's own "metrics visibility
 * aware") — `refs.permissions`/`refs.role` carry that member's own
 * already-checked session state through (the Context Orchestrator's own
 * `build()` signature only receives `workspaceId`/`refs`, a flat string
 * bag, so a permission list is passed comma-joined and parsed back here,
 * never re-derived or trusted from anywhere else).
 */
export const analyticsSummaryContextBuilder: AIContextBuilder = {
  key: "analyticsSummaryContext",
  priority: 7,
  async build({ workspaceId, refs }) {
    const windowKey = (refs.windowKey ?? "30d") as TrendWindowKey;
    const permissions = (refs.permissions ?? "").split(",").filter(Boolean) as Permission[];
    const role = (refs.role as WorkspaceMemberRole | undefined) ?? null;

    const snapshots = await computeVisibleMetrics({ workspaceId, permissions, role, windowKey });
    const context = buildAnalyticsSummaryContext(windowKey, snapshots);
    return { data: context, source: "computeVisibleMetrics+buildAnalyticsSummaryContext" };
  },
};

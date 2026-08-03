"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerAnalyticsExecutiveSummarySkill, ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID } from "@/modules/analytics/aiSummary/registerAnalyticsExecutiveSummarySkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { getLogger } from "@/core/observability/logger";
import { PERMISSIONS } from "@/core/enums/permission";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { generateId, nowIso } from "@/lib/data/utils";
import type { AnalyticsExecutiveSummaryModelOutput } from "@/modules/analytics/aiSummary/types";
import type { TrendWindowKey } from "@/types/analytics";

function publishExecutiveSummaryWebhookEvent(workspaceId: string, windowKey: TrendWindowKey, data: AnalyticsExecutiveSummaryModelOutput): void {
  const summaryId = generateId("exec-summary");
  publishWebhookEvent({
    type: "executive.summary.generated",
    workspaceId,
    resource: { type: "executive_summary", id: summaryId },
    payload: { windowKey, executiveSummary: data.executiveSummary, performanceHighlights: data.performanceHighlights, generated_at: nowIso() },
  });
}

const GENERIC_ACCESS_ERROR = "The Executive Summary isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the Executive Summary right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";

export type GenerateAnalyticsExecutiveSummaryResult = { success: true; data: AnalyticsExecutiveSummaryModelOutput } | { success: false; error: string };

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerAnalyticsExecutiveSummarySkill();
registerDefaultAIContextBuilders();

/**
 * Checkpoint 15, Step 6 — the only entry point the Analytics UI calls for
 * the Executive Summary. A thin wrapper around `executeSkill()`, the same
 * generic pipeline every other Skill uses — this feature's own
 * contribution is only its permission check and passing the requesting
 * member's own window/permissions/role through `refs` so the Context
 * Orchestrator's `analyticsSummaryContextBuilder` computes metrics scoped
 * to exactly what this member can see, never more.
 */
export async function generateAnalyticsExecutiveSummary(windowKey: TrendWindowKey): Promise<GenerateAnalyticsExecutiveSummaryResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: { windowKey, permissions: session.permissions.join(","), role: session.membership.role },
  });

  if (!result.success) {
    getLogger().warn("Analytics Executive Summary generation failed", { workspaceId: session.workspace.id, windowKey, category: result.error.category, durationMs: Date.now() - startedAt });
    return { success: false, error: mapSkillErrorToMessage(result.error, { contextUnavailable: GENERIC_ACCESS_ERROR, provider: GENERIC_PROVIDER_ERROR, malformed: MALFORMED_OUTPUT_ERROR }) };
  }

  getLogger().info("Analytics Executive Summary generated", { workspaceId: session.workspace.id, windowKey, durationMs: Date.now() - startedAt });
  const data = result.data as AnalyticsExecutiveSummaryModelOutput;
  publishExecutiveSummaryWebhookEvent(session.workspace.id, windowKey, data);
  return { success: true, data };
}

/**
 * Checkpoint 16, Step 8 — the Public API's own entry point into the same
 * Executive Summary Skill, for a request authenticated by a workspace-scoped
 * API Key. There is no member session to attribute this generation to, so
 * it uses a synthetic system actor (`userId: "api"`), mirroring the Daily
 * Operations Brief's own `source: "system"` auto-approved-actor precedent —
 * the same "no human initiated this, but it's a legitimate first-class
 * caller" shape. Full `PERMISSIONS`/`role: "owner"` are passed through for
 * the same reason `getAnalyticsDashboardDataForApiKey` uses them: the
 * `analytics.read` scope gate already governs access at the route level.
 */
export async function generateAnalyticsExecutiveSummaryForApiKey(workspaceId: string, windowKey: TrendWindowKey): Promise<GenerateAnalyticsExecutiveSummaryResult> {
  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID,
    workspaceId,
    userId: "api",
    userName: "Public API",
    permissions: [...PERMISSIONS],
    role: "owner",
    refs: { windowKey, permissions: PERMISSIONS.join(","), role: "owner" },
  });

  if (!result.success) {
    getLogger().warn("Analytics Executive Summary generation failed (API Key)", { workspaceId, windowKey, category: result.error.category, durationMs: Date.now() - startedAt });
    return { success: false, error: mapSkillErrorToMessage(result.error, { contextUnavailable: GENERIC_ACCESS_ERROR, provider: GENERIC_PROVIDER_ERROR, malformed: MALFORMED_OUTPUT_ERROR }) };
  }

  getLogger().info("Analytics Executive Summary generated (API Key)", { workspaceId, windowKey, durationMs: Date.now() - startedAt });
  const data = result.data as AnalyticsExecutiveSummaryModelOutput;
  publishExecutiveSummaryWebhookEvent(workspaceId, windowKey, data);
  return { success: true, data };
}

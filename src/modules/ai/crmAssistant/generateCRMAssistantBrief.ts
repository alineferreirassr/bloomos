"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerCRMAssistantSkill, CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { assembleCrmAssistantBrief } from "@/modules/ai/crmAssistant/assembleBrief";
import { CRM_ASSISTANT_CONTEXT_VERSION } from "@/modules/ai/crmAssistant/contextBuilder";
import { getLogger } from "@/core/observability/logger";
import type { CrmAssistantContext, CRMAssistantModelOutput, GenerateCRMAssistantBriefResult } from "@/modules/ai/crmAssistant/types";

const GENERIC_ACCESS_ERROR = "The CRM Assistant isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the CRM Assistant report right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";
const SEMANTIC_FAILURE_ERROR = "Bloom AI's CRM report referenced data that doesn't exist. Please try again.";

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerCRMAssistantSkill();
registerDefaultAIContextBuilders();

/**
 * The only entry point the UI ever calls for the CRM Assistant —
 * everything from auth through observability logging happens here,
 * server-side. Checkpoint 7's own proof of "no special execution path":
 * this is a thin wrapper around `executeSkill()`/`runSkillCompletion()`,
 * the exact same generic pipeline Proposal Generator, Event Operations
 * Brief, and Daily Operations Brief already use — this feature's own
 * contribution is only its permission check and its assembly of the
 * deterministic sections (`assembleCrmAssistantBrief`), never orchestration.
 * No execution history is persisted (unlike Daily Brief) — Checkpoint 7's
 * own spec names no "View Previous" requirement for this Skill; Step 11's
 * observability ask is satisfied by logging alone, below.
 */
export async function generateCRMAssistantBrief(): Promise<GenerateCRMAssistantBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("clients.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: CRM_ASSISTANT_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: {},
  });

  if (!result.success) {
    getLogger().warn("CRM Assistant execution failed", {
      workspaceId: session.workspace.id,
      category: result.error.category,
      latencyMs: Date.now() - startedAt,
    });
    return {
      success: false,
      error: mapSkillErrorToMessage(result.error, {
        contextUnavailable: GENERIC_ACCESS_ERROR,
        provider: GENERIC_PROVIDER_ERROR,
        malformed: MALFORMED_OUTPUT_ERROR,
        semantic: SEMANTIC_FAILURE_ERROR,
      }),
    };
  }

  const context = result.context as CrmAssistantContext;
  const data = result.data as CRMAssistantModelOutput;
  const brief = assembleCrmAssistantBrief(data, context);

  // Checkpoint 7, Step 11 — "skill execution, latency, provider, prompt
  // version, confidence, recommendation count, validation": everything
  // except confidence/recommendation count is already logged generically
  // by `executeSkill`/`runSkillCompletion`; these two are CRM-Assistant-
  // specific derived metrics only this wrapper can compute. Safe fields
  // only — never the report's own narrative content.
  getLogger().info("CRM Assistant execution succeeded", {
    workspaceId: session.workspace.id,
    provider: result.metadata.provider,
    promptVersion: result.metadata.promptVersion,
    mock: result.metadata.mock,
    latencyMs: result.metadata.latencyMs,
    confidence: brief.confidence,
    recommendationCount: brief.upcomingOpportunities.length + brief.suggestedFollowUps.length + brief.recommendedActions.length,
    validation: "passed",
  });

  return {
    success: true,
    data: {
      context,
      brief,
      mock: result.metadata.mock,
      model: result.metadata.model,
      provider: result.metadata.provider,
      promptVersion: result.metadata.promptVersion,
      contextVersion: CRM_ASSISTANT_CONTEXT_VERSION,
      generatedAt: result.metadata.generatedAt,
    },
  };
}

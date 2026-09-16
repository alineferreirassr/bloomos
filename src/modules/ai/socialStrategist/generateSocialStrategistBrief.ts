"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerSocialStrategistSkill, SOCIAL_STRATEGIST_SKILL_ID } from "@/modules/ai/socialStrategist/registerSocialStrategistSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { assembleSocialStrategistBrief, type SocialStrategistBrief } from "@/modules/ai/socialStrategist/assembleSocialStrategistBrief";
import { getLogger } from "@/core/observability/logger";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";

const GENERIC_ACCESS_ERROR = "The Social Strategist isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the Social Strategist report right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";
const SEMANTIC_FAILURE_ERROR = "Bloom AI's Social Strategist report referenced content that doesn't exist. Please try again.";

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerSocialStrategistSkill();
registerDefaultAIContextBuilders();

export interface GeneratedSocialStrategistBrief {
  context: SocialStrategistContext;
  brief: SocialStrategistBrief;
  mock: boolean;
  model: string;
  provider: string;
  promptVersion: string;
  generatedAt: string;
}

export type GenerateSocialStrategistBriefResult = { success: true; data: GeneratedSocialStrategistBrief } | { success: false; error: string };

/**
 * The only entry point the UI ever calls for the Social Strategist —
 * mirrors `generateCRMAssistantBrief.ts` exactly: a thin wrapper around
 * `executeSkill()`/`runSkillCompletion()`, the same generic pipeline every
 * other Skill uses. This feature's own contribution is only its permission
 * check and its assembly of the display-ready report
 * (`assembleSocialStrategistBrief`), never orchestration. No real AI
 * provider, vendor SDK, or API key is referenced anywhere in this file —
 * `executeSkill()` resolves to the Skill's own `createMockProvider` unless
 * a real provider has already been configured and registered elsewhere in
 * the platform (it has not, this checkpoint).
 */
export async function generateSocialStrategistBrief(): Promise<GenerateSocialStrategistBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("social.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: SOCIAL_STRATEGIST_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: {},
  });

  if (!result.success) {
    getLogger().warn("Social Strategist execution failed", {
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

  const context = result.context as SocialStrategistContext;
  const data = result.data as SocialStrategistModelOutput;
  const brief = assembleSocialStrategistBrief(data, context);

  getLogger().info("Social Strategist execution succeeded", {
    workspaceId: session.workspace.id,
    provider: result.metadata.provider,
    promptVersion: result.metadata.promptVersion,
    mock: result.metadata.mock,
    latencyMs: result.metadata.latencyMs,
    confidence: brief.confidence,
    recommendationCount: brief.contentOpportunities.length + brief.nextContentRecommendations.length,
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
      generatedAt: result.metadata.generatedAt,
    },
  };
}

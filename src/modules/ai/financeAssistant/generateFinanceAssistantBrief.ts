"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerFinanceAssistantSkill, FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { assembleFinanceAssistantBrief } from "@/modules/ai/financeAssistant/assembleBrief";
import { FINANCE_ASSISTANT_CONTEXT_VERSION } from "@/modules/ai/financeAssistant/contextBuilder";
import { getLogger } from "@/core/observability/logger";
import type { FinanceAssistantContext, FinanceAssistantModelOutput, GenerateFinanceAssistantBriefResult } from "@/modules/ai/financeAssistant/types";

const GENERIC_ACCESS_ERROR = "The Finance Assistant isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the Finance Assistant report right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";
const SEMANTIC_FAILURE_ERROR = "Bloom AI's Finance report referenced data that doesn't exist. Please try again.";

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerFinanceAssistantSkill();
registerDefaultAIContextBuilders();

/**
 * The only entry point the UI ever calls for the Finance Assistant —
 * everything from auth through observability logging happens here,
 * server-side. Checkpoint 8's own proof of "no special execution path":
 * this is a thin wrapper around `executeSkill()`/`runSkillCompletion()`,
 * the exact same generic pipeline every other Skill already uses — this
 * feature's own contribution is only its permission check and its assembly
 * of the deterministic sections (`assembleFinanceAssistantBrief`), never
 * orchestration. No execution history is persisted (matching CRM
 * Assistant's own precedent) — Step 11's observability ask is satisfied by
 * logging alone, below.
 */
export async function generateFinanceAssistantBrief(): Promise<GenerateFinanceAssistantBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("finance.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: FINANCE_ASSISTANT_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: {},
  });

  if (!result.success) {
    getLogger().warn("Finance Assistant execution failed", {
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

  const context = result.context as FinanceAssistantContext;
  const data = result.data as FinanceAssistantModelOutput;
  const brief = assembleFinanceAssistantBrief(data, context);

  // Checkpoint 8, Step 11 — "execution, latency, provider, confidence,
  // financial metrics generated, validation": everything except confidence/
  // financial-metrics-generated is already logged generically by
  // `executeSkill`/`runSkillCompletion`; these two are Finance-Assistant-
  // specific derived metrics only this wrapper can compute. Safe fields
  // only — never the report's own narrative content or any amount.
  getLogger().info("Finance Assistant execution succeeded", {
    workspaceId: session.workspace.id,
    provider: result.metadata.provider,
    promptVersion: result.metadata.promptVersion,
    mock: result.metadata.mock,
    latencyMs: result.metadata.latencyMs,
    confidence: brief.confidence,
    financialMetricsGenerated: brief.revenueOpportunities.length + brief.recommendations.length + brief.financialRisks.length,
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
      contextVersion: FINANCE_ASSISTANT_CONTEXT_VERSION,
      generatedAt: result.metadata.generatedAt,
    },
  };
}

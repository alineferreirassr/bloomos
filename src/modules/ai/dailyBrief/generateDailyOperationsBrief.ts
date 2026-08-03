"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerDailyOperationsBriefSkill, DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { assembleDailyOperationsBrief } from "@/modules/ai/dailyBrief/assembleBrief";
import { DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION } from "@/modules/ai/dailyBrief/contextBuilder";
import { DAILY_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/dailyBrief/promptBuilder";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { getMemoryManager } from "@/core/ai/memory";
import { computeIssueSnapshots } from "@/modules/ai/dailyBrief/contextBuilder";
import type { DailyOperationsBriefContext, DailyOperationsBriefModelOutput, GenerateDailyOperationsBriefResult } from "@/modules/ai/dailyBrief/types";

const HISTORICAL_SNAPSHOT_RETENTION_DAYS = 30;

const GENERIC_ACCESS_ERROR = "The Daily Operations Brief isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the Daily Operations Brief right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";
const SEMANTIC_FAILURE_ERROR = "Bloom AI's Daily Brief referenced data that doesn't exist. Please try again.";

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerDailyOperationsBriefSkill();
registerDefaultAIContextBuilders();

/**
 * The only entry point the UI ever calls for the Daily Operations Brief —
 * everything from auth through history persistence happens here,
 * server-side. Checkpoint 5's own proof of "no special execution path": this
 * is a thin wrapper around `executeSkill()`/`runSkillCompletion()`, the
 * exact same generic pipeline the Proposal Generator and Event Operations
 * Brief already use — this feature's own contribution is only its
 * permission check, its execution-history persistence, and its assembly of
 * the deterministic sections (`assembleDailyOperationsBrief`), never
 * orchestration.
 */
export async function generateDailyOperationsBrief(): Promise<GenerateDailyOperationsBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const startedAt = Date.now();
  const result = await executeSkill({
    skillId: DAILY_OPERATIONS_BRIEF_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: { memberId: session.membership.id, memorySkillId: DAILY_OPERATIONS_BRIEF_SKILL_ID, memoryCategory: "historical_knowledge" },
  });

  if (!result.success) {
    await getDailyBriefExecutionsRepository().recordExecution(session.workspace.id, {
      status: "failure",
      provider: "n/a",
      model: null,
      promptVersion: DAILY_OPERATIONS_BRIEF_PROMPT_VERSION,
      mock: false,
      latencyMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
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

  const context = result.context as DailyOperationsBriefContext;
  const data = result.data as DailyOperationsBriefModelOutput;
  const brief = assembleDailyOperationsBrief(data, context, session.workspace.id, session.membership.id);

  await getDailyBriefExecutionsRepository().recordExecution(session.workspace.id, {
    status: "success",
    provider: result.metadata.provider,
    model: result.metadata.model,
    promptVersion: result.metadata.promptVersion,
    mock: result.metadata.mock,
    latencyMs: result.metadata.latencyMs,
    generatedAt: result.metadata.generatedAt,
  });

  // Checkpoint 6, Step 7 — a deterministic, system-authored snapshot of this
  // run's own issues, written for a *future* Daily Brief to diff against via
  // `previousSnapshot`/`computeBriefComparison`. `source: "system"` means the
  // Memory Manager auto-approves it (no model judgment involved, so no
  // review is needed); an explicit `expiresAt` keeps this feature's own
  // retention window self-documenting here rather than an implicit
  // side-effect of picking `importance: "low"` in `policies.ts`.
  const expiresAt = new Date(result.metadata.generatedAt);
  expiresAt.setDate(expiresAt.getDate() + HISTORICAL_SNAPSHOT_RETENTION_DAYS);
  await getMemoryManager().createMemory(session.workspace.id, {
    skillId: DAILY_OPERATIONS_BRIEF_SKILL_ID,
    title: `Daily Brief snapshot — ${result.metadata.generatedAt}`,
    summary: JSON.stringify(computeIssueSnapshots(context)),
    category: "historical_knowledge",
    importance: "low",
    visibility: "workspace",
    tags: [],
    confidence: 100,
    source: "system",
    expiresAt: expiresAt.toISOString(),
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
      contextVersion: DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION,
      generatedAt: result.metadata.generatedAt,
    },
  };
}

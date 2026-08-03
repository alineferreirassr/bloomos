"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerEventOperationsBriefSkill, EVENT_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/registerEventOperationsBriefSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION } from "@/modules/ai/contextBuilder";
import { assembleEventOperationsBrief } from "@/modules/ai/assembleBrief";
import type { EventOperationsBriefContext, EventOperationsBriefModelOutput, GenerateEventOperationsBriefResult } from "@/modules/ai/types";

const GENERIC_ACCESS_ERROR = "This Event brief isn't available. It may not exist, or you may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate a brief right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";

// Registered once per process — idempotent, safe to call on every module load (see each function's own doc comment).
registerEventOperationsBriefSkill();
registerDefaultAIContextBuilders();

/**
 * The only entry point the UI ever calls — everything from auth through
 * the provider call happens here, server-side, so no API key, prompt, or
 * raw Event data is ever exposed to the browser beyond the validated
 * structured result. Never trusts a client-supplied Workspace or
 * permission claim: both are re-resolved from the server session on every
 * call (`resolveMemberSessionSnapshot`).
 *
 * Checkpoint 4: this is now a thin wrapper around the generic Bloom AI
 * Skill pipeline (`executeSkill` → `runSkillCompletion`, see
 * `registerEventOperationsBriefSkill.ts`) rather than its own
 * prompt/provider/parsing plumbing — this feature's own contribution is
 * only its early permission check and its post-processing
 * (`assembleEventOperationsBrief`), never orchestration. Observable
 * behavior (errors, versioning metadata, mock/live reporting) stays
 * byte-for-byte what it was before the Skill layer existed, verified by
 * this file's own pre-existing test suite (mock target updated to
 * `@/core/ai/registry`, the module the Skill Resolver itself now calls,
 * but every assertion unchanged).
 */
export async function generateEventOperationsBrief(eventId: string): Promise<GenerateEventOperationsBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const result = await executeSkill({
    skillId: EVENT_OPERATIONS_BRIEF_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: { eventId },
  });

  if (!result.success) {
    return {
      success: false,
      error: mapSkillErrorToMessage(result.error, {
        contextUnavailable: GENERIC_ACCESS_ERROR,
        provider: GENERIC_PROVIDER_ERROR,
        malformed: MALFORMED_OUTPUT_ERROR,
      }),
    };
  }

  const context = result.context as EventOperationsBriefContext;
  const brief = assembleEventOperationsBrief(result.data as EventOperationsBriefModelOutput, context);

  return {
    success: true,
    data: {
      context,
      brief,
      mock: result.metadata.mock,
      model: result.metadata.model,
      provider: result.metadata.provider,
      promptVersion: result.metadata.promptVersion,
      contextVersion: EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION,
      sourceEventUpdatedAt: context.event.updatedAt,
      generatedAt: result.metadata.generatedAt,
    },
  };
}

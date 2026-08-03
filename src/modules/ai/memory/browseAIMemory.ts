"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { registerBrowseAIMemorySkill, BROWSE_AI_MEMORY_SKILL_ID, type BrowseAIMemoryData } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import type { AIMemoryCategory, AIMemoryImportance } from "@/types/aiMemory";

const GENERIC_ACCESS_ERROR = "AI Memory isn't available right now. You may not have access to it.";
const GENERIC_FAILURE_ERROR = "Bloom AI couldn't load Memory right now. Please try again.";

registerBrowseAIMemorySkill();

export type BrowseAIMemoryResult = { success: true; data: BrowseAIMemoryData } | { success: false; error: string };

export interface BrowseAIMemoryFilters {
  category?: AIMemoryCategory;
  importance?: AIMemoryImportance;
}

/**
 * The Command Palette / Bloom AI Dashboard's own entry point for Step 10's
 * "Browse AI Memory, through executeSkill()" — a thin server wrapper, same
 * shape as `generateDailyOperationsBrief.ts`/`generateProposalDraft.ts`,
 * except this one's underlying Skill does no AI provider call at all (see
 * `registerBrowseAIMemorySkill.ts`'s own doc comment for why that's
 * intentional, not a placeholder).
 */
export async function browseAIMemory(filters: BrowseAIMemoryFilters = {}): Promise<BrowseAIMemoryResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const result = await executeSkill({
    skillId: BROWSE_AI_MEMORY_SKILL_ID,
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? undefined,
    permissions: session.permissions,
    role: session.membership.role,
    refs: { memoryCategory: filters.category, memoryImportance: filters.importance },
  });

  if (!result.success) {
    return {
      success: false,
      error: mapSkillErrorToMessage(result.error, {
        contextUnavailable: GENERIC_ACCESS_ERROR,
        provider: GENERIC_FAILURE_ERROR,
        malformed: GENERIC_FAILURE_ERROR,
      }),
    };
  }

  return { success: true, data: result.data as BrowseAIMemoryData };
}

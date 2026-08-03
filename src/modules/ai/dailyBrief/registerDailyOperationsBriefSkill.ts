import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createDailyOperationsBriefMockProvider } from "@/modules/ai/dailyBrief/mockProvider";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";
import { DAILY_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/dailyBrief/promptBuilder";
import { DAILY_OPERATIONS_BRIEF_USE_CASE_ID, registerDailyOperationsBriefUseCase } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefUseCase";

export const DAILY_OPERATIONS_BRIEF_SKILL_ID = "daily-operations-brief";

const dailyOperationsBriefSkill: SkillDefinition = {
  id: DAILY_OPERATIONS_BRIEF_SKILL_ID,
  name: "Daily Operations Brief",
  description:
    "A workspace-wide operational summary — today's and this week's Events, late payments, unsigned contracts, checklist progress, team assignments, and recommended actions — grounded entirely in BloomOS's own current data.",
  category: "briefing",
  requiredPermissions: ["events.view"],
  requiredContext: ["dailyBriefContext"],
  // Checkpoint 6, Step 7 — requested but never required: this Skill runs
  // perfectly well on a Workspace's very first Daily Brief, when there is
  // no prior snapshot to compare against at all (`generateDailyOperationsBrief.ts`
  // passes the `memorySkillId`/`memoryCategory` refs that scope this to the
  // Daily Brief's own historical snapshots, not every entity's memory).
  optionalContext: ["memory"],
  useCaseId: DAILY_OPERATIONS_BRIEF_USE_CASE_ID,
  outputSchema: dailyOperationsBriefModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: DAILY_OPERATIONS_BRIEF_PROMPT_VERSION,
  estimatedLatencyMs: 5000,
  contextFactsKey: "dailyOperationsBriefContext",
  createMockProvider: createDailyOperationsBriefMockProvider,
  // Assigned below — see `registerEventOperationsBriefSkill.ts`'s identical
  // doc comment for why this can't be part of the object literal itself.
};

dailyOperationsBriefSkill.execute = async (params) =>
  runSkillCompletion({
    skill: dailyOperationsBriefSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Daily Operations Brief as a Bloom AI Skill — a third real
 * feature (after Proposal Generator and Event Operations Brief) proving the
 * Skill Resolver's own claim of "no special execution path": this Skill's
 * `execute` is the same one-line `runSkillCompletion` delegation the other
 * two use, even though its own context (`dailyBriefContext`) is
 * workspace-wide rather than per-Event.
 */
export function registerDailyOperationsBriefSkill(): void {
  if (registered) return;
  registerDailyOperationsBriefUseCase();
  registerSkill(dailyOperationsBriefSkill);
  registered = true;
}

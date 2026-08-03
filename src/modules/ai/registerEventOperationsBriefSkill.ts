import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createMockAIProvider } from "@/modules/ai/mockProvider";
import { eventOperationsBriefModelOutputSchema } from "@/modules/ai/schema";
import { EVENT_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/promptBuilder";
import { EVENT_OPERATIONS_BRIEF_USE_CASE_ID, registerEventOperationsBriefUseCase } from "@/modules/ai/registerEventOperationsBriefUseCase";

export const EVENT_OPERATIONS_BRIEF_SKILL_ID = "event-operations-brief";

const eventOperationsBriefSkill: SkillDefinition = {
  id: EVENT_OPERATIONS_BRIEF_SKILL_ID,
  name: "Event Operations Brief",
  description:
    "Reads an Event's current status, checklist, and schedule to draft an internal briefing and suggested next steps — read-only, never changes the Event.",
  category: "operations",
  requiredPermissions: ["events.view"],
  requiredContext: ["event"],
  useCaseId: EVENT_OPERATIONS_BRIEF_USE_CASE_ID,
  outputSchema: eventOperationsBriefModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: EVENT_OPERATIONS_BRIEF_PROMPT_VERSION,
  estimatedLatencyMs: 3000,
  contextFactsKey: "eventOperationsBriefContext",
  createMockProvider: createMockAIProvider,
  // Assigned below (needs to close over `eventOperationsBriefSkill` itself
  // to hand `runSkillCompletion` its own declared metadata) rather than
  // being part of this literal, which would otherwise reference itself
  // before it exists.
};

eventOperationsBriefSkill.execute = async (params) =>
  runSkillCompletion({
    skill: eventOperationsBriefSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Event Operations Brief as a Bloom AI Skill — this is the
 * proof that a use case migrated onto the platform in Checkpoint 2 can run
 * through `executeSkill()` with zero prompt/output/UI change (see
 * `generateEventOperationsBrief.ts`, now a thin wrapper around this).
 */
export function registerEventOperationsBriefSkill(): void {
  if (registered) return;
  registerEventOperationsBriefUseCase();
  registerSkill(eventOperationsBriefSkill);
  registered = true;
}

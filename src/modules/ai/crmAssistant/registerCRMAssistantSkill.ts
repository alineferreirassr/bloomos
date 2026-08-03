import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createCrmAssistantMockProvider } from "@/modules/ai/crmAssistant/mockProvider";
import { crmAssistantModelOutputSchema } from "@/modules/ai/crmAssistant/schema";
import { CRM_ASSISTANT_PROMPT_VERSION } from "@/modules/ai/crmAssistant/promptBuilder";
import { CRM_ASSISTANT_USE_CASE_ID, registerCRMAssistantUseCase } from "@/modules/ai/crmAssistant/registerCRMAssistantUseCase";

export const CRM_ASSISTANT_SKILL_ID = "crm-assistant";

/**
 * `requiredPermissions: ["clients.view"]` only, not every permission the
 * context spans (Leads/Events/Contracts/Finance too) — the same "primary
 * permission, not every underlying data permission" precedent
 * `daily-operations-brief` already established with `events.view` alone
 * despite reading Finance/Contracts/Clients. `clients.view` is the one
 * permission every legitimate use of a *relationship-management* tool
 * requires; a member who can see Clients but not, say, Finance still gets
 * a useful (if less complete) report — a missing category is reflected in
 * `confidence`/`missingInformation`, never a reason to hide the whole
 * Skill from them.
 */
const crmAssistantSkill: SkillDefinition = {
  id: CRM_ASSISTANT_SKILL_ID,
  name: "CRM Assistant",
  description: "An intelligent relationship manager — reads Clients, Leads, Contracts, Payments, Events, and this Workspace's own AI Memory to surface who needs attention, what's at risk, and what to prioritize next.",
  category: "crm",
  requiredPermissions: ["clients.view"],
  requiredContext: ["crmAssistantContext"],
  // Checkpoint 7, Step 6 — requested but never required: this Skill runs
  // perfectly well for a Workspace with no memory at all yet.
  optionalContext: ["memory"],
  useCaseId: CRM_ASSISTANT_USE_CASE_ID,
  outputSchema: crmAssistantModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: CRM_ASSISTANT_PROMPT_VERSION,
  estimatedLatencyMs: 6000,
  contextFactsKey: "crmAssistantContext",
  createMockProvider: createCrmAssistantMockProvider,
  // Assigned below — see `registerDailyOperationsBriefSkill.ts`'s identical
  // doc comment for why this can't be part of the object literal itself.
};

crmAssistantSkill.execute = async (params) =>
  runSkillCompletion({
    skill: crmAssistantSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the CRM Assistant as a Bloom AI Skill — the fourth real
 * feature (after Proposal Generator, Event Operations Brief, and Daily
 * Operations Brief) proving the Skill Resolver's own claim of "no special
 * execution path": this Skill's `execute` is the same one-line
 * `runSkillCompletion` delegation the other three use, even though its own
 * context (`crmAssistantContext`) spans six different entity types at once.
 */
export function registerCRMAssistantSkill(): void {
  if (registered) return;
  registerCRMAssistantUseCase();
  registerSkill(crmAssistantSkill);
  registered = true;
}

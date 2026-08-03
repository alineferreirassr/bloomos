import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createFinanceAssistantMockProvider } from "@/modules/ai/financeAssistant/mockProvider";
import { financeAssistantModelOutputSchema } from "@/modules/ai/financeAssistant/schema";
import { FINANCE_ASSISTANT_PROMPT_VERSION } from "@/modules/ai/financeAssistant/promptBuilder";
import { FINANCE_ASSISTANT_USE_CASE_ID, registerFinanceAssistantUseCase } from "@/modules/ai/financeAssistant/registerFinanceAssistantUseCase";

export const FINANCE_ASSISTANT_SKILL_ID = "finance-assistant";

/**
 * `requiredPermissions: ["finance.view"]` only, not every permission the
 * context spans (Contracts/Events/CRM too) — the same "primary permission,
 * not every underlying data permission" precedent `daily-operations-brief`/
 * `crm-assistant` already established. A member who can see Finance but
 * not, say, Contracts still gets a useful report; a missing category is
 * reflected in `confidence`/`missingInformation`, never a reason to hide
 * the whole Skill from them.
 */
const financeAssistantSkill: SkillDefinition = {
  id: FINANCE_ASSISTANT_SKILL_ID,
  name: "Finance Assistant",
  description: "A financial analyst for the Workspace — reads Invoices, Payments, Contracts, Events, and this Workspace's own AI Memory to surface revenue, outstanding balances, cash flow, and financial risk.",
  category: "finance",
  requiredPermissions: ["finance.view"],
  requiredContext: ["financeAssistantContext"],
  // Checkpoint 8, Step 6/2 — requested but never required: this Skill runs
  // perfectly well with no memory yet and for a member without CRM Assistant
  // access (`crmAssistantContext` simply comes back `undefined`).
  optionalContext: ["memory", "crmAssistantContext"],
  useCaseId: FINANCE_ASSISTANT_USE_CASE_ID,
  outputSchema: financeAssistantModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: FINANCE_ASSISTANT_PROMPT_VERSION,
  estimatedLatencyMs: 6000,
  contextFactsKey: "financeAssistantContext",
  createMockProvider: createFinanceAssistantMockProvider,
  // Assigned below — see `registerCRMAssistantSkill.ts`'s identical doc
  // comment for why this can't be part of the object literal itself.
};

financeAssistantSkill.execute = async (params) =>
  runSkillCompletion({
    skill: financeAssistantSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Finance Assistant as a Bloom AI Skill — the fifth real
 * feature (after Proposal Generator, Event Operations Brief, Daily
 * Operations Brief, and CRM Assistant) proving the Skill Resolver's own
 * claim of "no special execution path": this Skill's `execute` is the same
 * one-line `runSkillCompletion` delegation the other four use.
 */
export function registerFinanceAssistantSkill(): void {
  if (registered) return;
  registerFinanceAssistantUseCase();
  registerSkill(financeAssistantSkill);
  registered = true;
}

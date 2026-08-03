import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createAnalyticsExecutiveSummaryMockProvider } from "@/modules/analytics/aiSummary/mockProvider";
import { analyticsExecutiveSummaryModelOutputSchema } from "@/modules/analytics/aiSummary/schema";
import { ANALYTICS_EXECUTIVE_SUMMARY_PROMPT_VERSION } from "@/modules/analytics/aiSummary/promptBuilder";
import { ANALYTICS_EXECUTIVE_SUMMARY_USE_CASE_ID, registerAnalyticsExecutiveSummaryUseCase } from "@/modules/analytics/aiSummary/registerAnalyticsExecutiveSummaryUseCase";

export const ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID = "analytics-executive-summary";

const analyticsExecutiveSummarySkill: SkillDefinition = {
  id: ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID,
  name: "Executive Summary",
  description: "A narrative summary of business performance, financial health, client health, workflow activity, document activity, and Portal engagement — grounded entirely in already-computed Analytics metrics.",
  category: "operations",
  requiredPermissions: ["analytics.view"],
  requiredContext: ["analyticsSummaryContext"],
  useCaseId: ANALYTICS_EXECUTIVE_SUMMARY_USE_CASE_ID,
  outputSchema: analyticsExecutiveSummaryModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: false,
  sidebarVisible: false,
  featureFlag: null,
  minimumRole: null,
  version: ANALYTICS_EXECUTIVE_SUMMARY_PROMPT_VERSION,
  estimatedLatencyMs: 4000,
  contextFactsKey: "analyticsSummaryContext",
  createMockProvider: createAnalyticsExecutiveSummaryMockProvider,
};

analyticsExecutiveSummarySkill.execute = async (params) =>
  runSkillCompletion({
    skill: analyticsExecutiveSummarySkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Executive Summary as a Bloom AI Skill — the same one-line
 * `runSkillCompletion` delegation every other Skill uses, proving the
 * Resolver's own "no special execution path" claim holds for a fifth
 * checkpoint. `commandPaletteVisible`/`sidebarVisible` are both `false` —
 * this Skill is only ever invoked from the Analytics Overview tab itself,
 * never independently discoverable, matching Step 6's own scoping (a
 * narration of the Analytics dashboard, not a general-purpose Skill).
 */
export function registerAnalyticsExecutiveSummarySkill(): void {
  if (registered) return;
  registerAnalyticsExecutiveSummaryUseCase();
  registerSkill(analyticsExecutiveSummarySkill);
  registered = true;
}

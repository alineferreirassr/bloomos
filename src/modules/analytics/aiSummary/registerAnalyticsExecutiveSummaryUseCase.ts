import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildAnalyticsExecutiveSummaryPrompt, ANALYTICS_EXECUTIVE_SUMMARY_PROMPT_VERSION, ANALYTICS_EXECUTIVE_SUMMARY_SYSTEM_PROMPT } from "@/modules/analytics/aiSummary/promptBuilder";
import { analyticsExecutiveSummaryModelOutputSchema } from "@/modules/analytics/aiSummary/schema";
import type { AnalyticsSummaryContext } from "@/modules/analytics/aiSummary/types";

export const ANALYTICS_EXECUTIVE_SUMMARY_USE_CASE_ID = "analytics.executive.summary";

let registered = false;

/**
 * Registers the Executive Summary as a platform use case — read-only and
 * advisory (`humanApprovalPolicy: "not_required"`), the same posture as
 * every other Brief/Assistant: it narrates already-computed metrics for a
 * human to read, never recalculates or changes anything.
 */
export function registerAnalyticsExecutiveSummaryUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: ANALYTICS_EXECUTIVE_SUMMARY_USE_CASE_ID,
    promptVersion: ANALYTICS_EXECUTIVE_SUMMARY_PROMPT_VERSION,
    systemInstructions: ANALYTICS_EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
    buildMessages: (context) => buildAnalyticsExecutiveSummaryPrompt(context as AnalyticsSummaryContext),
    outputSchema: analyticsExecutiveSummaryModelOutputSchema,
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 8000, reservedOutputTokens: 1500 },
    humanApprovalPolicy: "not_required",
    composeContext: (sections) => sections.analyticsSummaryContext as AnalyticsSummaryContext,
  });
  registered = true;
}

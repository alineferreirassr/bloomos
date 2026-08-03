import { z } from "zod";
import { FINANCE_ACTION_TARGET_TYPES } from "@/modules/ai/financeAssistant/types";

const financeAssistantActionSchema = z.object({
  label: z.string().trim().min(1).max(150),
  reason: z.string().trim().min(1).max(300),
  targetType: z.enum(FINANCE_ACTION_TARGET_TYPES).nullable(),
  targetId: z.string().trim().min(1).nullable(),
});

/**
 * Mirrors `crmAssistantModelOutputSchema`'s guarantees: bounded lengths,
 * closed shape, no partial trust. `financialRiskExplanations[].riskId` and
 * every action's `targetId` are validated here only for shape (non-empty
 * string) — the *semantic* check that each actually references a real risk/
 * Invoice/Contract/Event present in context happens in `semanticValidation.ts`.
 */
export const financeAssistantModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(2000),
  revenueOverviewSummary: z.string().trim().min(1).max(500),
  cashFlowSummary: z.string().trim().min(1).max(500),
  financialRiskExplanations: z
    .array(
      z.object({
        riskId: z.string().trim().min(1),
        explanation: z.string().trim().min(1).max(300),
      }),
    )
    .max(30),
  revenueOpportunities: z.array(financeAssistantActionSchema).max(10),
  recommendations: z.array(financeAssistantActionSchema).max(10),
});

export type FinanceAssistantModelOutputParsed = z.infer<typeof financeAssistantModelOutputSchema>;

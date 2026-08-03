import { z } from "zod";
import { CRM_ACTION_TARGET_TYPES } from "@/modules/ai/crmAssistant/types";

const crmAssistantActionSchema = z.object({
  label: z.string().trim().min(1).max(150),
  reason: z.string().trim().min(1).max(300),
  targetType: z.enum(CRM_ACTION_TARGET_TYPES).nullable(),
  targetId: z.string().trim().min(1).nullable(),
});

/**
 * Mirrors `dailyOperationsBriefModelOutputSchema`'s guarantees: bounded
 * lengths, closed shape, no partial trust. `clientRiskExplanations[].clientId`
 * and every action's `targetId` are validated here only for shape
 * (non-empty string) — the *semantic* check that each actually references
 * a real Client/Lead/Event/Contract/Invoice present in context happens in
 * `semanticValidation.ts`.
 */
export const crmAssistantModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(2000),
  relationshipHealthSummary: z.string().trim().min(1).max(500),
  clientRiskExplanations: z
    .array(
      z.object({
        clientId: z.string().trim().min(1),
        explanation: z.string().trim().min(1).max(300),
      }),
    )
    .max(30),
  upcomingOpportunities: z.array(crmAssistantActionSchema).max(10),
  suggestedFollowUps: z.array(crmAssistantActionSchema).max(10),
  recommendedActions: z.array(crmAssistantActionSchema).max(10),
});

export type CrmAssistantModelOutputParsed = z.infer<typeof crmAssistantModelOutputSchema>;

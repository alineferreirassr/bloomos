import { z } from "zod";
import { DAILY_BRIEF_ACTION_TARGET_TYPES } from "@/modules/ai/dailyBrief/types";

/**
 * Mirrors `eventOperationsBriefModelOutputSchema`/`proposalModelOutputSchema`'s
 * guarantees: bounded lengths, closed shape, no partial trust.
 * `riskExplanations[].eventId` and `suggestedActions[].targetId` are
 * validated here only for shape (non-empty string) — the *semantic* check
 * that each actually references a real Event/Invoice/Contract present in
 * context happens in `semanticValidation.ts`.
 */
export const dailyOperationsBriefModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(2000),
  todaysPriorities: z.array(z.string().trim().min(1).max(200)).min(1).max(7),
  riskExplanations: z
    .array(
      z.object({
        eventId: z.string().trim().min(1),
        explanation: z.string().trim().min(1).max(300),
      }),
    )
    .max(20),
  recommendations: z.array(z.string().trim().min(1).max(300)).max(10),
  suggestedActions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(150),
        reason: z.string().trim().min(1).max(300),
        targetType: z.enum(DAILY_BRIEF_ACTION_TARGET_TYPES).nullable(),
        targetId: z.string().trim().min(1).nullable(),
      }),
    )
    .max(10),
});

export type DailyOperationsBriefModelOutputParsed = z.infer<typeof dailyOperationsBriefModelOutputSchema>;

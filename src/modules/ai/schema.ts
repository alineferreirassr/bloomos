import { z } from "zod";

/**
 * The only shape the model is trusted to fill in — narrative synthesis,
 * explanations, and recommendations, never facts (those come from
 * `EventOperationsBriefContext`, computed deterministically). Bounded
 * lengths keep cost/latency in check and reject a runaway or malformed
 * completion outright rather than rendering it partially.
 *
 * `riskExplanations[].kind` and `recommendedActions[].actionTargetType` are
 * validated here only for *shape* (non-empty string / closed enum) — the
 * *semantic* check that a `kind` matches a real `DetectedRisk` actually
 * present on this Event happens in `generateEventOperationsBrief.ts` after
 * this schema passes, since that check needs the context this schema
 * doesn't have access to.
 */
export const eventOperationsBriefModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(1200),
  healthExplanation: z.string().trim().min(1).max(600),
  riskExplanations: z
    .array(
      z.object({
        kind: z.string().trim().min(1).max(100),
        explanation: z.string().trim().min(1).max(400),
      }),
    )
    .max(10),
  recommendedActions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        reason: z.string().trim().min(1).max(400),
        actionTargetType: z.enum(["checklist", "schedule", "event"]).nullable(),
      }),
    )
    .min(1)
    .max(5),
  preparationNotes: z.string().trim().min(1).max(500).nullable(),
  internalNotes: z.string().trim().min(1).max(500).nullable(),
});

export type EventOperationsBriefModelOutputParsed = z.infer<typeof eventOperationsBriefModelOutputSchema>;

import { z } from "zod";

/**
 * Mirrors `eventOperationsBriefModelOutputSchema`'s guarantees: bounded
 * lengths, closed shape, no partial trust. `eventNotes[].eventId` is
 * validated here only for shape (non-empty string) — the *semantic* check
 * that it references a real Event actually present in context happens in
 * `generateDailyOperationsBrief.ts`, mirroring how Event Operations Brief
 * cross-checks `riskExplanations[].kind`.
 */
export const dailyOperationsBriefModelOutputSchema = z.object({
  overview: z.string().trim().min(1).max(1500),
  topPriorities: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
  eventNotes: z
    .array(
      z.object({
        eventId: z.string().trim().min(1),
        note: z.string().trim().min(1).max(300),
      }),
    )
    .max(15),
});

export type DailyOperationsBriefModelOutputParsed = z.infer<typeof dailyOperationsBriefModelOutputSchema>;

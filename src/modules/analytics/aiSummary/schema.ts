import { z } from "zod";

/**
 * Mirrors `dailyOperationsBriefModelOutputSchema`'s own discipline: bounded
 * lengths, closed shape, every field a narrative string — no numeric field
 * exists anywhere in this schema, so the model structurally cannot emit a
 * metric value; it can only narrate the ones the deterministic context
 * already computed (Step 6's own "Never calculate metrics with AI").
 */
export const analyticsExecutiveSummaryModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(2000),
  operationalRisks: z.array(z.string().trim().min(1).max(300)).max(10),
  performanceHighlights: z.array(z.string().trim().min(1).max(300)).max(10),
  recommendations: z.array(z.string().trim().min(1).max(300)).max(10),
});

export type AnalyticsExecutiveSummaryModelOutputParsed = z.infer<typeof analyticsExecutiveSummaryModelOutputSchema>;

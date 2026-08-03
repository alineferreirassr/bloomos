import { z } from "zod";

const lineItemOutputSchema = z.object({
  eventServiceId: z.string().trim().min(1),
  note: z.string().trim().min(1).max(300).nullable(),
});

const paymentScheduleLineOutputSchema = z.object({
  label: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().nonnegative(),
  dueDate: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(1).max(300).nullable(),
});

const memorySuggestionOutputSchema = z
  .object({
    scope: z.enum(["workspace", "user"]),
    content: z.string().trim().min(1).max(300),
  })
  .nullable();

/**
 * The only shape the model is trusted to fill in — narrative synthesis,
 * recommendations, and line-item *selection* (by referencing a real
 * `eventServiceId`, never inventing a service name or price), never the
 * facts themselves (those come from `ProposalContext`, computed
 * deterministically). Bounded lengths/counts keep cost/latency in check and
 * reject a runaway or malformed completion outright.
 *
 * `servicesIncluded[].eventServiceId`/`optionalAddOns[].eventServiceId` and
 * `paymentTerms` pricing consistency are validated here only for *shape* —
 * the *semantic* check that a referenced id actually exists in
 * `ProposalContext.selectedServices`, and that quoted totals are
 * consistent, happens in `validateProposalSemantics` after this schema
 * passes, since that check needs context this schema doesn't have access
 * to.
 */
export const proposalModelOutputSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(1500),
  eventOverview: z.string().trim().min(1).max(1000),
  servicesIncluded: z.array(lineItemOutputSchema).max(30),
  timelineSummary: z.string().trim().min(1).max(800),
  paymentTerms: z.array(paymentScheduleLineOutputSchema).max(10),
  recommendations: z.array(z.string().trim().min(1).max(400)).max(10),
  optionalAddOns: z.array(lineItemOutputSchema).max(15),
  questionsForClient: z.array(z.string().trim().min(1).max(300)).max(10),
  missingInformation: z.array(z.string().trim().min(1).max(200)).max(15),
  suggestedMemory: memorySuggestionOutputSchema,
});

export type ProposalModelOutputParsed = z.infer<typeof proposalModelOutputSchema>;

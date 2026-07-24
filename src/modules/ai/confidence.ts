import type { ContextConfidence } from "@/modules/ai/types";

export interface ConfidenceInput {
  hasClient: boolean;
  hasEventDate: boolean;
  hasLocation: boolean;
  hasBudget: boolean;
  hasAssignedOwner: boolean;
  hasChecklistItems: boolean;
  hasScheduleItems: boolean;
}

const FIELD_WEIGHT = 100 / 7;

const FIELD_LABELS: Record<keyof ConfidenceInput, string> = {
  hasClient: "no linked client",
  hasEventDate: "no event date",
  hasLocation: "no location",
  hasBudget: "no budget",
  hasAssignedOwner: "no assigned owner",
  hasChecklistItems: "no checklist items",
  hasScheduleItems: "no schedule items",
};

/**
 * Confidence reflects how much of the picture BloomOS actually has for
 * this Event — not the model's opinion of its own answer. Each of the 7
 * fields present contributes an equal share of 100; the reason lists
 * exactly which are missing, so "why is confidence low" is always
 * traceable to real, absent data rather than a model's self-assessment.
 * Deliberately never sent to the provider — computed and displayed
 * entirely in code (see `EventOperationsBriefContext.confidence`).
 */
export function computeContextConfidence(input: ConfidenceInput): ContextConfidence {
  const missingLabels: string[] = [];
  let score = 0;

  for (const key of Object.keys(FIELD_LABELS) as (keyof ConfidenceInput)[]) {
    if (input[key]) {
      score += FIELD_WEIGHT;
    } else {
      missingLabels.push(FIELD_LABELS[key]);
    }
  }

  score = Math.round(Math.min(100, score));

  const reason =
    missingLabels.length === 0
      ? "All key fields are present for this Event."
      : `Missing: ${missingLabels.join(", ")}.`;

  return { score, reason };
}

import type { EventHealthStatus } from "@/core/workflows/eventHealth";

/**
 * One already-triggered Event Health factor, carried through for narration —
 * never a second scoring system. `deduction` is the exact weight the real
 * Health Score engine (`core/workflows/eventHealth.ts`) already assigned it;
 * nothing here recomputes or overrides that number.
 */
export interface OperationalHealthFactor {
  label: string;
  deduction: number;
}

/**
 * A risk this Event genuinely exhibits right now, detected deterministically
 * in `riskEngine.ts` from data BloomOS already has — never invented, never
 * scored by the model. `kind` is a stable machine key (see `RISK_KINDS`)
 * the model's `riskExplanations` must reference by exact match; anything it
 * returns for an undetected `kind` is discarded before the brief is built.
 */
export interface DetectedRisk {
  kind: string;
  label: string;
  severity: "low" | "medium" | "high";
  evidence: string;
}

/**
 * How much of the picture BloomOS actually has for this Event — derived
 * purely from which context fields are present/absent, never from the
 * model's own self-reported confidence. 0–100, same scale as the Health
 * Score for familiarity, but a deliberately separate signal: an Event can
 * be perfectly healthy (nothing overdue) while still being low-confidence
 * (almost no fields filled in), and vice versa.
 */
export interface ContextConfidence {
  score: number;
  reason: string;
}

/** A real, already-existing BloomOS destination — never a client-supplied or model-invented URL (see `actionTargets.ts`). */
export interface AIActionTarget {
  type: "checklist" | "schedule" | "event";
  href: string;
  label: string;
}

/**
 * Everything the Event Operations Brief needs, already resolved to display
 * labels and already stripped of anything the provider has no business
 * seeing (raw UUIDs beyond the one needed to re-render, workspace/session
 * data, Notes/Timeline free text). Every field here is deterministic —
 * computed by existing Events/core/workflows code, never by the model —
 * so the model can only ever narrate and recommend on top of facts BloomOS
 * already stands behind, never invent or override one.
 */
export interface EventOperationsBriefContext {
  event: {
    id: string;
    title: string;
    eventType: string;
    status: string;
    lifecycleStage: string;
    priority: string;
    eventDate: string | null;
    locationName: string | null;
    assignedOwner: string | null;
    /** Carried through only for `GeneratedEventOperationsBrief.sourceEventUpdatedAt` — a future UI can flag "this Event changed since the brief was generated" without any new fetch. */
    updatedAt: string;
  };
  client: { name: string } | null;
  health: {
    status: EventHealthStatus;
    score: number;
    riskReasons: string[];
    /** Every triggered factor, largest deduction first — same order the real engine already returns, just carried through for the model to explain rather than re-derive. */
    topFactors: OperationalHealthFactor[];
  };
  checklist: {
    total: number;
    completed: number;
    /** Always the true count, independent of `overdueTitles` — that list is capped for context size, this number never is. */
    overdueCount: number;
    overdueTitles: string[];
  };
  schedule: {
    total: number;
    nextItem: { title: string; startTime: string | null } | null;
    /** Items whose own status is "delayed" — `scheduleStats.ts`'s existing signal, not a new one. */
    delayedCount: number;
  };
  missingInformation: string[];
  /** One-line deterministic roll-up of checklist/schedule overdue counts — e.g. "2 checklist items and 1 schedule item overdue." "Nothing overdue." when both are zero. */
  overdueSummary: string;
  deterministicNextAction: string | null;
  /** Every risk this Event currently exhibits, in severity order — detected in `riskEngine.ts`, never by the model. */
  detectedRisks: DetectedRisk[];
  confidence: ContextConfidence;
  generatedAt: string;
}

/** Every kind `detectOperationalRisks` currently emits — the closed set `riskExplanations[].kind` is validated against. */
export const RISK_KINDS = [
  "overdue_checklist",
  "overdue_schedule",
  "missing_owner",
  "incomplete_information",
  "approaching_date_not_ready",
] as const;
export type RiskKind = (typeof RISK_KINDS)[number];

/** The provider's raw explanation for one already-detected risk — `kind` must match a real `DetectedRisk.kind`; anything else is dropped, never rendered. */
export interface RiskExplanationOutput {
  kind: string;
  explanation: string;
}

/**
 * The provider's raw recommendation — `label`/`reason` are free narrative
 * text, but `actionTargetType` is a closed enum (never a raw URL or href
 * string from the model); `generateEventOperationsBrief.ts` resolves it to
 * a real `AIActionTarget` deterministically via `actionTargets.ts`, or
 * drops it if the model omits or misuses it.
 */
export interface RecommendedActionOutput {
  label: string;
  reason: string;
  actionTargetType: "checklist" | "schedule" | "event" | null;
}

/**
 * The only shape the model is trusted to fill in — narrative synthesis,
 * explanations, and recommendations layered on top of
 * `EventOperationsBriefContext`, never the facts themselves. Validated
 * against `eventOperationsBriefModelOutputSchema` before ever reaching
 * `generateEventOperationsBrief.ts`'s semantic cross-checks (risk kinds,
 * action target types) or the UI.
 */
export interface EventOperationsBriefModelOutput {
  executiveSummary: string;
  /** Explains the *existing* Health Score/status/topFactors — never a second score. */
  healthExplanation: string;
  riskExplanations: RiskExplanationOutput[];
  recommendedActions: RecommendedActionOutput[];
  preparationNotes: string | null;
  internalNotes: string | null;
}

/** One fully-resolved recommendation, ready to render — `id` is assigned deterministically in code (never by the model) so a future feedback record has something stable to reference. */
export interface RecommendedAction {
  id: string;
  label: string;
  reason: string;
  actionTarget: AIActionTarget | null;
}

/** One fully-resolved risk explanation, ready to render — always paired with the `DetectedRisk` it explains. */
export interface RiskExplanation {
  risk: DetectedRisk;
  explanation: string;
}

/** The enriched, UI-ready brief — `EventOperationsBriefModelOutput` after cross-validation, id-assignment, and action-target resolution. */
export interface EventOperationsBrief {
  executiveSummary: string;
  healthExplanation: string;
  riskExplanations: RiskExplanation[];
  recommendedActions: RecommendedAction[];
  preparationNotes: string | null;
  internalNotes: string | null;
}

/**
 * Versioning metadata for a generated brief — deliberately not persisted
 * (see `docs/ai.md`'s "Memory architecture" note). Carrying these fields
 * even in an ephemeral result means a future persistence phase can add a
 * `brief_generations` table with these exact columns and compare versions,
 * without redesigning this shape.
 */
export interface GeneratedEventOperationsBrief {
  context: EventOperationsBriefContext;
  brief: EventOperationsBrief;
  mock: boolean;
  model: string;
  provider: string;
  promptVersion: string;
  contextVersion: string;
  /** `context.event.updatedAt` at generation time — lets a future UI detect "this Event changed since the brief was generated" by comparing against the Event's current `updated_at`. */
  sourceEventUpdatedAt: string;
  generatedAt: string;
}

export type GenerateEventOperationsBriefResult =
  | { success: true; data: GeneratedEventOperationsBrief }
  | { success: false; error: string };

/**
 * Future-feedback architecture only — no storage, no repository, no
 * migration exists yet. A future phase persists these directly; the shape
 * is fixed now so `RecommendedAction.id` (already stable) has somewhere to
 * plug in without a UI rewrite.
 */
export type AIRecommendationFeedbackRating = "helpful" | "not_helpful";

export interface AIRecommendationFeedback {
  briefGeneratedAt: string;
  actionId: string;
  rating: AIRecommendationFeedbackRating;
}

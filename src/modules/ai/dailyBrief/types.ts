import type { EventHealthStatus } from "@/core/workflows/eventHealth";
import type { DetectedRisk } from "@/modules/ai/types";

/**
 * One Event's contribution to the Daily Operations Brief — a thin
 * projection of `EventOperationsBriefContext`, not a second data model.
 * Built by `buildDailyOperationsBriefContext` from an array of already-built
 * per-Event contexts, reusing every deterministic computation Event
 * Operations Brief already does (Health Score, risk detection) rather than
 * re-deriving anything.
 */
export interface DailyBriefEventSummary {
  eventId: string;
  title: string;
  eventDate: string | null;
  lifecycleStage: string;
  healthStatus: EventHealthStatus;
  overdueChecklistCount: number;
  delayedScheduleCount: number;
  /** Highest-severity risk for this Event, if any — same `DetectedRisk` shape `riskEngine.ts` already produces. */
  topRisk: DetectedRisk | null;
}

/**
 * Everything a future dashboard-level Daily Operations Brief needs —
 * aggregated, deterministic, and workspace-wide rather than single-Event.
 * `financeWarnings` is deliberately always empty today: no safe,
 * already-existing cross-Event finance aggregate exists in BloomOS yet
 * (confirmed during discovery — `getEventFinancialSummary` is per-Event
 * only). This field is reserved so a future Finance phase can populate it
 * without a schema change here.
 */
export interface DailyOperationsBriefContext {
  generatedAt: string;
  upcomingWindowDays: number;
  upcomingEvents: DailyBriefEventSummary[];
  eventsAtRisk: DailyBriefEventSummary[];
  totalOverdueChecklistItems: number;
  totalDelayedScheduleItems: number;
  financeWarnings: string[];
}

/** One note the model attaches to a specific at-risk/upcoming Event — `eventId` must match one already in context; anything else is dropped (see `generateDailyOperationsBrief.ts`). */
export interface DailyBriefEventNoteOutput {
  eventId: string;
  note: string;
}

/** The only shape the model is trusted to fill in for the Daily Operations Brief — narrative synthesis over `DailyOperationsBriefContext`, never the facts themselves. */
export interface DailyOperationsBriefModelOutput {
  overview: string;
  topPriorities: string[];
  eventNotes: DailyBriefEventNoteOutput[];
}

/** One fully-resolved event note, paired with the real Event summary it explains. */
export interface DailyBriefEventNote {
  event: DailyBriefEventSummary;
  note: string;
}

export interface DailyOperationsBrief {
  overview: string;
  topPriorities: string[];
  eventNotes: DailyBriefEventNote[];
}

export interface GeneratedDailyOperationsBrief {
  context: DailyOperationsBriefContext;
  brief: DailyOperationsBrief;
  mock: boolean;
  model: string;
  provider: string;
  promptVersion: string;
  contextVersion: string;
  generatedAt: string;
}

export type GenerateDailyOperationsBriefResult =
  | { success: true; data: GeneratedDailyOperationsBrief }
  | { success: false; error: string };

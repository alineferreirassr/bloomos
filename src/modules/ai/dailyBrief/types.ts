import type { EventHealthStatus } from "@/core/workflows/eventHealth";
import type { DetectedRisk } from "@/modules/ai/types";
import type { Notification } from "@/core/notifications/types";

/** One Event's contribution to the Daily Operations Brief — reuses Event Operations Brief's own Health Score/risk detection rather than recomputing anything. */
export interface DailyBriefEventSummary {
  eventId: string;
  title: string;
  eventDate: string | null;
  lifecycleStage: string;
  status: string;
  healthStatus: EventHealthStatus;
  assignedOwner: string | null;
  /** Highest-severity risk for this Event, if any — same `DetectedRisk` shape `riskEngine.ts` already produces. */
  topRisk: DetectedRisk | null;
}

export interface DailyBriefLatePayment {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  eventId: string | null;
  balanceMinor: number;
  currency: string;
  dueDate: string | null;
  daysOverdue: number;
}

export interface DailyBriefContractIssue {
  contractId: string;
  contractNumber: string;
  clientId: string;
  eventId: string | null;
  signatureStatus: string;
  /** The linked Event's date, if any — surfaces urgency (an unsigned contract for an Event next week is worse than one with no Event at all). */
  eventDate: string | null;
}

export interface DailyBriefChecklistProgress {
  totalOpen: number;
  totalOverdue: number;
  totalCompleted: number;
}

export interface DailyBriefTeamAssignment {
  assigneeName: string;
  openItemCount: number;
  overdueItemCount: number;
}

export interface DailyBriefHighPriorityClient {
  clientId: string;
  name: string;
}

export interface DailyBriefCalendarSummary {
  eventsToday: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
}

/** A safe projection of `AuditLogEntry` — `action`/`ownerType`/`occurredAt` only, never `before`/`after` (those are raw field diffs that could carry any entity's data, not safe to hand to a model or display as "activity"). */
export interface DailyBriefActivityEntry {
  action: string;
  ownerType: string;
  occurredAt: string;
}

export interface DailyBriefDeadline {
  label: string;
  dueDate: string;
  kind: "checklist" | "invoice" | "contract";
  ownerId: string;
}

/**
 * Everything the Daily Operations Brief needs — aggregated, deterministic,
 * and workspace-wide. Every category is fetched independently
 * (`fetchDailyOperationsBriefContext.server.ts` uses `Promise.allSettled`)
 * so one failing data source (e.g. Finance) never blanks out the rest of
 * the brief; `unavailableCategories` names exactly which ones couldn't be
 * read, feeding `confidence.ts`'s score and `missingInformation`. Never
 * includes a raw secret, credential, or field-level diff — `recentActivity`
 * is a safe projection of the Audit Log, never `before`/`after`.
 */
export interface DailyOperationsBriefContext {
  generatedAt: string;
  eventsToday: DailyBriefEventSummary[];
  eventsThisWeek: DailyBriefEventSummary[];
  eventsAtRisk: DailyBriefEventSummary[];
  latePayments: DailyBriefLatePayment[];
  unsignedContracts: DailyBriefContractIssue[];
  checklistProgress: DailyBriefChecklistProgress;
  teamAssignments: DailyBriefTeamAssignment[];
  unreadNotificationCount: number;
  highPriorityClients: DailyBriefHighPriorityClient[];
  calendarSummary: DailyBriefCalendarSummary;
  recentActivity: DailyBriefActivityEntry[];
  upcomingDeadlines: DailyBriefDeadline[];
  /** Which of the 7 data categories (events, finance, contracts, checklist, clients, notifications, activity) failed to fetch — used only for `confidence`/`missingInformation`, never surfaced as if it were a real zero. */
  unavailableCategories: string[];
  /**
   * The prior Daily Brief's own issue snapshot, if one exists in shared
   * memory (Checkpoint 6, Step 7) — `null` on this Workspace's very first
   * Daily Brief. Populated by `registerDailyOperationsBriefUseCase.ts`'s
   * `composeContext` from the optional `memory` Context Orchestrator
   * section (`SkillDefinition.optionalContext`); `assembleBrief.ts` is the
   * only reader, and only ever to compute `briefComparison`
   * deterministically — the model may narrate around it, but the
   * structured new/resolved/persistent lists are never taken from the
   * model's own output.
   */
  previousSnapshot?: DailyBriefIssueSnapshot[] | null;
}

/**
 * One comparable fact from a single Daily Brief run, persisted as this
 * checkpoint's own historical memory — `key` is a stable, machine-diffable
 * identifier (`risk:{eventId}:{riskKind}` / `late-payment:{invoiceId}` /
 * `unsigned-contract:{contractId}`); `label` is the human-readable text to
 * show if this exact issue turns out to be new, resolved, or persistent
 * next time. Serialized as this checkpoint's memory `summary` field (see
 * `generateDailyOperationsBrief.ts`) — deliberately not a raw prompt or
 * provider response, just a derived structured fact.
 */
export interface DailyBriefIssueSnapshot {
  key: string;
  label: string;
}

/** Step 7's own output — computed entirely in `assembleBrief.ts` by diffing `computeIssueSnapshots(context)` against `context.previousSnapshot`, never from the model. `null` when there is no prior snapshot to compare against. */
export interface DailyBriefComparison {
  newIssues: string[];
  resolvedIssues: string[];
  persistentRisks: string[];
}

/** One risk explanation the model attaches to a real at-risk Event — `eventId` must match one already in `eventsAtRisk`; anything else is dropped/rejected (see `semanticValidation.ts`). */
export interface DailyBriefRiskExplanationOutput {
  eventId: string;
  explanation: string;
}

export const DAILY_BRIEF_ACTION_TARGET_TYPES = ["event", "invoice", "contract"] as const;
export type DailyBriefActionTargetType = (typeof DAILY_BRIEF_ACTION_TARGET_TYPES)[number];

/** One concrete, single-step suggestion — `targetId` (when `targetType` is set) must reference a real Event/Invoice/Contract already present in context; an invented one is rejected, never rendered (see `semanticValidation.ts`). */
export interface DailyBriefSuggestedActionOutput {
  label: string;
  reason: string;
  targetType: DailyBriefActionTargetType | null;
  targetId: string | null;
}

/** The only shape the model is trusted to fill in — narrative synthesis and advisory suggestions over `DailyOperationsBriefContext`, never the facts themselves. */
export interface DailyOperationsBriefModelOutput {
  executiveSummary: string;
  todaysPriorities: string[];
  riskExplanations: DailyBriefRiskExplanationOutput[];
  recommendations: string[];
  suggestedActions: DailyBriefSuggestedActionOutput[];
}

export interface DailyBriefActionTarget {
  type: DailyBriefActionTargetType;
  href: string;
  label: string;
}

export interface DailyBriefResolvedRisk {
  event: DailyBriefEventSummary;
  risk: DetectedRisk;
  explanation: string | null;
}

export interface DailyBriefResolvedSuggestedAction {
  label: string;
  reason: string;
  actionTarget: DailyBriefActionTarget | null;
}

/** The fully-assembled, UI-ready brief — deterministic sections rendered straight from context, narrative sections carried from the validated model output. */
export interface DailyOperationsBrief {
  executiveSummary: string;
  todaysPriorities: string[];
  eventsToday: DailyBriefEventSummary[];
  eventsThisWeek: DailyBriefEventSummary[];
  operationalRisks: DailyBriefResolvedRisk[];
  latePayments: DailyBriefLatePayment[];
  contractIssues: DailyBriefContractIssue[];
  checklistProgress: DailyBriefChecklistProgress;
  teamAssignments: DailyBriefTeamAssignment[];
  recommendations: string[];
  suggestedActions: DailyBriefResolvedSuggestedAction[];
  confidence: number;
  missingInformation: string[];
  /** `null` on this Workspace's very first Daily Brief — see `DailyBriefComparison`'s own doc comment. */
  briefComparison: DailyBriefComparison | null;
  /**
   * Notification-shaped objects for the brief's own critical findings
   * (high-severity risks, late payments, imminent unsigned contracts) —
   * built (not persisted, not sent) purely for the UI to highlight. See
   * `notifications.ts`'s own doc comment for why nothing here is ever
   * written to the Notifications repository or dispatched through any
   * channel.
   */
  criticalFindings: Notification[];
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
